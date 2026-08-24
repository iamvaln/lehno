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

describe("administration — les deux lectures de suivi", () => {
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

  const lire = (chemin: string, entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/admin/${chemin}`, { headers: entete });

  describe("le journal d'audit", () => {
    const consigner = (adminId: string, action: string, over: Record<string, unknown> = {}) =>
      db.prisma.auditLog.create({
        data: {
          actorType: "admin", actorId: adminId, action,
          reason: "Motif de démonstration", ...over,
        },
      });

    // « Le journal d'audit est réservé aux administrateurs — c'est ce qui lui
    // donne sa valeur de contrôle sur le travail de l'équipe » (ux-admin §6).
    // Le paquet de passation l'ouvrait au support ; c'est la spec qui tranche.
    it("est refusé au support", async () => {
      const { entete } = await session("support");
      expect((await lire("audit-log", entete)).status).toBe(403);
    });

    it("est lisible par un administrateur", async () => {
      const { compte, entete } = await session("admin");
      await consigner(compte.id, "user_status_update");

      const res = await lire("audit-log", entete);
      expect(res.status).toBe(200);
      const corps = (await res.json()) as { items: { action: string; reason: string }[] };
      expect(corps.items[0]?.action).toBe("user_status_update");
      expect(corps.items[0]?.reason).toBe("Motif de démonstration");
    });

    it("filtre par action et par auteur", async () => {
      const { compte, entete } = await session("admin");
      const autre = await db.prisma.admin.create({ data: { email: "dora@lehno.app", role: "admin" } });
      await consigner(compte.id, "user_status_update");
      await consigner(autre.id, "parameter_update");

      const parAction = (await (await lire("audit-log?action=parameter_update", entete)).json()) as { items: unknown[] };
      expect(parAction.items).toHaveLength(1);

      const parAuteur = (await (await lire(`audit-log?actorId=${autre.id}`, entete)).json()) as { items: unknown[] };
      expect(parAuteur.items).toHaveLength(1);
    });

    it("rend le plus récent en tête", async () => {
      const { compte, entete } = await session("admin");
      await consigner(compte.id, "ancien", { createdAt: new Date(Date.now() - 60_000) });
      await consigner(compte.id, "recent");

      const corps = (await (await lire("audit-log", entete)).json()) as { items: { action: string }[] };
      expect(corps.items.map((e) => e.action)).toEqual(["recent", "ancien"]);
    });

    // Une trace qui fait foi ne se modifie ni ne s'efface : la section est en
    // lecture seule, et il n'existe aucun chemin d'écriture depuis l'extérieur.
    it("n'offre aucune écriture", async () => {
      const { entete } = await session("admin");
      for (const methode of ["POST", "PATCH", "DELETE"]) {
        const res = await fetch(`${baseUrl}/v1/admin/audit-log`, { method: methode, headers: entete });
        expect(res.status).toBe(404);
      }
    });
  });

  describe("les connexions", () => {
    const tenter = (result: "success" | "failure", over: Record<string, unknown> = {}) =>
      db.prisma.loginActivity.create({
        data: { result, attemptedEmail: "awa@example.com", ...over },
      });

    // « Consulter le tableau de bord, les métriques, les connexions » appartient
    // au support (ux-admin §6) : c'est ce qu'on regarde pour répondre à
    // quelqu'un qui n'arrive pas à entrer.
    it("sont lisibles par le support", async () => {
      const { entete } = await session("support");
      await tenter("failure");

      const res = await lire("login-activity", entete);
      expect(res.status).toBe(200);
      const corps = (await res.json()) as { items: { result: string }[] };
      expect(corps.items[0]?.result).toBe("failure");
    });

    it("filtrent par résultat", async () => {
      const { entete } = await session("support");
      await tenter("success");
      await tenter("failure");

      const corps = (await (await lire("login-activity?result=failure", entete)).json()) as { items: { result: string }[] };
      expect(corps.items.map((l) => l.result)).toEqual(["failure"]);
    });

    it("filtrent par période", async () => {
      const { entete } = await session("support");
      await tenter("success", { createdAt: new Date("2026-01-01T00:00:00Z") });
      await tenter("failure");

      const corps = (await (await lire("login-activity?since=2026-06-01T00:00:00.000Z", entete)).json()) as { items: unknown[] };
      expect(corps.items).toHaveLength(1);
    });
  });
});
