import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { catalogueIaSchema, chainesIaSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("administration — les modèles d'IA", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let jetons: AdminTokenService;

  beforeAll(async () => {
    db = await withDatabase();
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    process.env.LEHNO_MAIL_CONSOLE = "1";
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
    jetons = app.get(AdminTokenService);
  }, 180_000);

  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await app?.close(); await db.close(); });

  const session = async (role: "support" | "admin") => {
    const compte = await db.prisma.admin.create({ data: { email: `${role}@lehno.app`, role } });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { compte, entete: { authorization: `Bearer ${accessToken}` } };
  };

  /* Six caractères au moins, sinon le journal refuse et l'écriture tombe pour
     « motif manquant » — un refus qui ressemble à s'y méprendre à celui qu'on
     croyait éprouver. C'est ce qui a fait passer trois de ces cas pour de
     bonnes raisons alors qu'ils ne prouvaient rien. */
  const MOTIF = "Motif d'essai";

  const modele = (provider: string, enabled = true, capability: "text" | "image" = "text") =>
    db.prisma.aIModel.create({ data: { provider, modelKey: `${provider}-1`, enabled, capability } });

  const ranger = (task: string, ids: string[]) =>
    db.prisma.aITaskRoute.createMany({
      data: ids.map((modelId, i) => ({ task: task as never, modelId, rank: i + 1 })),
    });

  const lire = (entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/admin/ai-models`, { headers: entete });

  const ecrire = (entete: Record<string, string>, corps: unknown) =>
    fetch(`${baseUrl}/v1/admin/ai-models`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...entete },
      body: JSON.stringify(corps),
    });

  const lireChaines = (entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/admin/ai-routes`, { headers: entete });

  const ecrireChaine = (entete: Record<string, string>, corps: unknown) =>
    fetch(`${baseUrl}/v1/admin/ai-routes`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...entete },
      body: JSON.stringify(corps),
    });

  it("le catalogue suit le contrat publié, au champ près", async () => {
    await modele("anthropic");
    const { entete } = await session("admin");
    const corps = await (await lire(entete)).json();
    const valide = catalogueIaSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  it("les chaînes suivent le contrat publié, au champ près", async () => {
    const a = await modele("anthropic");
    await ranger("message", [a.id]);
    const { entete } = await session("admin");
    const corps = await (await lireChaines(entete)).json();
    const valide = chainesIaSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  it("la lecture reste au support, l'écriture non", async () => {
    const m = await modele("anthropic");
    const support = await session("support");

    expect((await lire(support.entete)).status).toBe(200);
    expect((await lireChaines(support.entete)).status).toBe(200);
    const res = await ecrire(support.entete, { id: m.id, enabled: false, reason: "Essai depuis le support", reasonCode: "failure_rate_too_high" });
    expect(res.status).toBe(403);
  });

  it("une écriture sans motif ne change rien", async () => {
    const m = await modele("anthropic");
    const { entete } = await session("admin");

    const res = await ecrire(entete, { id: m.id, enabled: false });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: m.id } })).enabled).toBe(true);
    expect(await db.prisma.auditLog.count()).toBe(0);
  });

  describe("les deux interrupteurs", () => {
    /* LE piège du chantier. Si l'admin et le disjoncteur écrivaient au même
       endroit, lever la panne rallumerait un modèle volontairement coupé. */
    it("lever une panne ne rallume pas un modèle coupé à la main", async () => {
      const a = await modele("anthropic", false);
      const b = await modele("deepseek");
      await ranger("message", [a.id, b.id]);
      await db.prisma.aIModel.update({
        where: { id: a.id },
        data: { outageUntil: new Date(Date.now() + 60_000), consecutiveFailures: 3 },
      });
      const { entete } = await session("admin");

      const res = await ecrire(entete, { id: a.id, clearOutage: true, reason: "Le fournisseur est revenu", reasonCode: "back_to_normal" });
      expect(res.status).toBe(200);

      const apres = await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } });
      expect(apres.outageUntil).toBeNull();
      // L'interrupteur de l'admin n'a pas bougé : c'est toute la propriété.
      expect(apres.enabled).toBe(false);
    });

    /* Laisser le compteur à trois ferait rebasculer en panne au premier échec
       suivant : la levée manuelle n'aurait servi qu'une seule requête. */
    it("lever une panne remet le compteur d'échecs à zéro", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger("message", [a.id, b.id]);
      await db.prisma.aIModel.update({
        where: { id: a.id },
        data: { outageUntil: new Date(Date.now() + 60_000), consecutiveFailures: 3 },
      });
      const { entete } = await session("admin");

      await ecrire(entete, { id: a.id, clearOutage: true, reason: "Le fournisseur est revenu", reasonCode: "back_to_normal" });
      expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } })).consecutiveFailures).toBe(0);
    });

    // Une panne expirée n'est plus une panne : la rendre encore ferait chercher
    // une indisponibilité qui n'existe plus.
    it("ne rend pas une panne dont l'heure est passée", async () => {
      const a = await modele("anthropic");
      await db.prisma.aIModel.update({
        where: { id: a.id },
        data: { outageUntil: new Date(Date.now() - 1_000), outageReason: "502" },
      });
      const { entete } = await session("admin");

      const corps = (await (await lire(entete)).json()) as { items: { enPanneJusquA: string | null }[] };
      expect(corps.items[0]!.enPanneJusquA).toBeNull();
    });
  });

  describe("couper un modèle", () => {
    /* Le garde-fou qui compte : c'est le geste qu'on pose à trois heures du
       matin en éteignant ce qui échoue, et il couperait toute génération sans
       que rien ne le dise avant le premier appel. */
    it("refuse de vider la chaîne d'une tâche", async () => {
      const seul = await modele("anthropic");
      await ranger("message", [seul.id]);
      const { entete } = await session("admin");

      const res = await ecrire(entete, { id: seul.id, enabled: false, reason: "Essai de coupure totale", reasonCode: "failure_rate_too_high" });
      expect(((await res.json()) as { code: string }).code).toBe("validation_failed");
      expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: seul.id } })).enabled).toBe(true);
    });

    it("laisse couper dès qu'un autre modèle de la chaîne reste actif", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger("message", [a.id, b.id]);
      const { entete } = await session("admin");

      const res = await ecrire(entete, { id: a.id, enabled: false, reason: "Taux d'échec au-dessus du seuil", reasonCode: "failure_rate_too_high" });
      expect(res.status).toBe(200);
      expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } })).enabled).toBe(false);
    });

    /* Le refus se juge TÂCHE PAR TÂCHE. Un catalogue riche en modèles de texte
       ne sauve pas la tâche d'image dont on vient de couper le dernier — et un
       comptage global laisserait justement passer ce cas. */
    it("juge tâche par tâche, pas sur le catalogue entier", async () => {
      const t1 = await modele("anthropic");
      const t2 = await modele("deepseek");
      await ranger("message", [t1.id, t2.id]);
      const img = await modele("xai", true, "image");
      await ranger("illustration", [img.id]);
      const { entete } = await session("admin");

      const res = await ecrire(entete, { id: img.id, enabled: false, reason: MOTIF, reasonCode: "failure_rate_too_high" });
      expect(((await res.json()) as { code: string }).code).toBe("validation_failed");
      expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: img.id } })).enabled).toBe(true);
    });
  });

  describe("régler une chaîne", () => {
    it("réordonne d'un bloc, et journalise l'ordre quitté", async () => {
      const a = await modele("anthropic");
      const b = await modele("deepseek");
      await ranger("message", [a.id, b.id]);
      const { entete } = await session("admin");

      const res = await ecrireChaine(entete, {
        task: "message", modelIds: [b.id, a.id], reason: "Le primaire coûte trop cher",
      });
      expect(res.status).toBe(200);

      const apres = await db.prisma.aITaskRoute.findMany({
        where: { task: "message" }, orderBy: { rank: "asc" }, select: { modelId: true },
      });
      expect(apres.map((r) => r.modelId)).toEqual([b.id, a.id]);

      const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "ai_route_update" } });
      expect(trace.metadata).toMatchObject({ from: ["anthropic:anthropic-1", "deepseek:deepseek-1"] });
    });

    /* Un modèle de texte rangé sur une tâche d'image n'échouerait pas à la
       configuration mais à la première génération, en production, sur un
       contenu déjà facturé. Le refus doit être au serveur. */
    it("refuse un modèle de texte sur une tâche d'image", async () => {
      const texte = await modele("anthropic");
      const image = await modele("xai", true, "image");
      await ranger("illustration", [image.id]);
      const { entete } = await session("admin");

      const res = await ecrireChaine(entete, {
        task: "illustration", modelIds: [texte.id], reason: MOTIF,
      });
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe("validation_failed");
      // Et la chaîne d'avant est intacte : un refus n'écrit rien.
      const apres = await db.prisma.aITaskRoute.findMany({ where: { task: "illustration" } });
      expect(apres.map((r) => r.modelId)).toEqual([image.id]);
    });

    it("refuse un modèle d'image sur une tâche de texte", async () => {
      const image = await modele("xai", true, "image");
      const { entete } = await session("admin");
      const res = await ecrireChaine(entete, { task: "message", modelIds: [image.id], reason: MOTIF });
      expect(((await res.json()) as { code: string }).code).toBe("validation_failed");
    });

    // Le même modèle deux fois ferait « réessayer » sur celui qui vient
    // d'échouer. Ce n'est pas un repli.
    it("refuse le même modèle deux fois dans une chaîne", async () => {
      const a = await modele("anthropic");
      const { entete } = await session("admin");
      const res = await ecrireChaine(entete, { task: "message", modelIds: [a.id, a.id], reason: MOTIF });
      expect(((await res.json()) as { code: string }).code).toBe("validation_failed");
    });

    it("refuse une chaîne dont aucun modèle n'est actif", async () => {
      const a = await modele("anthropic", false);
      const { entete } = await session("admin");
      const res = await ecrireChaine(entete, { task: "message", modelIds: [a.id], reason: MOTIF });
      expect(((await res.json()) as { code: string }).code).toBe("validation_failed");
    });

    /* Refuser une chaîne courte rendrait les tâches d'image inconfigurables :
       deux fournisseurs seulement en produisent. C'est un avertissement. */
    it("accepte une chaîne courte, mais le dit", async () => {
      const a = await modele("anthropic");
      const { entete } = await session("admin");

      expect((await ecrireChaine(entete, { task: "message", modelIds: [a.id], reason: "Un seul pour l'instant" })).status).toBe(200);

      const corps = (await (await lireChaines(entete)).json()) as {
        items: { tache: string; avertissements: { code: string }[] }[];
      };
      const msg = corps.items.find((c) => c.tache === "message")!;
      expect(msg.avertissements.map((a) => a.code)).toContain("chaine_courte");
    });

    /* Trois modèles du même hébergeur, c'est une chaîne qu'une seule panne
       emporte en entier — donc un repli qui n'aura jamais lieu. On le dit sans
       l'interdire : c'est un jugement d'exploitation. */
    it("signale une chaîne dont un fournisseur est répété", async () => {
      const a = await db.prisma.aIModel.create({ data: { provider: "anthropic", modelKey: "opus" } });
      const b = await db.prisma.aIModel.create({ data: { provider: "anthropic", modelKey: "sonnet" } });
      const { entete } = await session("admin");

      await ecrireChaine(entete, { task: "message", modelIds: [a.id, b.id], reason: MOTIF });

      const corps = (await (await lireChaines(entete)).json()) as {
        items: { tache: string; avertissements: { code: string }[] }[];
      };
      const msg = corps.items.find((c) => c.tache === "message")!;
      expect(msg.avertissements.map((a) => a.code)).toContain("fournisseur_repete");
    });
  });

  /* Le câblage du motif, éprouvé là où il se joue : allumer et éteindre sont
     deux gestes sous une même action journalisée, et leurs listes n'ont aucun
     motif en commun. Sans cette distinction, « taux d'échec trop haut »
     expliquerait une remise en service. */
  describe("le code du motif", () => {
    it("refuse une coupure sans code", async () => {
      const { entete } = await session("admin");
      const a = await modele("anthropic", true);
      const res = await ecrire(entete, { id: a.id, enabled: false, reason: "Taux d'échec au-dessus du seuil" });
      expect(res.status).toBe(422);
      expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } })).enabled).toBe(true);
    });

    it("refuse le code de l'allumage sur une coupure", async () => {
      const { entete } = await session("admin");
      const a = await modele("anthropic", true);
      const res = await ecrire(entete, {
        id: a.id, enabled: false, reason: "Taux d'échec au-dessus du seuil",
        reasonCode: "back_to_normal",
      });
      expect(res.status).toBe(422);
    });

    it("garde le code à côté de la phrase", async () => {
      const { entete } = await session("admin");
      const a = await modele("anthropic", true);
      await ecrire(entete, {
        id: a.id, enabled: false, reason: "Taux d'échec au-dessus du seuil",
        reasonCode: "failure_rate_too_high",
      });
      const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "ai_model_update" } });
      expect(trace.reasonCode).toBe("failure_rate_too_high");
      expect(trace.reason).toBe("Taux d'échec au-dessus du seuil");
    });
  });
});
