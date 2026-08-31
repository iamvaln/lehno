import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { ConsoleMailAdapter } from "../src/mail/console.adapter.js";
import { ResendAdapter } from "../src/mail/resend.adapter.js";
import type { MailPort } from "../src/mail/mail.port.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

// Le module s'assemble en lisant OTP_PEPPER/JWT_SECRET dans l'environnement
// (voir app.module.ts) : on les manipule ici puis on les restaure, pour ne
// pas laisser fuiter un état entre les cas ou vers les autres fichiers de
// test qui tournent dans le même process vitest.
function withEnv(vars: Record<string, string | undefined>): () => void {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) previous[key] = process.env[key];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

describe("démarrage de l'application", () => {
  let db: TestDb;
  let app: INestApplication | undefined;
  let restoreEnv: (() => void) | undefined;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  afterEach(async () => {
    if (app) { await app.close(); app = undefined; }
    restoreEnv?.();
    restoreEnv = undefined;
  });

  it("refuse de démarrer si OTP_PEPPER est absent, plutôt que de démarrer à moitié", async () => {
    // LEHNO_MAIL_CONSOLE=1 : sans ça, MAIL_PORT échouerait aussi (voir plus
    // bas), et lequel des deux échecs remonte en premier dépendrait de
    // l'ordre d'instanciation de Nest — ce test ne veut isoler QUE l'échec
    // OTP_PEPPER.
    restoreEnv = withEnv({
      DATABASE_URL: db.url, OTP_PEPPER: undefined, JWT_SECRET: SECRET, LEHNO_MAIL_CONSOLE: "1",
    });
    // abortOnError: false — sinon Nest appelle process.abort() sur une erreur
    // d'initialisation au lieu de rejeter la promesse, ce qui tue le worker
    // de test plutôt que de laisser ce test l'observer.
    await expect(NestFactory.create(AppModule, { logger: false, abortOnError: false }))
      .rejects.toThrow(/OTP_PEPPER manquant/);
  });

  // Revue tour 2 (le repli "silencieux" sur la console) : un opérateur qui
  // oublie RESEND_API_KEY/RESEND_FROM — deux variables absentes suffisent
  // — ne doit JAMAIS obtenir une API qui démarre quand même et journalise des
  // codes à usage unique en clair. Les trois issues du câblage MAIL_PORT
  // (voir app.module.ts) sont éprouvées explicitement.
  it("choisit ResendAdapter quand les identifiants sont présents", async () => {
    await resetDatabase(db.prisma);
    restoreEnv = withEnv({
      DATABASE_URL: db.url, OTP_PEPPER: PEPPER, JWT_SECRET: SECRET,
      RESEND_API_KEY: "re_cle-de-test", RESEND_FROM: "Lehno <no-reply@lehno.app>",
      LEHNO_MAIL_CONSOLE: undefined,
    });
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    expect(app.get<MailPort>("MAIL_PORT")).toBeInstanceOf(ResendAdapter);
  });

  it("choisit ConsoleMailAdapter uniquement avec l'adhésion explicite, sans identifiants Resend", async () => {
    await resetDatabase(db.prisma);
    restoreEnv = withEnv({
      DATABASE_URL: db.url, OTP_PEPPER: PEPPER, JWT_SECRET: SECRET,
      RESEND_API_KEY: undefined, RESEND_FROM: undefined,
      LEHNO_MAIL_CONSOLE: "1",
    });
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    expect(app.get<MailPort>("MAIL_PORT")).toBeInstanceOf(ConsoleMailAdapter);
  });

  /* LE QUATRIÈME CAS, celui d'un poste de développement — et le seul qui
     n'était pas éprouvé.
     
     Sur une machine de développement les DEUX sont posés : Resend vient du
     fichier d'environnement partagé, `LEHNO_MAIL_CONSOLE=1` est ajouté exprès
     pour développer. L'ordre précédent donnait Resend, donc l'adhésion
     explicite ne servait JAMAIS là où elle sert.
     
     La conséquence n'était pas théorique : Resend refuse d'écrire à un domaine
     non vérifié, le code à usage unique ne partait nulle part, et le parcours
     de connexion était impossible en local — avec un 403 pour seule
     explication.
     
     La garde d'origine tient toujours : on ne TOMBE pas sur la console faute
     de configuration, il faut écrire « 1 », ce qui ne s'écrit pas par
     accident. Et le démarrage l'annonce. */
  it("préfère la console à Resend quand l'adhésion explicite est posée", async () => {
    await resetDatabase(db.prisma);
    restoreEnv = withEnv({
      DATABASE_URL: db.url, OTP_PEPPER: PEPPER, JWT_SECRET: SECRET,
      RESEND_API_KEY: "re_cle-de-test", RESEND_FROM: "Lehno <no-reply@lehno.io>",
      LEHNO_MAIL_CONSOLE: "1",
    });
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    expect(app.get<MailPort>("MAIL_PORT")).toBeInstanceOf(ConsoleMailAdapter);
  });

  it("refuse de démarrer sans identifiants Resend NI adhésion explicite à la console", async () => {
    restoreEnv = withEnv({
      DATABASE_URL: db.url, OTP_PEPPER: PEPPER, JWT_SECRET: SECRET,
      RESEND_API_KEY: undefined, RESEND_FROM: undefined,
      LEHNO_MAIL_CONSOLE: undefined,
    });
    await expect(NestFactory.create(AppModule, { logger: false, abortOnError: false }))
      .rejects.toThrow(/Aucun envoi de courrier configuré/);
  });

  it("expose POST /v1/auth/otp une fois le module câblé", async () => {
    await resetDatabase(db.prisma);
    // LEHNO_MAIL_CONSOLE=1 : adhésion explicite requise pour ce test, comme
    // pour tout démarrage sans identifiants Resend (voir les trois tests
    // ci-dessus).
    restoreEnv = withEnv({
      DATABASE_URL: db.url, OTP_PEPPER: PEPPER, JWT_SECRET: SECRET, LEHNO_MAIL_CONSOLE: "1",
    });

    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    const url = await app.getUrl();

    const res = await fetch(`${url}/v1/auth/otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "awa@example.com" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ sent: true });
  });
});
