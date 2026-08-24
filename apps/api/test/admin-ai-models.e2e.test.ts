import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";

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

  const modele = (provider: string, priority: number, enabled = true) =>
    db.prisma.aIModel.create({ data: { provider, modelKey: `${provider}-1`, priority, enabled } });

  const lire = (entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/admin/ai-models`, { headers: entete });

  const ecrire = (entete: Record<string, string>, corps: unknown) =>
    fetch(`${baseUrl}/v1/admin/ai-models`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...entete },
      body: JSON.stringify(corps),
    });

  it("la lecture reste au support, l'écriture non", async () => {
    await modele("anthropic", 1);
    const support = await session("support");

    expect((await lire(support.entete)).status).toBe(200);
    const res = await ecrire(support.entete, { id: (await db.prisma.aIModel.findFirstOrThrow()).id, enabled: false, reason: "Essai depuis le support" });
    expect(res.status).toBe(403);
  });

  // L'ordre de la liste est celui du routage : le plus bas passe en premier.
  // Rendre les modèles dans le désordre obligerait l'écran à les retrier, et
  // deux tris valent mieux qu'un seul quand ils divergent.
  it("rend les modèles dans l'ordre du routage", async () => {
    await modele("deepseek", 3);
    await modele("anthropic", 1);
    await modele("xai", 2);
    const { entete } = await session("admin");

    const corps = (await (await lire(entete)).json()) as { items: { provider: string }[] };
    expect(corps.items.map((m) => m.provider)).toEqual(["anthropic", "xai", "deepseek"]);
  });

  it("changer la priorité est journalisé avec la valeur quittée", async () => {
    const m = await modele("anthropic", 1);
    const { entete } = await session("admin");

    const res = await ecrire(entete, { id: m.id, priority: 5, reason: "Coût en hausse, passe en repli" });
    expect(res.status).toBe(200);

    expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: m.id } })).priority).toBe(5);
    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "ai_model_update" } });
    expect(trace.metadata).toMatchObject({ priority: { from: 1, to: 5 } });
  });

  it("une écriture sans motif ne change rien", async () => {
    const m = await modele("anthropic", 1);
    const { entete } = await session("admin");

    const res = await ecrire(entete, { id: m.id, enabled: false });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: m.id } })).enabled).toBe(true);
    expect(await db.prisma.auditLog.count()).toBe(0);
  });

  // Le garde-fou qui compte : désactiver le dernier modèle actif couperait
  // toute génération, sans que rien ne le dise avant la première panne.
  it("le dernier modèle actif ne peut pas être désactivé", async () => {
    const seul = await modele("anthropic", 1);
    await modele("deepseek", 2, false);
    const { entete } = await session("admin");

    const res = await ecrire(entete, { id: seul.id, enabled: false, reason: "Essai de coupure totale" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: seul.id } })).enabled).toBe(true);
  });

  it("mais l'avant-dernier peut l'être", async () => {
    const a = await modele("anthropic", 1);
    await modele("deepseek", 2);
    const { entete } = await session("admin");

    const res = await ecrire(entete, { id: a.id, enabled: false, reason: "Taux d'échec au-dessus du seuil" });
    expect(res.status).toBe(200);
    expect((await db.prisma.aIModel.findUniqueOrThrow({ where: { id: a.id } })).enabled).toBe(false);
  });
});
