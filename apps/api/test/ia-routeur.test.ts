import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import {
  RouteurIAService, PanneFournisseur, RefusModele,
  type Adaptateur, type ReponseIA,
} from "../src/ia/routeur.service.js";
import { SEUIL_PANNE } from "@lehno/contracts";

/* Le routage et le repli.
 *
 * Tout se joue avec un faux adaptateur : sans lui, aucun de ces cas ne
 * tournerait en intégration continue, et le repli ne serait éprouvé qu'en
 * production — c'est-à-dire le jour où il rate. */
describe("le routeur d'IA", () => {
  let db: TestDb;
  let routeur: RouteurIAService;

  const DEMANDE = { invite: "dis quelque chose" };

  // Un adaptateur qui fait ce qu'on lui dit, et qui compte ses appels.
  const faux = (
    comportement: (n: number) => ReponseIA | Error,
  ): Adaptateur & { appels: number } => {
    const a = {
      appels: 0,
      async appeler(): Promise<ReponseIA> {
        a.appels += 1;
        const r = comportement(a.appels);
        if (r instanceof Error) throw r;
        return r;
      },
    };
    return a;
  };

  const repond = (contenu = "voilà", jetonsEntree?: number, jetonsSortie?: number) =>
    faux(() => ({ contenu, ...(jetonsEntree === undefined ? {} : { jetonsEntree }), ...(jetonsSortie === undefined ? {} : { jetonsSortie }) }));
  const tombe = (code = "502") => faux(() => new PanneFournisseur(code));
  const refuse = (code = "content_policy") => faux(() => new RefusModele(code));

  const modele = async (
    provider: string,
    opts: { enabled?: boolean; outageUntil?: Date | null; coutEntree?: string; coutSortie?: string } = {},
  ) =>
    db.prisma.aIModel.create({
      data: {
        provider, modelKey: `${provider}-1`,
        enabled: opts.enabled ?? true,
        ...(opts.outageUntil === undefined ? {} : { outageUntil: opts.outageUntil }),
        ...(opts.coutEntree === undefined ? {} : { costInput: opts.coutEntree }),
        ...(opts.coutSortie === undefined ? {} : { costOutput: opts.coutSortie }),
      },
    });

  const ranger = (ids: string[], task = "message") =>
    db.prisma.aITaskRoute.createMany({
      data: ids.map((modelId, i) => ({ task: task as never, modelId, rank: i + 1 })),
    });

  const usages = () =>
    db.prisma.aIUsage.findMany({ orderBy: { attempt: "asc" } });

  // Une exécution payante, à laquelle rattacher la dépense.
  const execution = async (): Promise<{ userId: string; actionRunId: string }> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
      select: { id: true },
    });
    const action = await db.prisma.premiumAction.create({
      data: { code: `essai-${randomBytes(4).toString("hex")}`, label: "Essai" },
      select: { id: true },
    });
    const run = await db.prisma.actionRun.create({
      data: { userId: u.id, premiumActionId: action.id, creditsSpent: 1, status: "success" },
      select: { id: true },
    });
    return { userId: u.id, actionRunId: run.id };
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    routeur = new RouteurIAService(db.prisma as never);
  });

  describe("la chaîne", () => {
    it("rend les modèles dans l'ordre des rangs", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);
      expect((await routeur.chaine("message")).map((c) => c.provider)).toEqual(["anthropic", "deepseek"]);
    });

    // Coupé à la main : sauté, mais les rangs des autres ne bougent pas — c'est
    // l'ordre de l'administration, pas un classement recalculé.
    it("saute un modèle coupé à la main sans renuméroter les autres", async () => {
      const a = await modele("anthropic", { enabled: false });
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);
      const chaine = await routeur.chaine("message");
      expect(chaine.map((c) => c.provider)).toEqual(["deepseek"]);
      expect(chaine[0]!.rank).toBe(2);
    });

    it("saute un modèle dont la panne court encore", async () => {
      const a = await modele("anthropic", { outageUntil: new Date(Date.now() + 60_000) });
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);
      expect((await routeur.chaine("message")).map((c) => c.provider)).toEqual(["deepseek"]);
    });

    // Une panne expirée n'est plus une panne : le modèle reprend sa place de
    // lui-même, sans que personne n'ait à le rallumer.
    it("reprend un modèle dont la panne a expiré", async () => {
      const a = await modele("anthropic", { outageUntil: new Date(Date.now() - 1_000) });
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);
      expect((await routeur.chaine("message")).map((c) => c.provider)).toEqual(["anthropic", "deepseek"]);
    });
  });

  describe("l'exécution", () => {
    it("rend la réponse du premier rang qui répond", async () => {
      const a = await modele("anthropic");
      await ranger([a.id]);
      const r = await routeur.executer("message", DEMANDE, { anthropic: repond("bonjour") });
      expect(r.contenu).toBe("bonjour");
      expect(r.rang).toBe(1);
    });

    it("replie sur le rang suivant quand le premier tombe", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);

      const r = await routeur.executer("message", DEMANDE, {
        anthropic: tombe(), deepseek: repond("le repli a parlé"),
      });
      expect(r.contenu).toBe("le repli a parlé");
      expect(r.fournisseur).toBe("deepseek");
    });

    /* Une chaîne vide échoue EXPLICITEMENT. Rendre une réponse vide la ferait
       passer pour « rien à générer », et le contenu manquant se découvrirait à
       l'écran de l'utilisateur au lieu du journal. */
    it("échoue explicitement quand aucun modèle n'est appelable", async () => {
      const a = await modele("anthropic", { enabled: false });
      await ranger([a.id]);
      await expect(routeur.executer("message", DEMANDE, { anthropic: repond() }))
        .rejects.toMatchObject({ code: "generation_unavailable" });
    });

    it("échoue quand tous les rangs tombent", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);
      await expect(routeur.executer("message", DEMANDE, { anthropic: tombe(), deepseek: tombe() }))
        .rejects.toMatchObject({ code: "generation_unavailable" });
    });

    /* Un fournisseur sans adaptateur est une erreur de configuration, pas une
       panne : on saute au suivant, et on n'ouvre pas le disjoncteur — il se
       rouvrirait cinq minutes plus tard pour échouer pareil. */
    it("saute un fournisseur sans adaptateur sans le mettre en panne", async () => {
      const a = await modele("inconnu");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);

      const r = await routeur.executer("message", DEMANDE, { deepseek: repond("ok") });
      expect(r.fournisseur).toBe("deepseek");
      const apres = await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } });
      expect(apres.consecutiveFailures).toBe(0);
      expect(apres.outageUntil).toBeNull();
    });
  });

  describe("le refus, qui n'est pas une panne", () => {
    /* LA distinction du chantier. Le modèle suivant refuserait la même demande :
       replier paierait le même non autant de fois qu'il y a de rangs. */
    it("ne replie pas sur un refus", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);
      const second = repond("celui-ci n'aurait pas dû être appelé");

      await expect(routeur.executer("message", DEMANDE, { anthropic: refuse(), deepseek: second }))
        .rejects.toBeInstanceOf(RefusModele);
      expect(second.appels).toBe(0);
    });

    // Le fournisseur va très bien : c'est la demande qui ne passe pas. Compter
    // ce refus finirait par écarter un modèle parfaitement sain.
    it("ne compte pas un refus dans les échecs consécutifs", async () => {
      const a = await modele("anthropic");
      await ranger([a.id]);
      for (let i = 0; i < SEUIL_PANNE + 1; i += 1)
        await routeur.executer("message", DEMANDE, { anthropic: refuse() }).catch(() => {});

      const apres = await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } });
      expect(apres.consecutiveFailures).toBe(0);
      expect(apres.outageUntil).toBeNull();
    });

    it("laisse quand même sa trace, avec le statut du refus", async () => {
      const a = await modele("anthropic");
      await ranger([a.id]);
      await routeur.executer("message", DEMANDE, { anthropic: refuse("content_policy") }).catch(() => {});
      const lignes = await usages();
      expect(lignes).toHaveLength(1);
      expect(lignes[0]!.status).toBe("refused");
      expect(lignes[0]!.errorCode).toBe("content_policy");
    });
  });

  describe("le disjoncteur", () => {
    it("écarte un modèle après le seuil d'échecs consécutifs", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);

      for (let i = 0; i < SEUIL_PANNE; i += 1)
        await routeur.executer("message", DEMANDE, { anthropic: tombe(), deepseek: repond() });

      const apres = await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } });
      expect(apres.outageUntil).not.toBeNull();
      expect(apres.outageUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it("n'écarte pas avant le seuil", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);

      for (let i = 0; i < SEUIL_PANNE - 1; i += 1)
        await routeur.executer("message", DEMANDE, { anthropic: tombe(), deepseek: repond() });

      expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } })).outageUntil).toBeNull();
    });

    /* CONSÉCUTIFS, pas cumulés. Compter les échecs cumulés écarterait un modèle
       qui rate une fois par semaine depuis six mois — c'est-à-dire un modèle
       qui va bien. */
    it("remet le compteur à zéro au premier succès", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);

      let tombera = true;
      const capricieux: Adaptateur = {
        async appeler(): Promise<ReponseIA> {
          if (tombera) throw new PanneFournisseur("502");
          return { contenu: "ça remarche" };
        },
      };

      for (let i = 0; i < SEUIL_PANNE - 1; i += 1)
        await routeur.executer("message", DEMANDE, { anthropic: capricieux, deepseek: repond() });
      tombera = false;
      await routeur.executer("message", DEMANDE, { anthropic: capricieux, deepseek: repond() });
      tombera = true;
      await routeur.executer("message", DEMANDE, { anthropic: capricieux, deepseek: repond() });

      const apres = await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } });
      expect(apres.consecutiveFailures).toBe(1);
      expect(apres.outageUntil).toBeNull();
    });

    /* LA propriété qui structure tout le chantier : le disjoncteur n'écrit
       jamais dans le champ de l'administration. Sinon une panne passagère
       éteindrait définitivement un modèle que personne ne penserait à
       rallumer. */
    it("n'éteint jamais l'interrupteur de l'administration", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);

      for (let i = 0; i < SEUIL_PANNE + 2; i += 1)
        await routeur.executer("message", DEMANDE, { anthropic: tombe(), deepseek: repond() });

      expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } })).enabled).toBe(true);
    });

    // Un succès sur le repli ne blanchit pas le primaire : ce sont deux modèles
    // distincts, et confondre leurs compteurs rendrait le disjoncteur inerte
    // dès qu'un repli fonctionne — c'est-à-dire toujours.
    it("compte par modèle, pas par tâche", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);

      await routeur.executer("message", DEMANDE, { anthropic: tombe(), deepseek: repond() });

      expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } })).consecutiveFailures).toBe(1);
      expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: b.id } })).consecutiveFailures).toBe(0);
    });
  });

  describe("la mesure", () => {
    /* Un repli laisse DEUX lignes. Sans la première, les pannes seraient
       gratuites dans les statistiques et la chaîne aurait l'air parfaite —
       alors qu'elle coûte le double en silence. */
    it("laisse une ligne par tentative, échouée comprise", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);

      await routeur.executer("message", DEMANDE, { anthropic: tombe("502"), deepseek: repond() });

      const lignes = await usages();
      expect(lignes.map((l) => [l.attempt, l.status])).toEqual([[1, "error"], [2, "success"]]);
    });

    it("distingue un délai dépassé d'une panne", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);
      await routeur.executer("message", DEMANDE, {
        anthropic: faux(() => new PanneFournisseur("timeout")), deepseek: repond(),
      });
      expect((await usages())[0]!.status).toBe("timeout");
    });

    it("estime le coût au tarif du catalogue, par million de jetons", async () => {
      const a = await modele("anthropic", { coutEntree: "3", coutSortie: "15" });
      await ranger([a.id]);

      await routeur.executer("message", DEMANDE, { anthropic: repond("ok", 1_000_000, 100_000) });

      const l = (await usages())[0]!;
      // 1 M × 3 + 0,1 M × 15 = 4,5
      expect(Number(l.cost)).toBeCloseTo(4.5, 6);
    });

    /* Non tarifé veut dire « on ne sait pas », jamais « gratuit ». Écrire zéro
       ferait une somme fausse qui a l'air juste — et personne ne va vérifier
       une facture qui tombe à zéro. */
    it("laisse le coût vide quand le modèle n'est pas tarifé", async () => {
      const a = await modele("anthropic");
      await ranger([a.id]);
      await routeur.executer("message", DEMANDE, { anthropic: repond("ok", 100, 50) });
      expect((await usages())[0]!.cost).toBeNull();
    });

    it("recopie le fournisseur et la clé, pour survivre au catalogue", async () => {
      const a = await modele("anthropic");
      await ranger([a.id]);
      await routeur.executer("message", DEMANDE, { anthropic: repond() });

      await db.prisma.aIModel.delete({ where: { id: a.id } });

      const l = (await usages())[0]!;
      expect(l.modelId).toBeNull();
      expect(l.provider).toBe("anthropic");
      expect(l.modelKey).toBe("anthropic-1");
    });
  });

  /* Le rattachement d'une dépense à sa cause.
   *
   * C'est la raison d'être de ces quatre champs, et la seule qui ne se rattrape
   * pas : on peut recalculer un coût, on ne peut pas deviner après coup à quoi
   * un appel servait. */
  describe("à quoi la dépense se rattache", () => {
    it("retient qui, pourquoi, ce qui a déclenché, et où retrouver la trace", async () => {
      const a = await modele("anthropic");
      await ranger([a.id]);
      const { userId, actionRunId } = await execution();

      await routeur.executer("message", DEMANDE, { anthropic: repond() }, {
        userId, actionRunId, origine: "user_action", correlationId: "corr-42",
      });

      const l = (await usages())[0]!;
      expect(l.userId).toBe(userId);
      expect(l.actionRunId).toBe(actionRunId);
      expect(l.origin).toBe("user_action");
      expect(l.correlationId).toBe("corr-42");
      expect(l.purpose).toBe("message");
    });

    /* L'origine sépare ce que le coût ne distingue pas. Sans elle, la facture
       des essais d'administration se confond avec celle de la production, et on
       ne peut répondre ni à « combien coûtent les réglages » ni à « combien
       coûtent les utilisateurs ». */
    it("distingue un essai d'administration d'une production réelle", async () => {
      const a = await modele("anthropic");
      await ranger([a.id]);

      await routeur.executer("message", DEMANDE, { anthropic: repond() }, { origine: "studio_trial" });
      await routeur.executer("message", DEMANDE, { anthropic: repond() }, { origine: "scheduled_job" });

      const parOrigine = await db.prisma.aIUsage.groupBy({
        by: ["origin"], _count: { _all: true },
      });
      const table = new Map(parOrigine.map((o) => [o.origin, o._count._all]));
      expect(table.get("studio_trial")).toBe(1);
      expect(table.get("scheduled_job")).toBe(1);
    });

    /* Un appel sans contexte reste `user_action` : c'est la valeur la plus
       coûteuse à confondre, donc celle qu'on veut voir en trop plutôt qu'en
       moins. Une passe de fond mal étiquetée gonfle la facture « utilisateur »
       et se remarque ; l'inverse passerait inaperçu. */
    it("retombe sur user_action quand rien n'est dit", async () => {
      const a = await modele("anthropic");
      await ranger([a.id]);
      await routeur.executer("message", DEMANDE, { anthropic: repond() });
      expect((await usages())[0]!.origin).toBe("user_action");
    });

    // Le repli laisse DEUX lignes, toutes deux rattachées à la même exécution :
    // c'est ainsi que le coût réel d'une production se somme.
    it("rattache toutes les tentatives d'un repli à la même exécution", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger([a.id, b.id]);
      const { userId, actionRunId } = await execution();

      await routeur.executer("message", DEMANDE, { anthropic: tombe(), deepseek: repond() },
        { userId, actionRunId });

      const lignes = await usages();
      expect(lignes).toHaveLength(2);
      for (const l of lignes) expect(l.actionRunId).toBe(actionRunId);
    });

    /* Effacer une exécution emporte ses lignes de dépense — `on delete cascade`.
       Les garder orphelines donnerait un coût qu'on ne saurait plus imputer, et
       qui fausserait la marge sans qu'on puisse dire d'où il vient. */
    it("emporte les dépenses avec l'exécution qu'on efface", async () => {
      const a = await modele("anthropic");
      await ranger([a.id]);
      const { userId, actionRunId } = await execution();
      await routeur.executer("message", DEMANDE, { anthropic: repond() }, { userId, actionRunId });

      await db.prisma.actionRun.delete({ where: { id: actionRunId } });
      expect(await db.prisma.aIUsage.count()).toBe(0);
    });
  });
});
