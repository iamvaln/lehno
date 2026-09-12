import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { CONFIGURABLE_NOTIFICATION_TYPES } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

// Même raison que profile-http.e2e.test.ts : AuthGuard et le `.strict()` du
// corps de PATCH ne s'éprouvent qu'à la route réelle, jamais via le seul
// service.
describe("préférences de notification — HTTP de bout en bout", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let userId: string;
  let token: string;
  /* `ADMIN_JWT_SECRET` A REJOINT LA LISTE, et ce n'était pas un oubli sans
     conséquence : ce fichier ne la posait pas, et il ne passait donc QUE DERRIÈRE
     un autre fichier qui l'avait posée — tous partagent un processus
     (`singleFork`), donc `process.env` leur est commun. Lancé seul, il tombait
     à l'assemblage du module, sur `AdminTokenService`. Une épreuve qui dépend de
     ce qui a tourné avant elle n'éprouve pas ce qu'elle croit. */
  let previousEnv: {
    DATABASE_URL: string | undefined; OTP_PEPPER: string | undefined; JWT_SECRET: string | undefined;
    ADMIN_JWT_SECRET: string | undefined; LEHNO_MAIL_CONSOLE: string | undefined;
  };

  beforeAll(async () => {
    db = await withDatabase();
    previousEnv = {
      DATABASE_URL: process.env.DATABASE_URL,
      OTP_PEPPER: process.env.OTP_PEPPER,
      JWT_SECRET: process.env.JWT_SECRET,
      ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
      LEHNO_MAIL_CONSOLE: process.env.LEHNO_MAIL_CONSOLE,
    };
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
    if (previousEnv.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousEnv.DATABASE_URL;
    if (previousEnv.OTP_PEPPER === undefined) delete process.env.OTP_PEPPER;
    else process.env.OTP_PEPPER = previousEnv.OTP_PEPPER;
    if (previousEnv.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousEnv.JWT_SECRET;
    if (previousEnv.ADMIN_JWT_SECRET === undefined) delete process.env.ADMIN_JWT_SECRET;
    else process.env.ADMIN_JWT_SECRET = previousEnv.ADMIN_JWT_SECRET;
    if (previousEnv.LEHNO_MAIL_CONSOLE === undefined) delete process.env.LEHNO_MAIL_CONSOLE;
    else process.env.LEHNO_MAIL_CONSOLE = previousEnv.LEHNO_MAIL_CONSOLE;
  });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa_http", referralCode: "AWAHTTP" },
    });
    userId = u.id;
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

  type Reponse = {
    preferences: { type: string; pushEnabled: boolean; emailEnabled: boolean }[];
    digestFrequency: string;
  };

  async function json(res: Response): Promise<Reponse> {
    return (await res.json()) as Reponse;
  }

  async function jsonErreur(res: Response): Promise<{ code: string }> {
    return (await res.json()) as { code: string };
  }

  it("GET /me/notification-preferences refuse une requête sans jeton", async () => {
    const res = await get("/v1/me/notification-preferences");
    expect(res.status).toBe(401);
  });

  it("GET /me/notification-preferences rend le défaut pour un compte neuf", async () => {
    const res = await get("/v1/me/notification-preferences", { authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.digestFrequency).toBe("monthly");
    // Dérivé du contrat : un littéral redisait `CONFIGURABLE_NOTIFICATION_TYPES
    // .length` sans le dire, et tombait à chaque nature ajoutée.
    expect(body.preferences).toHaveLength(CONFIGURABLE_NOTIFICATION_TYPES.length);
    expect(body.preferences.find((p) => p.type === "event_reminder"))
      .toMatchObject({ pushEnabled: true, emailEnabled: true });
  });

  it("PATCH /me/notification-preferences change un canal et le relit au GET suivant", async () => {
    const res = await patch(
      "/v1/me/notification-preferences",
      { preferences: [{ type: "digest", pushEnabled: false, emailEnabled: true }] },
      { authorization: `Bearer ${token}` },
    );
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.preferences.find((p) => p.type === "digest"))
      .toMatchObject({ pushEnabled: false, emailEnabled: true });

    const relu = await get("/v1/me/notification-preferences", { authorization: `Bearer ${token}` });
    const relubody = await json(relu);
    expect(relubody.preferences.find((p) => p.type === "digest"))
      .toMatchObject({ pushEnabled: false, emailEnabled: true });
  });

  it("PATCH /me/notification-preferences refuse de couper login_code (400)", async () => {
    const res = await patch(
      "/v1/me/notification-preferences",
      { preferences: [{ type: "login_code", pushEnabled: false, emailEnabled: false }] },
      { authorization: `Bearer ${token}` },
    );
    expect(res.status).toBe(400);
    const body = await jsonErreur(res);
    expect(body.code).toBe("validation_failed");
  });

  it("PATCH /me/notification-preferences refuse sendHour (n'appartient pas à ce contrat)", async () => {
    const res = await patch(
      "/v1/me/notification-preferences",
      { digestFrequency: "weekly", sendHour: 20 },
      { authorization: `Bearer ${token}` },
    );
    expect(res.status).toBe(400);
  });

  it("PATCH /me/notification-preferences refuse un corps vide", async () => {
    const res = await patch("/v1/me/notification-preferences", {}, { authorization: `Bearer ${token}` });
    expect(res.status).toBe(400);
  });
});
