import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { TokenService } from "../src/auth/token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
// AdminTokenService refuse de démarrer sans sa propre clé (voir
// admin-token.service.ts) — l'AppModule le charge même si ce test n'utilise
// jamais l'administration. `singleFork: true` (vitest.config.ts) fait que la
// variable peut déjà traîner d'un fichier voisin exécuté dans le même
// processus ; on la pose ici pour ne pas dépendre de cet ordre.
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

// Cloisonnement : un compte ne doit ni voir ni révoquer les sessions d'un
// autre. C'est le geste que la spec demande d'éprouver en particulier — voir
// tenancy.test.ts pour le même principe sur les autres ressources « me/* ».
describe("sécurité et connexions — HTTP de bout en bout", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let userId: string;
  let token: string;
  let autreToken: string;

  beforeAll(async () => {
    db = await withDatabase();
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    process.env.LEHNO_MAIL_CONSOLE = "1";

    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await db.close();
  });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa_http", referralCode: "AWAHTTP" },
    });
    userId = u.id;
    const autre = await db.prisma.user.create({
      data: { email: "karim@example.com", username: "karim_http", referralCode: "KARHTTP" },
    });
    // Jetons d'accès signés directement, comme profile-http.e2e.test.ts :
    // pas besoin de rejouer le parcours OTP pour éprouver ce contrôleur.
    token = jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });
    autreToken = jwt.sign({ sub: autre.id }, SECRET, { algorithm: "HS256", expiresIn: 900 });
  });

  function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, { headers });
  }

  function del(path: string, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, { method: "DELETE", headers });
  }

  function json(res: Response): Promise<Record<string, unknown>> {
    return res.json() as Promise<Record<string, unknown>>;
  }

  it("GET /me/sessions refuse une requête sans jeton", async () => {
    const res = await get("/v1/me/sessions");
    expect(res.status).toBe(401);
  });

  it("GET /me/sessions rend une lignée par appareil, pas un jeton par rafraîchissement", async () => {
    const tokens = app.get(TokenService);
    const paire = await tokens.issuePair(userId, "Chrome — macOS");
    await tokens.rotate(paire.refreshToken, "Chrome — macOS");
    await tokens.issuePair(userId, "Safari — iOS");

    const res = await get("/v1/me/sessions", { authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect((body.sessions as unknown[])).toHaveLength(2);
  });

  it("GET /me/sessions ne rend jamais la session d'un autre compte", async () => {
    const tokens = app.get(TokenService);
    await tokens.issuePair(userId, "Chrome — macOS");

    const res = await get("/v1/me/sessions", { authorization: `Bearer ${autreToken}` });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.sessions).toEqual([]);
  });

  it("GET /me/sessions ne rend ni adresse ni lieu", async () => {
    const tokens = app.get(TokenService);
    await tokens.issuePair(userId, "Chrome — macOS", "102.244.18.7");

    const res = await get("/v1/me/sessions", { authorization: `Bearer ${token}` });
    const body = await res.text();
    expect(body).not.toMatch(/"ip"/);
    expect(body).not.toMatch(/102\.244\.18\.7/);
  });

  it("DELETE /me/sessions refuse une requête sans jeton", async () => {
    const res = await del("/v1/me/sessions");
    expect(res.status).toBe(401);
  });

  it("DELETE /me/sessions révoque les lignées du demandeur, jamais celles d'un autre compte", async () => {
    const tokens = app.get(TokenService);
    const laMienne = await tokens.issuePair(userId, "Chrome — macOS");
    const celleDeLAutre = await tokens.issuePair((await db.prisma.user.findUniqueOrThrow({
      where: { username: "karim_http" },
    })).id, "Safari — iOS");

    const res = await del("/v1/me/sessions", { authorization: `Bearer ${token}` });
    expect(res.status).toBe(204);

    await expect(tokens.rotate(laMienne.refreshToken)).rejects.toThrow();
    // La session de l'autre compte survit : le cloisonnement tient.
    await expect(tokens.rotate(celleDeLAutre.refreshToken)).resolves.toBeDefined();
  });

  it("GET /me/identities refuse une requête sans jeton", async () => {
    const res = await get("/v1/me/identities");
    expect(res.status).toBe(401);
  });

  it("GET /me/identities ne rend jamais les identités d'un autre compte", async () => {
    const autre = await db.prisma.user.findUniqueOrThrow({ where: { username: "karim_http" } });
    await db.prisma.federatedIdentity.create({
      data: { userId: autre.id, provider: "google", providerUserId: "g-1" },
    });

    const res = await get("/v1/me/identities", { authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.identities).toEqual([]);
  });

  it("GET /me/identities rend les identités du demandeur", async () => {
    await db.prisma.federatedIdentity.create({
      data: { userId, provider: "apple", providerUserId: "a-1" },
    });

    const res = await get("/v1/me/identities", { authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect((body.identities as { provider: string }[])[0]!.provider).toBe("apple");
  });
});
