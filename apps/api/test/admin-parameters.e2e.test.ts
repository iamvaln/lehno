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

describe("administration — les paramètres du système", () => {
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

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    // system_parameter est une table de référence : la migration l'amorce et
    // resetDatabase la préserve (voir db.ts). On remet donc les valeurs semées
    // plutôt que de les créer — un test qui a monté le prix ne doit pas décider
    // du point de départ du suivant.
    await db.prisma.systemParameter.update({
      where: { key: "credit_unit_price" }, data: { value: "100" },
    });
    await db.prisma.systemParameter.update({
      where: { key: "signup_free_credits" }, data: { value: "5" },
    });
  });
  afterAll(async () => { await app?.close(); await db.close(); });

  const session = async (role: "support" | "admin") => {
    const compte = await db.prisma.admin.create({
      data: { email: `${role}@lehno.app`, role },
    });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { compte, entete: { authorization: `Bearer ${accessToken}` } };
  };

  const patch = (entete: Record<string, string>, corps: unknown) =>
    fetch(`${baseUrl}/v1/admin/parameters`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...entete },
      body: JSON.stringify(corps),
    });

  it("refuse une lecture sans session", async () => {
    const res = await fetch(`${baseUrl}/v1/admin/parameters`);
    expect(res.status).toBe(401);
  });

  it("rend les paramètres à une session ouverte", async () => {
    const { entete } = await session("support");
    const res = await fetch(`${baseUrl}/v1/admin/parameters`, { headers: entete });
    expect(res.status).toBe(200);
    const corps = (await res.json()) as { items: { key: string; value: string }[] };
    const clefs = corps.items.map((p) => p.key);
    expect(clefs).toContain("credit_unit_price");
    expect(clefs).toContain("signup_free_credits");
  });

  // « Modifier les paramètres globaux » appartient au rôle admin (ux-admin §6).
  // L'interface le masque, mais c'est le serveur qui refuse.
  it("un support ne peut pas écrire", async () => {
    const { entete } = await session("support");
    const res = await patch(entete, { key: "credit_unit_price", value: "150", reason: "Hausse décidée en comité" });
    expect(res.status).toBe(403);
    const apres = await db.prisma.systemParameter.findUniqueOrThrow({ where: { key: "credit_unit_price" } });
    expect(apres.value).toBe("100");
  });

  // « Sans motif, la requête échoue » (spec §7). Le service refuse avant la
  // base, pour rendre une erreur propre plutôt qu'une violation de contrainte.
  it("une écriture sans motif est refusée, et n'écrit rien", async () => {
    const { entete } = await session("admin");
    const res = await patch(entete, { key: "credit_unit_price", value: "150" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const apres = await db.prisma.systemParameter.findUniqueOrThrow({ where: { key: "credit_unit_price" } });
    expect(apres.value).toBe("100");
    expect(await db.prisma.auditLog.count()).toBe(0);
  });

  it("un motif trop court est refusé comme un motif absent", async () => {
    const { entete } = await session("admin");
    const res = await patch(entete, { key: "credit_unit_price", value: "150", reason: "non" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await db.prisma.auditLog.count()).toBe(0);
  });

  it("un administrateur écrit, et le journal garde la valeur quittée", async () => {
    const { compte, entete } = await session("admin");
    const res = await patch(entete, {
      key: "credit_unit_price", value: "150", reason: "Hausse décidée en comité",
    });
    expect(res.status).toBe(200);

    const apres = await db.prisma.systemParameter.findUniqueOrThrow({ where: { key: "credit_unit_price" } });
    expect(apres.value).toBe("150");

    const trace = await db.prisma.auditLog.findFirstOrThrow();
    expect(trace.actorType).toBe("admin");
    expect(trace.actorId).toBe(compte.id);
    expect(trace.action).toBe("parameter_update");
    expect(trace.reason).toBe("Hausse décidée en comité");
    expect(trace.targetType).toBe("system_parameter");
    // La valeur quittée est ce qui rend le journal lisible : « il valait 100 »
    // se relit, « il a changé » ne dit rien.
    expect(trace.metadata).toMatchObject({ from: "100", to: "150" });
  });

  it("une clé inconnue est refusée, et ne crée pas de paramètre", async () => {
    const { entete } = await session("admin");
    const avant = await db.prisma.systemParameter.count();
    const res = await patch(entete, { key: "clef_inventee", value: "1", reason: "Essai de création" });
    expect(res.status).toBe(404);
    expect(await db.prisma.systemParameter.count()).toBe(avant);
  });

  // La valeur est typée en base : accepter « beaucoup » pour un prix rendrait
  // /v1/public/config incapable de servir un nombre.
  it("une valeur qui ne tient pas dans son type est refusée", async () => {
    const { entete } = await session("admin");
    const res = await patch(entete, { key: "credit_unit_price", value: "beaucoup", reason: "Essai de valeur libre" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const apres = await db.prisma.systemParameter.findUniqueOrThrow({ where: { key: "credit_unit_price" } });
    expect(apres.value).toBe("100");
  });
});
