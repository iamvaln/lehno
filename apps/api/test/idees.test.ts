import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { GenerationService } from "../src/me/generation.service.js";
import { IdeeService } from "../src/me/idee.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { AuditService } from "../src/admin/audit.service.js";
import { StudioConfigurationService } from "../src/studio/configuration.service.js";
import { RouteurIAService, type Adaptateur, type ReponseIA } from "../src/ia/routeur.service.js";
import { CatalogueIAService } from "../src/ia/catalogue.service.js";
import { echoue, fini } from "./attendre.js";

/**
 * Les idées de cadeaux.
 *
 * Ce qu'on éprouve n'est pas la qualité des idées — elle dépend d'un tiers —
 * mais ce qui se compte en argent et ce qui se compte en signal : le crédit
 * débité une fois, rendu quand la sortie est inexploitable, et l'avis qui ne se
 * déduit jamais de l'acceptation.
 */
describe("les idées de cadeaux", () => {
  let db: TestDb;
  let service: GenerationService;
  let idees: IdeeService;
  let awa: string;
  let occurrence: string;
  let proche: string;

  const cinqIdees = (n = 5): string => JSON.stringify({
    idees: Array.from({ length: n }, (_, i) => ({
      titre: `Idée ${i + 1}`,
      pourquoi: "Parce que ses notes disent qu'elle jardine tous les dimanches.",
      prixMin: 5_000, prixMax: 12_000,
    })),
  });

  const repond = (contenu = cinqIdees()): Adaptateur & { vu: string[] } => {
    const a = {
      vu: [] as string[],
      // `appeler(modele, demande)` — l'invite est le SECOND argument.
      async appeler(_modele: string, d: { invite: string; systeme: string }): Promise<ReponseIA> {
        a.vu.push(`${d.systeme}\n${d.invite}`);
        return { contenu };
      },
    };
    return a as Adaptateur & { vu: string[] };
  };

  const solde = async (): Promise<number> =>
    (await db.prisma.creditTransaction.aggregate({ where: { userId: awa }, _sum: { amount: true } }))._sum.amount ?? 0;

  const crediter = (n: number) =>
    db.prisma.creditTransaction.create({
      data: { userId: awa, type: "grant", source: "signup_grant", amount: n },
    });

  const fabrique = (a: Adaptateur) =>
    new GenerationService(
      db.prisma as never, new TenantRepository(db.prisma as never),
      new RouteurIAService(db.prisma as never), { anthropic: a },
      new StudioConfigurationService(db.prisma as never, new AuditService(db.prisma as never)),
    );

  const note = (contenu: string, categorie?: string) =>
    db.prisma.note.create({
      data: {
        personId: proche, authorUserId: awa, content: contenu,
        ...(categorie === undefined ? {} : {
          categories: { create: { category: { connect: { code: categorie } } } },
        }),
      },
    });

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await new CatalogueIAService(db.prisma as never).reconcilier();
    service = fabrique(repond());
    idees = new IdeeService(db.prisma as never);

    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
      select: { id: true },
    });
    awa = u.id;
    const p = await db.prisma.person.create({
      data: { userId: awa, displayName: "Célarine", gender: "female" },
      select: { id: true },
    });
    proche = p.id;
    const e = await db.prisma.event.create({
      data: { personId: p.id, authorUserId: awa, kind: "birthday", referenceDate: new Date("2026-09-01") },
      select: { id: true },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId: awa, occurrenceDate: new Date("2026-09-01"), occurrenceYear: 2026 },
      select: { id: true },
    });
    occurrence = o.id;
  });

  describe("la production", () => {
    it("range les idées dans leur ordre, rattachées à l'exécution", async () => {
      await crediter(5);
      const jeu = await fini(service.lancerIdees(awa, occurrence));

      expect(jeu.ideas).toHaveLength(5);
      expect(jeu.ideas.map((i) => i.position)).toEqual([0, 1, 2, 3, 4]);
      expect(jeu.ideas[0]!.label).toBe("Idée 1");
      expect(await solde()).toBe(4);
    });

    /* ON GARDE CE QUI EST UTILISABLE. Un modèle qui rend huit idées n'a pas
       suivi la consigne, mais les premières valent ce qu'elles valent :
       reprendre un crédit pour un excès de zèle serait une punition à
       l'envers. */
    it("garde les premières quand le modèle en rend trop", async () => {
      await crediter(5);
      const jeu = await fini(fabrique(repond(cinqIdees(12))).lancerIdees(awa, occurrence));
      expect(jeu.ideas.length).toBeLessThanOrEqual(8);
      expect(await solde()).toBe(4);
    });

    /* Sous trois, il n'y a plus de liste : deux idées ne donnent rien à
       comparer, et le refus d'une seule la vide. Le crédit est RENDU. */
    it("rend le crédit quand il n'y a plus de liste à montrer", async () => {
      await crediter(5);
      /* ELLE NE REJETTE PLUS : le lancement rend la main avant la production,
         et la requête est déjà partie quand ça échoue. Ce que l'utilisateur
         voit reste le même, et c'est ce qu'on éprouve — son crédit revenu. */
      await echoue(fabrique(repond(cinqIdees(2))).lancerIdees(awa, occurrence));
      expect(await solde()).toBe(5);
    });

    it("rend le crédit quand la sortie est illisible", async () => {
      await crediter(5);
      await echoue(fabrique(repond("pas du JSON")).lancerIdees(awa, occurrence));
      expect(await solde()).toBe(5);
    });

    /* LA FOURCHETTE S'ACCEPTE COMPLÈTE OU PAS DU TOUT. Une borne seule serait
       rangée telle quelle et affichée telle quelle — un prix qu'on ne sait pas
       lire vaut moins que pas de prix. La base porte la même règle et refuserait
       la ligne. */
    it("écarte une fourchette incomplète plutôt que de ranger une borne seule", async () => {
      await crediter(5);
      const bancal = JSON.stringify({
        idees: Array.from({ length: 4 }, (_, i) => ({
          titre: `Idée ${i + 1}`, pourquoi: "Une raison qui tient.", prixMin: 5_000, prixMax: null,
        })),
      });
      const jeu = await fini(fabrique(repond(bancal)).lancerIdees(awa, occurrence));
      expect(jeu.ideas[0]!.priceMin).toBeNull();
      expect(jeu.ideas[0]!.currency).toBeNull();
    });

    /* LE REJET N'EST PAS DE LA MATIÈRE, et l'enjeu est direct : mêlé aux notes,
       « elle déteste le parfum » ferait proposer un parfum. */
    it("passe les rejets en interdiction, jamais en matière", async () => {
      await crediter(5);
      const a = repond();
      await fini(fabrique(a).lancerIdees(awa, occurrence));
      // Sans note de rejet, l'invite ne porte pas la section d'interdiction.
      expect(a.vu[0]).not.toContain("À NE JAMAIS PROPOSER");

      await note("le parfum", "dislikes_nogo");
      const b = repond();
      await crediter(5);
      await fini(fabrique(b).lancerIdees(awa, occurrence));
      expect(b.vu[0]).toContain("À NE JAMAIS PROPOSER");
      expect(b.vu[0]).toContain("le parfum");
    });

    /* LES NOTES `gift_ideas` SONT LA MEILLEURE MATIÈRE, et le message les
       écarte — « les idées de cadeaux n'ont rien à faire dans un message ».
       C'est ce que la personne a noté en pensant précisément à quoi offrir. */
    it("emploie les notes rangées en idées de cadeaux, que le message écarte", async () => {
      await crediter(5);
      await note("elle a parlé d'un vélo", "gift_ideas");
      const a = repond();
      await fini(fabrique(a).lancerIdees(awa, occurrence));
      expect(a.vu[0]).toContain("elle a parlé d'un vélo");
    });

    /* UNE OCCASION SENSIBLE NE FERME RIEN, elle réoriente : on offre des fleurs
       à un deuil, on contribue aux frais, on paie un déplacement. */
    it("produit sur une occasion sensible, en réorientant vers le soutien", async () => {
      await crediter(5);
      await db.prisma.event.updateMany({ where: { personId: proche }, data: { eventNature: "sensitive" } });
      const a = repond();
      const jeu = await fini(fabrique(a).lancerIdees(awa, occurrence));
      expect(jeu.ideas).toHaveLength(5);
      expect(a.vu[0]).toContain("ON SOULAGE");
    });

    // Le budget passe avant la matière : une liste hors budget est inutilisable
    // en entier, alors qu'une idée faible ne coûte que sa ligne.
    it("porte le budget jusqu'au modèle, avec sa devise", async () => {
      await crediter(5);
      const a = repond();
      await fini(fabrique(a).lancerIdees(awa, occurrence, { budget: { min: null, max: 20_000 } }));
      expect(a.vu[0]).toContain("jusqu'à 20000 XAF");
    });
  });

  describe("noter et retenir", () => {
    const unJeu = async () => {
      await crediter(5);
      return fini(service.lancerIdees(awa, occurrence));
    };

    it("pose un avis, le change, puis le reprend", async () => {
      const jeu = await unJeu();
      const id = jeu.ideas[0]!.id;

      expect((await idees.noter(awa, id, "up")).feedback).toBe("up");
      expect((await idees.noter(awa, id, "down")).feedback).toBe("down");

      /* `null` retire l'avis — un doigt qui glisse ne doit pas être définitif.
         La DATE suit toujours : la base refuse un avis sans date, et une date
         sans avis ne désigne rien. */
      const repris = await idees.noter(awa, id, null);
      expect(repris.feedback).toBeNull();
      expect(repris.feedbackAt).toBeNull();
    });

    /* LE CLOISONNEMENT PASSE PAR LE JEU : l'idée elle-même ne porte pas de
       propriétaire. 404 et non 403 — un 403 confirmerait qu'elle existe. */
    it("ne laisse pas noter l'idée d'un autre compte", async () => {
      const jeu = await unJeu();
      const bila = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        select: { id: true },
      });
      await expect(idees.noter(bila.id, jeu.ideas[0]!.id, "up"))
        .rejects.toMatchObject({ code: "not_found" });
    });

    it("retenir une idée en fait un souhait, marqué comme tel", async () => {
      const jeu = await unJeu();
      const souhait = await idees.retenir(awa, jeu.ideas[0]!.id);

      expect(souhait.label).toBe("Idée 1");
      expect(souhait.origin).toBe("accepted_idea");
      expect(souhait.eventOccurrenceId).toBe(occurrence);
      // Le « pourquoi » suit : c'est ce qui rend l'idée retenable trois
      // semaines plus tard, quand on aura oublié pourquoi elle paraissait juste.
      expect(souhait.details).toContain("jardine");
    });

    /* AUCUN PRIX ne passe de l'idée au souhait. La fourchette est indicative,
       produite par un modèle qui ne connaît aucun marché ; la recopier dans
       `price` la transformerait en prix constaté — et c'est sur ce chiffre
       qu'un proche déciderait de son budget. */
    it("ne transforme pas une fourchette indicative en prix constaté", async () => {
      const jeu = await unJeu();
      expect(jeu.ideas[0]!.priceMin).not.toBeNull();

      const souhait = await idees.retenir(awa, jeu.ideas[0]!.id);
      expect(souhait.price).toBeNull();
      expect(souhait.currency).toBeNull();
    });

    /* Deux frappes sur le même bouton sont la chose la plus banale du monde sur
       un téléphone : la seconde rend le souhait déjà créé, pas un doublon. */
    it("retenir deux fois ne crée qu'un souhait", async () => {
      const jeu = await unJeu();
      const un = await idees.retenir(awa, jeu.ideas[0]!.id);
      const deux = await idees.retenir(awa, jeu.ideas[0]!.id);

      expect(deux.id).toBe(un.id);
      expect(await db.prisma.wishlistItem.count({ where: { eventOccurrenceId: occurrence } })).toBe(1);
    });

    /* LES DEUX GESTES SONT INDÉPENDANTS, et c'est tout l'objet du montage.
       Retenir ne pose aucun avis : « bonne idée, mauvais moment » doit rester
       distinguable de « idée retenue », sinon on mesure l'occasion et non la
       pertinence de l'invite. */
    it("retenir ne pose aucun avis, et noter ne retient rien", async () => {
      const jeu = await unJeu();
      const id = jeu.ideas[0]!.id;

      await idees.retenir(awa, id);
      const apresRetenue = await db.prisma.generatedIdea.findUniqueOrThrow({ where: { id } });
      expect(apresRetenue.feedback).toBeNull();
      expect(apresRetenue.wishlistItemId).not.toBeNull();

      const autre = jeu.ideas[1]!.id;
      await idees.noter(awa, autre, "up");
      const apresAvis = await db.prisma.generatedIdea.findUniqueOrThrow({ where: { id: autre } });
      expect(apresAvis.wishlistItemId).toBeNull();
    });

    /* L'IDÉE SURVIT À SON SOUHAIT. `SetNull` et non `Cascade` : retirer le
       souhait de la liste n'efface ni l'idée ni son avis — c'est même le cas le
       plus instructif, « on l'a retenue puis abandonnée ». */
    it("garde l'idée et son avis quand le souhait est retiré", async () => {
      const jeu = await unJeu();
      const id = jeu.ideas[0]!.id;
      await idees.noter(awa, id, "up");
      const souhait = await idees.retenir(awa, id);

      await db.prisma.wishlistItem.delete({ where: { id: souhait.id } });

      const apres = await db.prisma.generatedIdea.findUniqueOrThrow({ where: { id } });
      expect(apres.feedback).toBe("up");
      expect(apres.wishlistItemId).toBeNull();
      // La date d'acceptation reste : elle dit qu'elle A ÉTÉ retenue.
      expect(apres.acceptedAt).not.toBeNull();
    });
  });

  /* LA CHAÎNE QUI JUSTIFIE LE MONTAGE : un avis doit remonter jusqu'à ce qui a
     produit l'idée. C'est la question qu'on posera — « qu'est-ce qui plaît le
     plus » — et elle ne se pose que si le lien tient.
   *
   * IL TIENT JUSQU'AU MODÈLE, PAS JUSQU'À LA VERSION D'INVITE.
   * `action_run.prompt_template_id` existe, documenté par « sans elle,
   * comprendre pourquoi les productions d'une semaine valaient mieux que celles
   * de la suivante devient impossible » — et RIEN dans l'API ne l'écrit, pas
   * plus pour le message que pour les idées. Ce cas fixe donc ce qui est vrai
   * aujourd'hui plutôt que ce qu'on voudrait : le jour où les invites vivront
   * en base, il faudra le reprendre, et son échec le dira. */
  it("relie un avis à l'exécution et au modèle qui a produit l'idée", async () => {
    await crediter(5);
    const jeu = await fini(service.lancerIdees(awa, occurrence));
    await idees.noter(awa, jeu.ideas[0]!.id, "up");

    const remontee = await db.prisma.generatedIdea.findUniqueOrThrow({
      where: { id: jeu.ideas[0]!.id },
      include: { set: { include: { actionRun: { include: { premiumAction: true } } } } },
    });
    expect(remontee.feedback).toBe("up");
    expect(remontee.set.actionRun.premiumAction.code).toBe("gift_ideas");
    expect(remontee.set.actionRun.status).toBe("success");

    /* Le modèle employé se lit par les appels rattachés à l'exécution.
       `modelKey` est recopié SUR L'APPEL, pas seulement pointé : un modèle
       retiré du catalogue laisserait `model_id` à nul, et l'analyse perdrait
       ce qu'elle cherche justement à comparer. */
    const appels = await db.prisma.aIUsage.findMany({
      where: { actionRunId: remontee.set.actionRunId },
    });
    expect(appels.length).toBeGreaterThan(0);
    expect(appels[0]!.modelKey).toBeTruthy();
  });
});
