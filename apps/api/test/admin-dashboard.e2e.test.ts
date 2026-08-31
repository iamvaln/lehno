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
const JOUR = 24 * 60 * 60_000;

describe("administration — le tableau de bord", () => {
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

  const tableau = (entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/admin/dashboard`, { headers: entete });

  const enAttente = (n: number, ilYA: number) =>
    db.prisma.user.create({
      data: {
        email: `d${n}@example.com`, username: `d${n}`, referralCode: `D${n}`,
        status: "pending_deletion", deletionRequestedAt: new Date(Date.now() - ilYA * JOUR),
      },
    });

  it("refuse sans session", async () => {
    expect((await fetch(`${baseUrl}/v1/admin/dashboard`)).status).toBe(401);
  });

  it("est ouvert au support — c'est l'accueil de l'outil", async () => {
    const { entete } = await session("support");
    expect((await tableau(entete)).status).toBe(200);
  });

  // « Le panel s'ouvre sur ce qui ne va pas, avant tout chiffre » : trois
  // alertes au plus, sur une ligne. Une quatrième casserait le rang à l'écran.
  it("ne rend jamais plus de trois alertes", async () => {
    for (let i = 0; i < 6; i += 1) {
      await enAttente(i, 40);
      await db.prisma.loginActivity.create({ data: { result: "failure", attemptedEmail: `x${i}@e.com` } });
    }
    const { entete } = await session("admin");

    const corps = (await (await tableau(entete)).json()) as { alertes: unknown[] };
    expect(corps.alertes.length).toBeLessThanOrEqual(3);
  });

  it("compte les comptes par état", async () => {
    await db.prisma.user.create({ data: { email: "a@e.com", username: "a", referralCode: "A" } });
    await db.prisma.user.create({ data: { email: "b@e.com", username: "b", referralCode: "B", status: "suspended" } });
    const { entete } = await session("admin");

    const corps = (await (await tableau(entete)).json()) as { comptes: Record<string, number> };
    expect(corps.comptes).toMatchObject({ actifs: 1, suspendus: 1 });
  });

  it("signale les suppressions échues, qui demandent un geste aujourd'hui", async () => {
    await enAttente(1, 40);
    const { entete } = await session("admin");

    const corps = (await (await tableau(entete)).json()) as {
      alertes: { cause: string }[]; suppressions: { echues: number };
    };
    expect(corps.suppressions.echues).toBe(1);
    expect(corps.alertes.some((a) => a.cause === "suppression_echeance")).toBe(true);
  });

  // Une file vide n'est pas une anomalie. Le tableau le dit en ne portant
  // aucune alerte, plutôt qu'en en inventant une neutre pour meubler le rang.
  it("ne porte aucune alerte quand rien ne va mal", async () => {
    const { entete } = await session("admin");
    const corps = (await (await tableau(entete)).json()) as { alertes: unknown[] };
    expect(corps.alertes).toHaveLength(0);
  });

  it("rend les derniers gestes d'administration", async () => {
    const { compte, entete } = await session("admin");
    await db.prisma.auditLog.create({
      data: { actorType: "admin", actorId: compte.id, action: "parameter_update", reason: "Hausse décidée en comité" },
    });

    const corps = (await (await tableau(entete)).json()) as { derniersGestes: { action: string }[] };
    expect(corps.derniersGestes[0]?.action).toBe("parameter_update");
  });
});
