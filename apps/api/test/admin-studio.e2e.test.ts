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

describe("administration — les gabarits du studio", () => {
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

  const chemin = "/v1/admin/portrait-studio/templates";
  const appeler = (methode: string, suffixe: string, entete: Record<string, string>, corps?: unknown) =>
    fetch(`${baseUrl}${chemin}${suffixe}`, {
      method: methode,
      headers: { "content-type": "application/json", ...entete },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });

  const gabarit = (over: Record<string, unknown> = {}) => ({
    kind: "message", key: "gratitude",
    body: "Écris deux à quatre phrases à la première personne, sans superlatif.",
    reason: "Première version du gabarit de gratitude",
    ...over,
  });

  it("le support consulte, il ne règle pas", async () => {
    const { entete } = await session("support");
    expect((await appeler("GET", "", entete)).status).toBe(200);
    expect((await appeler("POST", "", entete, gabarit())).status).toBe(403);
  });

  it("créer un gabarit l'active et le journalise", async () => {
    const { compte, entete } = await session("admin");

    const res = await appeler("POST", "", entete, gabarit());
    expect(res.status).toBe(201);
    const cree = (await res.json()) as { id: string; version: number; isActive: boolean };
    expect(cree.version).toBe(1);
    expect(cree.isActive).toBe(true);

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "prompt_template_create" } });
    expect(trace.actorId).toBe(compte.id);
  });

  // « Les versions ne se modifient pas. » Ajuster crée une version nouvelle ;
  // l'ancienne demeure, ce qui permet d'y revenir et de comprendre un écart de
  // qualité. Sans ça, la question « pourquoi les productions d'hier valaient
  // mieux » n'a pas de réponse.
  it("ajuster crée une version, sans toucher à la précédente", async () => {
    const { entete } = await session("admin");
    const premier = (await (await appeler("POST", "", entete, gabarit())).json()) as { id: string; body: string };

    const second = (await (await appeler("POST", "", entete, gabarit({
      body: "Écris trois phrases, et bannis les formules de carte de vœux.",
      reason: "Les résultats partaient dans la carte de vœux",
    }))).json()) as { id: string; version: number; isActive: boolean };

    expect(second.version).toBe(2);
    expect(second.id).not.toBe(premier.id);

    const ancien = await db.prisma.promptTemplate.findUniqueOrThrow({ where: { id: premier.id } });
    expect(ancien.body).toBe(premier.body);
    // Une seule version active : la nouvelle prend la main, l'ancienne se range.
    expect(ancien.isActive).toBe(false);
  });

  // La règle vit dans un index unique partiel. Une seconde version active ne se
  // verrait pas : la génération en prendrait une au hasard, et l'écart de
  // qualité resterait inexplicable — ce que le versionnage sert justement à éviter.
  it("la base refuse deux versions actives pour un même gabarit", async () => {
    const { entete } = await session("admin");
    await appeler("POST", "", entete, gabarit());
    const actif = await db.prisma.promptTemplate.findFirstOrThrow({ where: { isActive: true } });

    await expect(
      db.prisma.promptTemplate.create({
        data: { kind: "message", key: "gratitude", version: 99, body: "x", isActive: true },
      }),
    ).rejects.toThrow();

    expect((await db.prisma.promptTemplate.findUniqueOrThrow({ where: { id: actif.id } })).isActive).toBe(true);
  });

  it("revenir à une version antérieure la réactive, et le journal le dit", async () => {
    const { entete } = await session("admin");
    const premier = (await (await appeler("POST", "", entete, gabarit())).json()) as { id: string };
    await appeler("POST", "", entete, gabarit({ body: "Version deux.", reason: "Essai d'un autre ton" }));

    const res = await appeler("PATCH", `/${premier.id}`, entete, {
      isActive: true, reason: "La version deux produisait des formules toutes faites",
    });
    expect(res.status).toBe(200);

    expect((await db.prisma.promptTemplate.findUniqueOrThrow({ where: { id: premier.id } })).isActive).toBe(true);
    expect(await db.prisma.promptTemplate.count({ where: { kind: "message", key: "gratitude", isActive: true } })).toBe(1);
    await db.prisma.auditLog.findFirstOrThrow({ where: { action: "prompt_template_activate" } });
  });

  it("un gabarit rend son historique, le plus récent en tête", async () => {
    const { entete } = await session("admin");
    await appeler("POST", "", entete, gabarit());
    await appeler("POST", "", entete, gabarit({ body: "Version deux.", reason: "Essai d'un autre ton" }));

    const corps = (await (await appeler("GET", "?kind=message&key=gratitude", entete)).json()) as {
      items: { version: number }[];
    };
    expect(corps.items.map((g) => g.version)).toEqual([2, 1]);
  });

  it("créer sans motif ne laisse rien", async () => {
    const { entete } = await session("admin");
    const res = await appeler("POST", "", entete, { kind: "message", key: "gratitude", body: "x" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await db.prisma.promptTemplate.count()).toBe(0);
  });
});
