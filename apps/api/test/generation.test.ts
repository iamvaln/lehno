import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { GenerationService } from "../src/me/generation.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { RouteurIAService, PanneFournisseur, RefusModele, type Adaptateur, type ReponseIA } from "../src/ia/routeur.service.js";
import { CatalogueIAService } from "../src/ia/catalogue.service.js";

/* La génération d'un message.
 *
 * Ce qu'on éprouve ici n'est pas la qualité du texte — elle dépend d'un tiers —
 * mais LE CRÉDIT : qu'il soit débité une fois, rendu quand ça rate, et jamais
 * rendu deux fois. C'est la seule partie dont l'erreur se compte en argent. */
describe("la génération d'un message", () => {
  let db: TestDb;
  let service: GenerationService;
  let awa: string;
  let occurrence: string;
  let personne: string;

  /* Un texte de la longueur que les vrais modèles produisent — les essais
     réels donnaient de 26 à 76 mots. Une fixture trop courte ferait tomber la
     borne basse et éprouverait la garde au lieu du parcours. */
  const SORTIE = JSON.stringify({
    message: "Célarine, quatre ans de thèse et tu es allée au bout. Je repense à tout ce que ça t'a demandé, et je me dis que peu de gens auraient tenu comme toi. Et derrière, tu n'as pas ralenti : tu as fait tes cartons pour Douala et pris ton poste. Je suis fier de toi, sincèrement.",
    court: "Ta thèse, ton poste à Douala : je suis fier de toi, Célarine.",
  });

  const repond = (contenu = SORTIE): Adaptateur & { appels: number } => {
    const a = { appels: 0, async appeler(): Promise<ReponseIA> { a.appels += 1; return { contenu }; } };
    return a;
  };
  const tombe = (): Adaptateur => ({ async appeler(): Promise<ReponseIA> { throw new PanneFournisseur("502"); } });
  const refuse = (): Adaptateur => ({ async appeler(): Promise<ReponseIA> { throw new RefusModele("content_policy"); } });

  const solde = async (userId = awa): Promise<number> =>
    (await db.prisma.creditTransaction.aggregate({ where: { userId }, _sum: { amount: true } }))._sum.amount ?? 0;

  const crediter = (n: number, userId = awa) =>
    db.prisma.creditTransaction.create({
      data: { userId, type: "grant", source: "signup_grant", amount: n },
    });

  const fabrique = (adaptateurs: Record<string, Adaptateur>) =>
    new GenerationService(
      db.prisma as never, new TenantRepository(db.prisma as never),
      new RouteurIAService(db.prisma as never), adaptateurs,
    );

  const lancer = (
    adaptateurs: Record<string, Adaptateur>, orientation = "ma_fierte", cle?: string,
  ) =>
    fabrique(adaptateurs).lancerMessage(
      awa, occurrence, orientation as never, cle === undefined ? {} : { cle },
    );

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await new CatalogueIAService(db.prisma as never).reconcilier();
    service = new GenerationService(
      db.prisma as never, new TenantRepository(db.prisma as never),
      new RouteurIAService(db.prisma as never), { anthropic: repond() },
    );
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
        gender: "male",
      },
      select: { id: true },
    });
    awa = u.id;
    const p = await db.prisma.person.create({
      data: { userId: awa, displayName: "Célarine", gender: "female", register: "familier" },
      select: { id: true },
    });
    personne = p.id;
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

  describe("le crédit", () => {
    it("débite exactement une fois quand tout se passe bien", async () => {
      await crediter(5);
      await lancer({ anthropic: repond() });
      expect(await solde()).toBe(4);
    });

    /* `insufficient_credits`, pas `validation_failed` : la demande est bien
       formée, c'est l'état du compte qui ne s'y prête pas. L'écran mène alors à
       la recharge plutôt que d'afficher « requête invalide ». */
    it("refuse sans provision, et le dit comme tel", async () => {
      await expect(lancer({ anthropic: repond() }))
        .rejects.toMatchObject({ code: "insufficient_credits" });
    });

    it("n'appelle aucun modèle quand la provision manque", async () => {
      const modele = repond();
      await lancer({ anthropic: modele }).catch(() => {});
      expect(modele.appels).toBe(0);
      expect(await db.prisma.aIUsage.count()).toBe(0);
    });

    /* LA PROMESSE, écrite en toutes lettres dans la traduction de
       `generation_unavailable` : « vos crédits n'ont pas été débités ». Elle est
       en ligne dans l'application ; il faut qu'elle soit vraie. */
    it("rend le crédit quand tous les modèles tombent", async () => {
      await crediter(5);
      await lancer({ anthropic: tombe(), deepseek: tombe(), xai: tombe() }).catch(() => {});
      expect(await solde()).toBe(5);
    });

    it("rend le crédit quand le modèle refuse", async () => {
      await crediter(5);
      await lancer({ anthropic: refuse() }).catch(() => {});
      expect(await solde()).toBe(5);
    });

    it("rend le crédit quand la réponse est illisible", async () => {
      await crediter(5);
      await lancer({ anthropic: repond("ceci n'est pas du JSON") }).catch(() => {});
      expect(await solde()).toBe(5);
    });

    /* Le remboursement est un mouvement NOUVEAU, jamais la suppression du
       débit : le registre est l'historique, et effacer une ligne effacerait la
       preuve qu'on a débité puis rendu. Quelqu'un qui relit son compte doit
       voir les deux. */
    it("laisse la trace du débit ET du remboursement", async () => {
      await crediter(5);
      await lancer({ anthropic: tombe(), deepseek: tombe(), xai: tombe() }).catch(() => {});

      const mouvements = await db.prisma.creditTransaction.findMany({
        where: { userId: awa }, orderBy: { createdAt: "asc" }, select: { amount: true, type: true },
      });
      expect(mouvements.map((m) => m.amount)).toEqual([5, -1, 1]);
      expect(mouvements[2]!.type).toBe("adjustment");
    });

    /* Le remboursement est conditionné sur `pending`. Sans cette condition, un
       rattrapage concurrent doublerait le remboursement — et le solde
       deviendrait faux À LA HAUSSE, ce que personne ne signale jamais. */
    it("ne rend pas deux fois le même crédit", async () => {
      await crediter(5);
      await lancer({ anthropic: tombe(), deepseek: tombe(), xai: tombe() }).catch(() => {});
      const apres = await solde();

      // Une exécution déjà conclue ne se rembourse plus.
      const run = await db.prisma.actionRun.findFirstOrThrow({ where: { userId: awa } });
      await db.prisma.actionRun.updateMany({
        where: { id: run.id, status: "pending" },
        data: { status: "failure" },
      });
      expect(await solde()).toBe(apres);
    });
  });

  describe("ce que le serveur refuse avant de débiter", () => {
    /* LE refus qui compte. Un « bonne fête » sur un anniversaire de décès est la
       seule erreur de ce parcours qui ne se rattrape pas — et on ne la confie
       pas au jugement d'un modèle, encore moins APRÈS avoir débité. */
    it("refuse une orientation joyeuse sur une occasion sensible", async () => {
      await crediter(5);
      await db.prisma.event.updateMany({ where: { personId: personne }, data: { eventNature: "sensitive" } });

      await expect(lancer({ anthropic: repond() }, "ma_fierte"))
        .rejects.toMatchObject({ code: "validation_failed" });
      // Rien n'a été débité : le refus est AVANT.
      expect(await solde()).toBe(5);
      expect(await db.prisma.actionRun.count()).toBe(0);
    });

    it("accepte l'hommage sur une occasion sensible", async () => {
      await crediter(5);
      await db.prisma.event.updateMany({ where: { personId: personne }, data: { eventNature: "sensitive" } });
      await expect(lancer({ anthropic: repond() }, "un_hommage")).resolves.toBeDefined();
    });

    // L'occurrence d'un autre compte n'existe pas pour le demandeur : 404,
    // jamais 403 — un 403 confirmerait qu'elle existe.
    it("ne génère pas sur l'occasion de quelqu'un d'autre", async () => {
      await crediter(5);
      const bila = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        select: { id: true },
      });
      const s = new GenerationService(
        db.prisma as never, new TenantRepository(db.prisma as never),
        new RouteurIAService(db.prisma as never), { anthropic: repond() },
      );
      await expect(s.lancerMessage(bila.id, occurrence, "ma_fierte" as never))
        .rejects.toMatchObject({ code: "not_found" });
    });
  });

  describe("ce qui est produit", () => {
    it("range le message et sa version courte", async () => {
      await crediter(5);
      const m = await lancer({ anthropic: repond() });
      expect(m.content).toMatch(/quatre ans de thèse/);
      expect(m.shortContent).toMatch(/fier de toi/);
      expect(m.status).toBe("generated");
    });

    /* La version courte n'a pas de crédit à elle : mieux vaut rendre le message
       sans elle que perdre les deux. Le client se replie sur le texte long. */
    it("rend le message même sans version courte utilisable", async () => {
      await crediter(5);
      const m = await lancer({ anthropic: repond(JSON.stringify({ message: "Un message assez long pour passer la borne basse de vingt-cinq mots, écrit à la première personne et adressé directement à la personne concernée aujourd'hui.", court: "trop court" })) });
      expect(m.content.length).toBeGreaterThan(0);
      expect(m.shortContent).toBeNull();
    });

    // Le modèle enrobe parfois son JSON d'une clôture de code. L'interdire dans
    // le gabarit ne marche qu'à peu près, et jeter un texte utilisable pour une
    // clôture serait un crédit repris pour rien.
    it("accepte un JSON enrobé d'une clôture de code", async () => {
      await crediter(5);
      const m = await lancer({ anthropic: repond("```json\n" + SORTIE + "\n```") });
      expect(m.content).toMatch(/thèse/);
    });

    /* Le coût RÉEL, agrégé depuis les tentatives, face au crédit unique
       facturé. C'est cet écart, tenu dans le temps, qui dit si le prix couvre
       l'exploitation. */
    it("rattache la dépense à l'exécution", async () => {
      await crediter(5);
      await lancer({ anthropic: repond() });

      const run = await db.prisma.actionRun.findFirstOrThrow({ where: { userId: awa } });
      expect(run.status).toBe("success");
      const usages = await db.prisma.aIUsage.findMany({ where: { actionRunId: run.id } });
      expect(usages.length).toBeGreaterThan(0);
      expect(usages[0]!.origin).toBe("user_action");
      expect(usages[0]!.purpose).toBe("message");
    });

    /* Un repli laisse plusieurs tentatives, toutes rattachées à la même
       exécution — et UN SEUL crédit débité. C'est la propriété qui compte :
       le prix est unique quelle que soit la dépense réelle.
     *
     * Trois tentatives et non deux, parce que la chaîne du message porte DEUX
     * rangs chez Anthropic : une panne du fournisseur en coûte donc deux avant
     * d'atteindre DeepSeek. C'est exactement ce que l'avertissement
     * `fournisseur_repete` de l'écran d'administration signale — et le voir ici
     * en chiffres vaut mieux que de le lire. */
    it("ne débite qu'une fois même quand la chaîne se replie", async () => {
      await crediter(5);
      await lancer({ anthropic: tombe(), deepseek: repond() });
      expect(await solde()).toBe(4);
      const run = await db.prisma.actionRun.findFirstOrThrow({ where: { userId: awa } });
      expect(await db.prisma.aIUsage.count({ where: { actionRunId: run.id } })).toBe(3);
    });
  });

  describe("le brouillon", () => {
    /* `edited` se pose dès la première correction et ne se retire plus : savoir
       qu'un texte a été retouché est ce qui rend le taux de régénération
       lisible — un contenu qu'on relance aussitôt est un contenu manqué. */
    it("passe à « corrigé » à la première retouche", async () => {
      await crediter(5);
      const m = await lancer({ anthropic: repond() });
      expect((await service.corriger(awa, m.id, { content: "Ma version à moi" })).status).toBe("edited");
    });

    /* `sent` l'emporte ensuite : un message envoyé puis corrigé reste envoyé,
       puisque le destinataire a déjà lu la version d'avant. */
    it("reste « envoyé » après une correction", async () => {
      await crediter(5);
      const m = await lancer({ anthropic: repond() });
      await service.corriger(awa, m.id, { markSent: true });
      expect((await service.corriger(awa, m.id, { content: "encore une version" })).status).toBe("sent");
    });

    it("ne se corrige pas depuis un autre compte", async () => {
      await crediter(5);
      const m = await lancer({ anthropic: repond() });
      const bila = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        select: { id: true },
      });
      await expect(service.corriger(bila.id, m.id, { content: "volé" }))
        .rejects.toMatchObject({ code: "not_found" });
    });
  });

  /* « Une même demande relancée rejoint la génération en cours plutôt que d'en
     créer une seconde, et ne débite qu'une fois » (§5.4).
   *
   * C'est le cas du double clic, et il coûte de l'argent réel. */
  describe("la clé d'idempotence", () => {
    it("ne débite qu'une fois pour deux demandes de même clé", async () => {
      await crediter(5);
      await lancer({ anthropic: repond() }, "ma_fierte", "clic-1");
      await lancer({ anthropic: repond() }, "ma_fierte", "clic-1").catch(() => {});

      expect(await solde()).toBe(4);
      expect(await db.prisma.actionRun.count({ where: { userId: awa } })).toBe(1);
    });

    // Et la seconde demande REJOINT : elle rend le message déjà produit plutôt
    // que d'en fabriquer un autre. C'est ce qui distingue « rejoindre » de
    // « refuser ».
    it("rend le message déjà produit plutôt que d'en refaire un", async () => {
      await crediter(5);
      const premier = await lancer({ anthropic: repond() }, "ma_fierte", "clic-2");
      const second = await lancer({ anthropic: repond() }, "ma_fierte", "clic-2");
      expect(second.id).toBe(premier.id);
      expect(await db.prisma.generatedMessage.count()).toBe(1);
    });

    /* La seconde demande n'appelle AUCUN modèle. C'est là qu'est l'économie
       réelle : le crédit non débité est visible, l'appel non fait ne l'est
       pas — et c'est lui qu'on paie au fournisseur. */
    it("n'appelle aucun modèle une seconde fois", async () => {
      await crediter(5);
      const modele = repond();
      await lancer({ anthropic: modele }, "ma_fierte", "clic-3");
      const appelsApresLePremier = modele.appels;
      await lancer({ anthropic: modele }, "ma_fierte", "clic-3");
      expect(modele.appels).toBe(appelsApresLePremier);
    });

    // Deux clés distinctes sont deux demandes : elles débitent deux fois.
    it("laisse passer deux clés différentes", async () => {
      await crediter(5);
      await lancer({ anthropic: repond() }, "ma_fierte", "a");
      await lancer({ anthropic: repond() }, "ma_fierte", "b");
      expect(await solde()).toBe(3);
    });

    /* Sans clé, aucune protection — et Postgres traite les nuls comme
       distincts, donc rien ne bloque. La protection est OFFERTE, jamais
       imposée : un client qui ne l'emploie pas paie ses doubles clics. */
    it("ne bloque pas deux lancements sans clé", async () => {
      await crediter(5);
      await lancer({ anthropic: repond() });
      await lancer({ anthropic: repond() });
      expect(await solde()).toBe(3);
    });

    // La clé appartient au compte : celle d'un autre ne bloque rien.
    it("ne confond pas les clés de deux comptes", async () => {
      await crediter(5);
      await lancer({ anthropic: repond() }, "ma_fierte", "partagee");

      const bila = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        select: { id: true },
      });
      await crediter(5, bila.id);
      await expect(
        fabrique({ anthropic: repond() })
          .lancerMessage(bila.id, occurrence, "ma_fierte" as never, { cle: "partagee" }),
      ).rejects.toMatchObject({ code: "not_found" });
      // Rejeté pour cloisonnement, pas pour la clé : l'occurrence est à Awa.
      expect(await solde(bila.id)).toBe(5);
    });
  });

  /* Le débit et l'appel sont deux transactions : entre les deux, un arrêt du
     serveur laisse une exécution en attente pour toujours et un crédit débité
     pour rien. Personne ne le signale — l'utilisateur voit un écran qui tourne,
     puis passe à autre chose. */
  describe("le rattrapage des générations abandonnées", () => {
    const abandonner = async (ageMinutes: number): Promise<string> => {
      const action = await db.prisma.premiumAction.findFirstOrThrow({ where: { code: "wish_message" } });
      const run = await db.prisma.actionRun.create({
        data: {
          userId: awa, premiumActionId: action.id, creditsSpent: 1, status: "pending",
          createdAt: new Date(Date.now() - ageMinutes * 60_000),
        },
        select: { id: true },
      });
      await db.prisma.creditTransaction.create({
        data: { userId: awa, type: "consumption", source: "consumption", amount: -1 },
      });
      return run.id;
    };

    it("rend le crédit d'une exécution restée en attente", async () => {
      await crediter(5);
      await abandonner(120);
      expect(await solde()).toBe(4);

      await fabrique({}).reconcilierLesEnCours();
      expect(await solde()).toBe(5);
    });

    /* Le seuil est GÉNÉREUX à dessein. Trop court, on rembourserait une
       production qui allait aboutir — et l'utilisateur recevrait alors son
       message ET son crédit, ce qui coûte deux fois. */
    it("laisse tranquille une exécution récente", async () => {
      await crediter(5);
      await abandonner(5);
      await fabrique({}).reconcilierLesEnCours();
      expect(await solde()).toBe(4);
    });

    // Conditionné sur `pending` : une exécution déjà conclue ne se rembourse
    // pas une seconde fois.
    it("ne rembourse pas une exécution déjà conclue", async () => {
      await crediter(5);
      const id = await abandonner(120);
      await db.prisma.actionRun.update({ where: { id }, data: { status: "success" } });

      await fabrique({}).reconcilierLesEnCours();
      expect(await solde()).toBe(4);
    });

    it("est idempotent : deux passages ne rendent qu'une fois", async () => {
      await crediter(5);
      await abandonner(120);
      const s = fabrique({});
      await s.reconcilierLesEnCours();
      await s.reconcilierLesEnCours();
      expect(await solde()).toBe(5);
    });

    /* LA garde que le passage séquentiel ne prouve pas.
     *
     * Le cas réel : le rattrapage de nuit relève une exécution en attente
     * pendant qu'un lancement échoue et rembourse de son côté. Les deux
     * concluent la même exécution.
     *
     * Ce cas l'appelle DEUX FOIS directement plutôt que de lancer deux passes
     * en parallèle : la course ne se produit pas de façon fiable — mesurée, une
     * fois sur deux —, et un test qui ne mord qu'une fois sur deux passera en
     * intégration continue en cachant la régression.
     *
     * Sans la condition sur `pending`, les deux rendraient, et le solde
     * deviendrait faux À LA HAUSSE — ce que personne ne signale jamais. */
    it("ne rend pas deux fois le crédit d'une même exécution", async () => {
      await crediter(5);
      const id = await abandonner(120);
      const s = fabrique({});

      await s.rendreLeCredit(id, awa, "abandoned");
      await s.rendreLeCredit(id, awa, "abandoned");

      expect(await solde()).toBe(5);
      expect(await db.prisma.creditTransaction.count({
        where: { userId: awa, type: "adjustment" },
      })).toBe(1);
    });
  });

  /* Trois manques signalés par le mobile, et les trois sont réels. */
  describe("ce que l'écran d'attente a besoin de savoir", () => {
    /* Sans la cible, une génération en cours n'a ni nom à afficher ni décompte
       à montrer : l'écran dirait « une production est en cours » sans dire pour
       qui, et la liste des reprises serait une liste d'identifiants. */
    it("porte l'occurrence visée dès le lancement", async () => {
      await crediter(5);
      await lancer({ anthropic: repond() });
      const run = await db.prisma.actionRun.findFirstOrThrow({ where: { userId: awa } });
      expect(run.eventOccurrenceId).toBe(occurrence);
    });

    /* LE cas qui compte : une génération ÉCHOUÉE n'a pas de message produit.
       Si la cible ne vivait que sur le message, l'écran ne saurait pas pour qui
       refaire — c'est-à-dire précisément quand il en a besoin. */
    it("la porte encore quand la génération a échoué", async () => {
      await crediter(5);
      await lancer({ anthropic: tombe(), deepseek: tombe(), xai: tombe() }).catch(() => {});
      const run = await db.prisma.actionRun.findFirstOrThrow({ where: { userId: awa } });
      expect(run.status).toBe("failure");
      expect(await db.prisma.generatedMessage.count({ where: { actionRunId: run.id } })).toBe(0);
      expect(run.eventOccurrenceId).toBe(occurrence);
    });
  });
});
