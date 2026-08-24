import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminOtpService } from "../src/admin/admin-otp.service.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { TokenService } from "../src/auth/token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

describe("administration — l'entrée par code", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let otp: AdminOtpService;

  beforeAll(async () => {
    db = await withDatabase();
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.LEHNO_MAIL_CONSOLE = "1";
    process.env.LEHNO_LOG_OTP = "1";
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
    otp = app.get(AdminOtpService);
  }, 180_000);

  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await app?.close(); await db.close(); });

  const creerAdmin = (over: Record<string, unknown> = {}) =>
    db.prisma.admin.create({ data: { email: "sam@lehno.app", displayName: "Sam", ...over } });

  const demander = (email: string) =>
    fetch(`${baseUrl}/v1/admin/auth/otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

  // La propriété qui compte : essayer une adresse ne doit rien apprendre. Sans
  // elle, on énumère les comptes d'exploitation en les essayant un à un — et il
  // y en a très peu, donc l'ensemble se devine vite.
  it("répond la même chose à une adresse connue et à une inconnue", async () => {
    await creerAdmin();

    const connue = await demander("sam@lehno.app");
    const inconnue = await demander("personne@lehno.app");

    expect(inconnue.status).toBe(connue.status);
    expect(await inconnue.text()).toBe(await connue.text());
  });

  // Le corollaire du choix du propriétaire : les comptes sont créés à l'avance,
  // donc une adresse inconnue n'écrit rien et n'envoie rien.
  it("une adresse inconnue n'écrit aucun code", async () => {
    await creerAdmin();
    await demander("personne@lehno.app");
    expect(await db.prisma.adminOtpCode.count()).toBe(0);
  });

  it("une adresse connue écrit exactement un code", async () => {
    await creerAdmin();
    await demander("sam@lehno.app");
    expect(await db.prisma.adminOtpCode.count()).toBe(1);
  });

  // Un compte désactivé se comporte comme une adresse inconnue : il ne dit pas
  // « ce compte est suspendu », ce qui reviendrait à confirmer qu'il existe.
  it("un compte désactivé ne reçoit rien, et ne se distingue pas", async () => {
    await creerAdmin({ isActive: false });

    const desactive = await demander("sam@lehno.app");
    const inconnue = await demander("personne@lehno.app");

    expect(desactive.status).toBe(inconnue.status);
    expect(await desactive.text()).toBe(await inconnue.text());
    expect(await db.prisma.adminOtpCode.count()).toBe(0);
  });

  it("le bon code ouvre une session", async () => {
    const sam = await creerAdmin();
    // Le code n'est jamais relisible en base — il y est haché sous clé. On passe
    // donc par le service, comme le font les tests d'authentification existants.
    const code = await otp.demander("sam@lehno.app");
    expect(code).toBeTypeOf("string");
    const ligne = await db.prisma.adminOtpCode.findFirstOrThrow();
    expect(ligne.adminId).toBe(sam.id);

    const reponse = await fetch(`${baseUrl}/v1/admin/auth/otp/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "sam@lehno.app", code }),
    });
    expect([200, 201]).toContain(reponse.status);
    const corps = (await reponse.json()) as {
      accessToken: string; refreshToken: string; expiresIn: number; role: string;
    };
    expect(corps.accessToken).toBeTypeOf("string");
    expect(corps.refreshToken).toBeTypeOf("string");
    expect(corps.role).toBe("support");
  });

  it("un mauvais code est refusé", async () => {
    await creerAdmin();
    await demander("sam@lehno.app");
    const reponse = await fetch(`${baseUrl}/v1/admin/auth/otp/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "sam@lehno.app", code: "000000" }),
    });
    expect(reponse.status).toBeGreaterThanOrEqual(400);
  });

  // Le même secret signe les deux mondes. Sans marque de type dans la charge,
  // un jeton d'utilisateur porte un « sub » comme un autre et passerait la garde
  // d'administration : deux systèmes séparés en base le resteraient en apparence
  // seulement.
  it("un jeton d'utilisateur n'ouvre pas l'administration", async () => {
    const jetonsAdmin = app.get(AdminTokenService);
    const jetonsUtilisateur = app.get(TokenService);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });

    const paire = await jetonsUtilisateur.issuePair(u.id);

    expect(() => jetonsAdmin.verifierAcces(paire.accessToken)).toThrow();
  });

  it("aucune session d'administration n'atterrit dans les tables des utilisateurs", async () => {
    await creerAdmin();
    await demander("sam@lehno.app");
    expect(await db.prisma.otpCode.count()).toBe(0);
    expect(await db.prisma.refreshToken.count()).toBe(0);
  });
});
