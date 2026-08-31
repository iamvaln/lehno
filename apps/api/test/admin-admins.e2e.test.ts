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

describe("administration — les comptes d'exploitation", () => {
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

  const session = async (role: "support" | "admin", email = `${role}@lehno.app`) => {
    const compte = await db.prisma.admin.create({ data: { email, role } });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { compte, entete: { authorization: `Bearer ${accessToken}` } };
  };

  const appeler = (methode: string, chemin: string, entete: Record<string, string>, corps?: unknown) =>
    fetch(`${baseUrl}/v1/admin/admins${chemin}`, {
      method: methode,
      headers: { "content-type": "application/json", ...entete },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });

  it("la section entière est réservée aux administrateurs", async () => {
    const { entete } = await session("support");
    expect((await appeler("GET", "", entete)).status).toBe(403);
    expect((await appeler("POST", "", entete, { email: "x@lehno.app", reason: "Arrivée dans l'équipe" })).status).toBe(403);
  });

  it("liste les comptes, sans jamais rendre de secret", async () => {
    const { entete } = await session("admin");
    const res = await appeler("GET", "", entete);
    expect(res.status).toBe(200);
    const texte = await res.text();
    expect(JSON.parse(texte).items[0]).toMatchObject({ email: "admin@lehno.app", role: "admin", isActive: true });
    // Ni jeton, ni condensé : la liste dit qui a accès, pas comment y entrer.
    for (const interdit of ["codeHash", "tokenHash", "code_hash", "token_hash"])
      expect(texte).not.toContain(interdit);
  });

  it("inviter crée un compte support et le journalise", async () => {
    const { compte, entete } = await session("admin");

    const res = await appeler("POST", "", entete, {
      email: "dora@lehno.app", displayName: "Dora", reason: "Renfort à l'assistance",
    });
    expect(res.status).toBe(201);

    const cree = await db.prisma.admin.findUniqueOrThrow({ where: { email: "dora@lehno.app" } });
    // Le moindre privilège : on entre en support, on monte ensuite si besoin.
    expect(cree.role).toBe("support");

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "admin_invite" } });
    expect(trace.actorId).toBe(compte.id);
    expect(trace.targetId).toBe(cree.id);
  });

  it("inviter sans motif est refusé", async () => {
    const { entete } = await session("admin");
    const res = await appeler("POST", "", entete, { email: "dora@lehno.app" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await db.prisma.admin.count()).toBe(1);
  });

  it("une adresse déjà invitée est refusée", async () => {
    const { entete } = await session("admin");
    await appeler("POST", "", entete, { email: "dora@lehno.app", reason: "Renfort à l'assistance" });
    const res = await appeler("POST", "", entete, { email: "DORA@lehno.app", reason: "Deuxième essai" });
    expect(res.status).toBe(409);
    expect(await db.prisma.admin.count()).toBe(2);
  });

  it("changer de rôle est journalisé avec le rôle quitté", async () => {
    const { entete } = await session("admin");
    const dora = await db.prisma.admin.create({ data: { email: "dora@lehno.app" } });

    const res = await appeler("PATCH", `/${dora.id}`, entete, { role: "admin", reason: "Prend les paramètres en charge", reasonCode: "taking_responsibility" });
    expect(res.status).toBe(200);

    expect((await db.prisma.admin.findUniqueOrThrow({ where: { id: dora.id } })).role).toBe("admin");
    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "admin_role_update" } });
    expect(trace.metadata).toMatchObject({ from: "support", to: "admin" });
  });

  it("révoquer désactive le compte plutôt que de l'effacer", async () => {
    const { entete } = await session("admin");
    const dora = await db.prisma.admin.create({ data: { email: "dora@lehno.app" } });

    const res = await appeler("DELETE", `/${dora.id}`, entete, { reason: "A quitté l'équipe", reasonCode: "left_the_team" });
    expect(res.status).toBe(200);

    // Effacer la ligne emporterait ses gestes passés hors de portée : le
    // journal garde un actor_id, et il doit encore désigner quelqu'un.
    const apres = await db.prisma.admin.findUniqueOrThrow({ where: { id: dora.id } });
    expect(apres.isActive).toBe(false);
  });

  // Un outil qui laisse fermer la dernière porte derrière soi est un outil
  // cassé : plus personne ne peut rétablir qui que ce soit.
  it("on ne se révoque pas soi-même", async () => {
    const { compte, entete } = await session("admin");
    const res = await appeler("DELETE", `/${compte.id}`, entete, { reason: "Essai de révocation de soi", reasonCode: "left_the_team" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await db.prisma.admin.findUniqueOrThrow({ where: { id: compte.id } })).isActive).toBe(true);
  });

  it("on ne se rétrograde pas soi-même", async () => {
    const { compte, entete } = await session("admin");
    const res = await appeler("PATCH", `/${compte.id}`, entete, { role: "support", reason: "Essai de rétrogradation", reasonCode: "change_of_post" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await db.prisma.admin.findUniqueOrThrow({ where: { id: compte.id } })).role).toBe("admin");
  });

  // La révocation doit mordre tout de suite : la garde recharge le compte à
  // chaque appel, donc une session ouverte s'éteint au geste suivant.
  it("un compte révoqué perd sa session en cours", async () => {
    const { entete } = await session("admin");
    const dora = await session("admin", "dora@lehno.app");

    await appeler("DELETE", `/${dora.compte.id}`, entete, { reason: "A quitté l'équipe", reasonCode: "left_the_team" });

    expect((await appeler("GET", "", dora.entete)).status).toBe(401);
  });
});
