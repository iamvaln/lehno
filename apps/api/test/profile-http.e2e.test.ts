import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

// Revue tour 1 : ProfileController n'était éprouvé que via ProfileService,
// jamais par la route réelle — donc jamais par AuthGuard, ni par le
// `.strict()` du corps de PATCH, qui ne s'appliquent qu'au point d'entrée.
describe("profil — HTTP de bout en bout", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let userId: string;
  let token: string;
  let previousEnv: {
    DATABASE_URL: string | undefined; OTP_PEPPER: string | undefined; JWT_SECRET: string | undefined;
    LEHNO_MAIL_CONSOLE: string | undefined;
  };

  beforeAll(async () => {
    db = await withDatabase();
    previousEnv = {
      DATABASE_URL: process.env.DATABASE_URL,
      OTP_PEPPER: process.env.OTP_PEPPER,
      JWT_SECRET: process.env.JWT_SECRET,
      LEHNO_MAIL_CONSOLE: process.env.LEHNO_MAIL_CONSOLE,
    };
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    // Aucun identifiant Mailgun ici : adhésion explicite à la console de
    // développement requise depuis la revue tour 2 (voir app.module.ts) —
    // sans elle, le module refuserait de démarrer.
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
    if (previousEnv.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousEnv.DATABASE_URL;
    if (previousEnv.OTP_PEPPER === undefined) delete process.env.OTP_PEPPER;
    else process.env.OTP_PEPPER = previousEnv.OTP_PEPPER;
    if (previousEnv.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousEnv.JWT_SECRET;
    if (previousEnv.LEHNO_MAIL_CONSOLE === undefined) delete process.env.LEHNO_MAIL_CONSOLE;
    else process.env.LEHNO_MAIL_CONSOLE = previousEnv.LEHNO_MAIL_CONSOLE;
  });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa_http", referralCode: "AWAHTTP" },
    });
    userId = u.id;
    // Un jeton d'accès valide se signe directement avec JWT_SECRET (même
    // technique que auth.guard.test.ts) : ce fichier n'a pas besoin de
    // rejouer tout le parcours OTP pour éprouver ProfileController.
    token = jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });
  });

  function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, { headers });
  }

  function patch(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  // Les réponses ne sont pas validées contre un schéma ici (ce n'est pas
  // l'objet de ces tests) : un type large suffit pour lire les champs qu'on
  // vient vérifier. Même choix que auth-http.e2e.test.ts.
  function json(res: Response): Promise<Record<string, string | number | boolean>> {
    return res.json() as Promise<Record<string, string | number | boolean>>;
  }

  it("GET /me/profile refuse une requête sans jeton", async () => {
    const res = await get("/v1/me/profile");
    expect(res.status).toBe(401);
    const body = await json(res);
    expect(body.code).toBe("unauthorized");
  });

  it("GET /me/profile rend le profil du porteur du jeton", async () => {
    const res = await get("/v1/me/profile", { authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).toBe(userId);
    expect(body.username).toBe("awa_http");
    expect(body.theme).toBe("system");
  });

  it("PATCH /me/profile change la langue et le thème", async () => {
    const res = await patch(
      "/v1/me/profile",
      { uiLanguage: "en", theme: "dark" },
      { authorization: `Bearer ${token}` },
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.uiLanguage).toBe("en");
    expect(body.theme).toBe("dark");
  });

  it("PATCH /me/profile refuse une requête sans jeton", async () => {
    const res = await patch("/v1/me/profile", { theme: "dark" });
    expect(res.status).toBe(401);
  });

  it("PATCH /me/profile refuse une clé hors contrat (email n'est pas éditable)", async () => {
    const res = await patch(
      "/v1/me/profile",
      { email: "vole@example.com" },
      { authorization: `Bearer ${token}` },
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toBe("validation_failed");
  });

  it("GET /me/profile/username-available tient compte du demandeur", async () => {
    const own = await get("/v1/me/profile/username-available?username=awa_http", {
      authorization: `Bearer ${token}`,
    });
    expect(own.status).toBe(200);
    expect((await json(own)).available).toBe(true);

    await db.prisma.user.create({ data: { email: "k@x.com", username: "karim_http", referralCode: "KHTTP" } });
    const taken = await get("/v1/me/profile/username-available?username=karim_http", {
      authorization: `Bearer ${token}`,
    });
    expect(taken.status).toBe(200);
    expect((await json(taken)).available).toBe(false);
  });
});
