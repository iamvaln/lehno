import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { reglagesPortraitDeDepart, reglagesBriefPortraitDeDepart } from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { GenerationService } from "../src/me/generation.service.js";
import { PortraitService } from "../src/me/portrait.service.js";
import { PhotoSourceService } from "../src/me/photo-source.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { AuditService } from "../src/admin/audit.service.js";
import { StudioConfigurationService } from "../src/studio/configuration.service.js";
import { RouteurIAService, type Adaptateur, type ReponseIA } from "../src/ia/routeur.service.js";
import { CatalogueIAService } from "../src/ia/catalogue.service.js";
import { StockageMemoire } from "../src/stockage/memoire.adapter.js";
import { verifierLaSelection } from "../src/studio/selection.js";
import { echoue, fini } from "./attendre.js";

/**
 * Le portrait, en deux temps.
 *
 * Le texte au lancement, l'IMAGE À L'APPROBATION. Ce qu'on éprouve n'est pas la
 * qualité du dessin — elle dépend d'un tiers — mais trois choses qui se
 * comptent : le crédit débité une fois, l'image qui ne se fabrique qu'une fois
 * approuvée, et surtout CE QUI PART au fournisseur d'image.
 */
describe("le portrait", () => {
  let db: TestDb;
  let stockage: StockageMemoire;
  let awa: string;
  let proche: string;
  /* La configuration qui a produit le brief — c'est elle que l'approbation
     relira, pas celle en service. Les cas la posent donc avant de lancer. */
  let config: string;

  /* Le brief : des mots, une phrase, une version courte. C'est ce que le modèle
     de TEXTE rend, et c'est tout ce que le modèle d'image recevra. */
  const BRIEF = JSON.stringify({
    mots: ["le jardin du matin", "les mains dans la terre", "le héron"],
    phrase: "Celle qui plante avant que le jour se lève.",
    phraseCourte: "Le jardin du matin.",
  });

  /* UNE VRAIE IMAGE, MINUSCULE — et non « aW1hZ2U= », qui n'est que le mot
     « image » en base64.

     Elle suffisait tant que le serveur se contentait de RANGER ce que le modèle
     rendait. Depuis qu'il COMPOSE le fichier — cadre, dédicace, mention —, il
     décode les octets, et cinq octets qui ne sont pas une image le font tomber
     sur « Input buffer contains unsupported image format ». Un PNG de huit
     pixels coûte une ligne et éprouve le vrai chemin. */
  const PNG_MINUSCULE = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAD0lEQVQImWM4gwMwDC0JAMg9mQGm7abwAAAAAElFTkSuQmCC";

  /* Un double qui RETIENT ce qu'on lui a envoyé. C'est le seul moyen d'éprouver
     ce qui fuit : la promesse du brief est que les notes ne traversent pas. */
  const repond = (contenu: string): Adaptateur & { vu: string[] } => {
    const a = {
      vu: [] as string[],
      async appeler(_modele: string, d: { invite: string; systeme?: string }): Promise<ReponseIA> {
        a.vu.push(`${d.systeme ?? ""}\n${d.invite}`);
        return { contenu };
      },
    };
    return a as Adaptateur & { vu: string[] };
  };

  const configs = (): StudioConfigurationService =>
    new StudioConfigurationService(db.prisma as never, new AuditService(db.prisma as never));

  const generation = (a: Adaptateur): GenerationService =>
    new GenerationService(
      db.prisma as never, new TenantRepository(db.prisma as never),
      new RouteurIAService(db.prisma as never), { anthropic: a }, configs(),
    );

  const photos = (): PhotoSourceService =>
    new PhotoSourceService(db.prisma as never, configs(), stockage);

  const portraits = (a: Adaptateur): PortraitService =>
    new PortraitService(
      db.prisma as never, new RouteurIAService(db.prisma as never),
      { anthropic: a, xai: a, openai: a }, configs(), stockage, photos(),
    );

  /* La configuration PUBLIÉE. Sans elle le service refuse — et c'est voulu :
     composer une image avec des réglages que personne n'a publiés donnerait une
     image qu'aucun essai n'a montrée. */
  const publier = async (): Promise<void> => {
    const reglages = reglagesPortraitDeDepart();
    const ligne = await db.prisma.studioConfig.create({
      data: {
        kind: "portrait", state: "published", version: 1,
        settings: reglages as never, fingerprint: randomBytes(8).toString("hex"),
      },
    });
    config = ligne.id;
  };

  const selection = () =>
    verifierLaSelection(reglagesPortraitDeDepart(), {
      orientation: "notre_relation", visual: "illustration", illustrationFamily: "nature",
      // Le SECOND paramètre du client : la composition, donc la gamme.
      composition: "papier",
    });

  const crediter = (n: number) =>
    db.prisma.creditTransaction.create({
      data: { userId: awa, type: "grant", source: "signup_grant", amount: n },
    });

  const solde = async (): Promise<number> =>
    (await db.prisma.creditTransaction.aggregate({ where: { userId: awa }, _sum: { amount: true } }))._sum.amount ?? 0;

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await new CatalogueIAService(db.prisma as never).reconcilier();
    stockage = new StockageMemoire();

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
  });

  describe("le texte", () => {
    it("produit un portrait en attente d'approbation, sans image", async () => {
      await crediter(5);
      const portrait = await fini(generation(repond(BRIEF)).lancerPortrait(awa, proche, selection(), config));

      expect(portrait.status).toBe("generated");
      expect(portrait.imageKey).toBeNull();
      expect(await solde()).toBe(4);
    });

    /* LA PROMESSE DU BRIEF. Les notes privées ne doivent pas traverser — c'est
       toute la raison de cette tâche de texte. Ici on vérifie qu'elles arrivent
       bien au modèle de TEXTE ; le cas de l'approbation vérifie qu'elles
       n'arrivent PAS au modèle d'image. */
    it("donne les notes au modèle de texte, et les rejets à part", async () => {
      await crediter(5);
      const categorie = await db.prisma.category.findFirstOrThrow({ where: { code: "dislikes_nogo" } });
      await db.prisma.note.create({
        data: { personId: proche, authorUserId: awa, content: "aime jardiner" },
      });
      await db.prisma.note.create({
        data: {
          personId: proche, authorUserId: awa, content: "déteste les chiens",
          categories: { create: { categoryId: categorie.id } },
        },
      });

      const a = repond(BRIEF);
      await fini(generation(a).lancerPortrait(awa, proche, selection(), config));

      expect(a.vu[0]).toContain("aime jardiner");
      expect(a.vu[0]).toContain("À NE JAMAIS ÉVOQUER");
      expect(a.vu[0]!.indexOf("déteste les chiens")).toBeLessThan(a.vu[0]!.indexOf("aime jardiner"));
    });

    /* LES ATTRIBUTS SONT LA MATIÈRE LA PLUS SÛRE : déjà rangés, déjà choisis.
       Et `avoid` est un REJET, du côté des attributs — le laisser dans la
       matière ferait dessiner ce que la personne fuit, par une autre porte que
       les notes. */
    it("emploie les goûts relevés, et écarte ceux marqués à éviter", async () => {
      await crediter(5);
      await db.prisma.personAttribute.createMany({
        data: [
          { personId: proche, kind: "animal", value: "le héron", observedAt: new Date() },
          { personId: proche, kind: "avoid", value: "le rouge", observedAt: new Date() },
        ],
      });

      const a = repond(BRIEF);
      await fini(generation(a).lancerPortrait(awa, proche, selection(), config));

      expect(a.vu[0]).toContain("animal : le héron");
      expect(a.vu[0]).toContain("À NE JAMAIS ÉVOQUER");
      expect(a.vu[0]).toContain("le rouge");
      // Et il ne figure pas dans la matière : seulement dans l'interdiction.
      expect(a.vu[0]).not.toContain("avoid : le rouge");
    });

    it("rend le crédit quand le brief est illisible", async () => {
      await crediter(5);
      /* Voir `attendre.ts` : une production ratée ne rejette plus, elle rend
         le crédit et l'exécution porte sa raison. */
      await echoue(
        generation(repond("pas du JSON")).lancerPortrait(awa, proche, selection(), config),
      );
      expect(await solde()).toBe(5);
    });

    /* Sous trois mots, il n'y a plus de portrait à composer : un nuage d'un mot
       n'est pas un nuage. Le crédit est rendu. */
    it("rend le crédit quand le brief n'a pas assez de mots", async () => {
      await crediter(5);
      const maigre = JSON.stringify({ mots: ["le jardin"], phrase: "Une phrase." });
      await echoue(
        generation(repond(maigre)).lancerPortrait(awa, proche, selection(), config),
      );
      expect(await solde()).toBe(5);
    });
  });

  describe("l'approbation", () => {
    const unPortrait = async () => {
      await crediter(5);
      return fini(generation(repond(BRIEF)).lancerPortrait(awa, proche, selection(), config));
    };

    /* LE CAS QUI JUSTIFIE TOUTE LA TÂCHE DE BRIEF.
     *
     * Ce qui part au fournisseur d'image ne doit contenir NI note, NI nom, NI
     * relation — seulement les mots retenus. C'est ce qui empêche « a perdu son
     * père en mars » de traverser chez un tiers pour fabriquer un dessin. */
    it("n'envoie au modèle d'image que les mots retenus", async () => {
      await db.prisma.note.create({
        data: { personId: proche, authorUserId: awa, content: "a perdu son père en mars" },
      });
      await publier();
      const portrait = await unPortrait();

      const image = repond(PNG_MINUSCULE);
      await portraits(image).approuver(awa, portrait.id);

      const envoye = image.vu[0]!;
      expect(envoye).toContain("le jardin du matin");
      expect(envoye).not.toContain("a perdu son père en mars");
      expect(envoye).not.toContain("Célarine");
    });

    /* LE DÉFAUT QUE CE CAS EXISTE POUR RETENIR.
     *
     * L'approbation reprenait la PREMIÈRE voie active du catalogue et la
     * première ambiance de son groupe, sans savoir ce qui avait été choisi :
     * « abstrait » rendait un paysage, sans qu'aucune erreur ne s'affiche.
     *
     * Pire que l'écart visuel — le brief a été composé avec la consigne de
     * l'ambiance CHOISIE. L'image ne correspondait donc pas au texte qu'on
     * venait de relire pour l'approuver. */
    it("compose l'image avec l'ambiance choisie, pas la première du catalogue", async () => {
      await publier();
      await crediter(5);
      // « abstrait » n'est PAS la première ambiance active : « nature » l'est.
      const abstrait = verifierLaSelection(reglagesPortraitDeDepart(), {
        orientation: "notre_relation", visual: "illustration", illustrationFamily: "abstrait",
        composition: "papier",
      });
      const portrait = await fini(generation(repond(BRIEF)).lancerPortrait(awa, proche, abstrait, config));
      expect(portrait.ambianceId).toBe("abstrait");

      const image = repond(PNG_MINUSCULE);
      await portraits(image).approuver(awa, portrait.id);

      // La consigne de l'abstrait, pas celle de la nature.
      expect(image.vu[0]).toContain("formes");
      expect(image.vu[0]).not.toContain("élément naturel");
    });

    /* LE CATALOGUE PEUT CHANGER entre le lancement et l'approbation, et ça ne
       change RIEN : on relit la configuration qui a produit le brief, pas celle
       en service. Republier, reformuler, retirer une ambiance — le portrait déjà
       payé s'approuve avec ce qui lui a été annoncé.
       Ce cas remplace un refus qu'on n'aurait pas dû avoir à écrire : tant qu'on
       lisait le catalogue courant, une ambiance supprimée faisait échouer
       l'approbation de quelqu'un qui avait déjà payé. */
    it("approuve avec la configuration d'origine, même republiée depuis", async () => {
      await publier();
      const portrait = await unPortrait();

      // On republie SANS l'ambiance choisie, et avec une consigne reformulée.
      const neuve = reglagesPortraitDeDepart();
      await db.prisma.studioConfig.updateMany({
        where: { kind: "portrait", state: "published" },
        data: { state: "superseded" },
      });
      await db.prisma.studioConfig.create({
        data: {
          kind: "portrait", state: "published", version: 2,
          settings: {
            ...neuve,
            ambiances: neuve.ambiances.filter((a) => a.id !== "nature"),
          } as never,
          fingerprint: randomBytes(8).toString("hex"),
        },
      });

      const image = repond(PNG_MINUSCULE);
      const rendu = await portraits(image).approuver(awa, portrait.id);
      expect(rendu.status).toBe("approved");
      // La consigne d'ORIGINE, celle qui a produit le brief.
      expect(image.vu[0]).toContain("élément naturel");
    });

    it("fabrique l'image et range une clé, jamais l'image", async () => {
      await publier();
      const portrait = await unPortrait();

      const rendu = await portraits(repond(PNG_MINUSCULE)).approuver(awa, portrait.id);
      expect(rendu.status).toBe("approved");
      expect(rendu.imageUrl).not.toBeNull();

      const ligne = await db.prisma.portrait.findUniqueOrThrow({ where: { id: portrait.id } });
      expect(ligne.imageKey).toMatch(/^portraits\//);
      expect(stockage.contenuDe(ligne.imageKey!)).toBeDefined();
    });

    /* Deux frappes sur le même bouton sont la chose la plus banale du monde sur
       un téléphone : la seconde ne doit pas coûter un appel de modèle. */
    it("approuver deux fois ne fabrique qu'une image", async () => {
      await publier();
      const portrait = await unPortrait();

      const image = repond(PNG_MINUSCULE);
      const un = await portraits(image).approuver(awa, portrait.id);
      const deux = await portraits(image).approuver(awa, portrait.id);

      expect(deux.id).toBe(un.id);
      expect(image.vu).toHaveLength(1);
    });

    /* ON REFUSE PLUTÔT QUE DE RETOMBER SUR LE GABARIT DU CODE, à la différence
       du message. Un repli ferait composer une image avec des réglages que
       personne n'a publiés — donc une image qu'aucun essai n'a montrée. */
    it("refuse d'approuver sans configuration publiée", async () => {
      await publier();
      const portrait = await unPortrait();
      // La configuration disparaît APRÈS le lancement : plus rien à relire.
      await db.prisma.portrait.update({ where: { id: portrait.id }, data: { studioConfigId: null } });
      await db.prisma.studioConfig.deleteMany({ where: { kind: "portrait" } });
      await expect(portraits(repond(PNG_MINUSCULE)).approuver(awa, portrait.id))
        .rejects.toMatchObject({ code: "resource_inactive" });
    });

    // 404 et non 403 : dire « il existe mais n'est pas à vous » apprendrait
    // qu'il existe.
    it("ne laisse pas approuver le portrait d'un autre", async () => {
      await publier();
      const portrait = await unPortrait();
      const bila = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        select: { id: true },
      });
      await expect(portraits(repond(PNG_MINUSCULE)).approuver(bila.id, portrait.id))
        .rejects.toMatchObject({ code: "not_found" });
    });
  });
  /* ─── LE REJET ──────────────────────────────────────────────────────────────
   *
   * §6 du brief du panneau : on pouvait approuver, jamais rejeter. L'atelier
   * publiait donc des configurations sans jamais savoir s'il avait amélioré
   * quoi que ce soit — un pouce en bas sans savoir quelle version l'a produit
   * ne mesure rien, et une version publiée sans avis ne dit pas si elle vaut
   * mieux que la précédente. */
  describe("le rejet", () => {
    const unPortrait = async () => {
      await crediter(5);
      return fini(generation(repond(BRIEF)).lancerPortrait(awa, proche, selection(), config));
    };

    it("marque le portrait rejeté", async () => {
      await publier();
      const portrait = await unPortrait();

      const rejete = await portraits(repond(PNG_MINUSCULE)).rejeter(awa, portrait.id);
      expect(rejete.status).toBe("rejected");
    });

    /* IL NE FABRIQUE RIEN. C'est la moitié qui compte : un rejet qui appellerait
       le modèle d'image coûterait exactement ce qu'on refuse de payer. */
    it("n'appelle aucun modèle d'image", async () => {
      await publier();
      const portrait = await unPortrait();

      const image = repond(PNG_MINUSCULE);
      await portraits(image).rejeter(awa, portrait.id);
      expect(image.vu).toEqual([]);
    });

    /* ET IL NE REND RIEN. Le crédit a payé le TEXTE, qui est là et qu'on vient
       de lire — c'est en le lisant qu'on le rejette. Rembourser ferait de la
       relecture un essai gratuit, ce que le découpage en deux temps évite. */
    it("ne rembourse pas le crédit", async () => {
      await publier();
      const portrait = await unPortrait();
      const avant = await solde();

      await portraits(repond(PNG_MINUSCULE)).rejeter(awa, portrait.id);
      expect(await solde()).toBe(avant);
    });

    /* IDEMPOTENT, comme l'approbation et pour la même raison : deux frappes sur
       le même bouton sont la chose la plus banale du monde sur un téléphone. */
    it("se répète sans rien changer", async () => {
      await publier();
      const portrait = await unPortrait();
      const service = portraits(repond(PNG_MINUSCULE));

      await service.rejeter(awa, portrait.id);
      expect((await service.rejeter(awa, portrait.id)).status).toBe("rejected");
    });

    /* LES DEUX GESTES SE FERMENT L'UN L'AUTRE. Approuver un portrait rejeté
       fabriquerait l'image qu'on venait de refuser, et le compteur de rejets
       par version — la seule mesure qui dise si l'atelier progresse — compterait
       un refus sur un portrait finalement retenu. */
    it("ferme la porte à l'approbation", async () => {
      await publier();
      const portrait = await unPortrait();
      const service = portraits(repond(PNG_MINUSCULE));

      await service.rejeter(awa, portrait.id);
      await expect(service.approuver(awa, portrait.id))
        .rejects.toMatchObject({ code: "conflict" });
    });

    /* REJETER UN PORTRAIT APPROUVÉ EFFACE SON IMAGE — et c'est ce qui rend le
       §7 applicable. Une première version le refusait ; le rejet ne libérait
       alors jamais rien, puisqu'un portrait rejeté n'a jamais eu d'image. Or ce
       qui s'accumule, ce sont les portraits APPROUVÉS qu'on refait. */
    it("efface l'image quand le portrait était approuvé", async () => {
      await publier();
      const portrait = await unPortrait();
      const service = portraits(repond(PNG_MINUSCULE));

      const approuve = await service.approuver(awa, portrait.id);
      const cle = (await db.prisma.portrait.findUniqueOrThrow({
        where: { id: portrait.id }, select: { imageKey: true },
      })).imageKey;
      expect(approuve.imageUrl).not.toBeNull();
      expect(stockage.contenuDe(cle!)).toBeDefined();

      const rejete = await service.rejeter(awa, portrait.id);

      expect(rejete.status).toBe("rejected");
      expect(rejete.imageUrl).toBeNull();
      /* LA CLÉ RÉELLEMENT ÉCRITE, et le fichier avec. Une clé littérale qui
         n'existe jamais rendrait ce cas vert sans rien éprouver. */
      expect(stockage.contenuDe(cle!)).toBeUndefined();
      expect((await db.prisma.portrait.findUniqueOrThrow({
        where: { id: portrait.id }, select: { imageKey: true },
      })).imageKey).toBeNull();
    });

    /* LE TEXTE RESTE, et c'est le propos : on efface le fichier, jamais l'avis
       ni ce qui a été payé. La ligne est ce qui permet de compter les rejets par
       version — l'effacer reviendrait à détruire la mesure qu'on vient
       chercher. */
    it("garde le texte et la ligne", async () => {
      await publier();
      const portrait = await unPortrait();
      const service = portraits(repond(PNG_MINUSCULE));

      await service.approuver(awa, portrait.id);
      const rejete = await service.rejeter(awa, portrait.id);

      expect(rejete.content).toContain("Celle qui plante");
      expect(await db.prisma.portrait.count({ where: { id: portrait.id } })).toBe(1);
    });

    it("ne rejette pas le portrait d'un autre compte", async () => {
      await publier();
      const portrait = await unPortrait();
      const bila = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        select: { id: true },
      });
      await expect(portraits(repond(PNG_MINUSCULE)).rejeter(bila.id, portrait.id))
        .rejects.toMatchObject({ code: "not_found" });
    });
  });

  /* ─── CE QUI A PRODUIT QUOI ─────────────────────────────────────────────────
   *
   * Sans ce lien, un rejet ne mesure rien : on saurait qu'un portrait a déplu
   * sans savoir quelle consigne a choisi ses mots. */
  describe("la version qui l'a produit", () => {
    /* DEUX COLONNES, DEUX NATURES, et c'est l'écart trouvé le 12 septembre :
       `studioConfigId` se disait « la configuration qui a produit le brief »,
       alors que c'est le CATALOGUE — ambiances, compositions, modèle d'image.
       La consigne qui écrit le texte est `portrait_brief`, une autre nature, et
       elle ne se notait nulle part. */
    it("garde le catalogue ET la consigne du brief, séparément", async () => {
      await publier();
      const brief = await db.prisma.studioConfig.create({
        data: {
          kind: "portrait_brief", state: "published", version: 1,
          // Les réglages de DÉPART, jamais fabriqués à la main : le schéma est
          // `.strict()`, et une fixture approximative serait jugée ILLISIBLE —
          // donc non attribuée, donc ce cas passerait pour un défaut du code.
          settings: reglagesBriefPortraitDeDepart() as never,
          fingerprint: randomBytes(8).toString("hex"),
        },
        select: { id: true },
      });

      await crediter(5);
      const portrait = await fini(
        generation(repond(BRIEF)).lancerPortrait(awa, proche, selection(), config),
      );

      const ligne = await db.prisma.portrait.findUniqueOrThrow({
        where: { id: portrait.id },
        select: { studioConfigId: true, briefStudioConfigId: true },
      });
      expect(ligne.studioConfigId).toBe(config);
      expect(ligne.briefStudioConfigId).toBe(brief.id);
      // Deux versions distinctes : l'une choisit les mots, l'autre les dessine.
      expect(ligne.briefStudioConfigId).not.toBe(ligne.studioConfigId);
    });

    /* SANS CONFIGURATION DE BRIEF PUBLIÉE, le texte vient du gabarit du code —
       qui n'a pas de version. Lui en attribuer une ferait porter à une
       configuration des avis qu'elle n'a pas mérités, et c'est précisément le
       chiffre qu'on veut pouvoir croire. */
    it("n'attribue rien quand le brief vient du code", async () => {
      await publier();
      await crediter(5);
      const portrait = await fini(
        generation(repond(BRIEF)).lancerPortrait(awa, proche, selection(), config),
      );

      const ligne = await db.prisma.portrait.findUniqueOrThrow({
        where: { id: portrait.id }, select: { briefStudioConfigId: true },
      });
      expect(ligne.briefStudioConfigId).toBeNull();
    });
  });
});
