import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { OtpService } from "../src/auth/otp.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
// L'application entière refuse de démarrer sans clé d'administration : c'est
// voulu, mieux vaut ne pas démarrer que signer sans clé. Ces suites montent
// AppModule, elles la posent donc aussi.
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

// Revue tour 1, points 4 et 6 : l'indistinguabilité d'une adresse inconnue
// doit s'éprouver par le point d'entrée HTTP réel (statut, corps, en-têtes),
// pas seulement en appelant le service. Et les trois autres chemins
// (verify, refresh, logout) plus la garde doivent être exercés de bout en
// bout, pas seulement POST /otp.
describe("authentification — HTTP de bout en bout", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let otp: OtpService;
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
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    // Aucun identifiant Resend ici : adhésion explicite à la console de
    // développement requise depuis la revue tour 2 (voir app.module.ts) —
    // sans elle, le module refuserait de démarrer.
    process.env.LEHNO_MAIL_CONSOLE = "1";

    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
    otp = new OtpService(db.prisma as never, PEPPER);
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

  beforeEach(async () => { await resetDatabase(db.prisma); });

  function post(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  function del(path: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: "DELETE",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  }

  // Les réponses ne sont pas validées contre un schéma ici (ce n'est pas
  // l'objet de ces tests) : un type large suffit pour lire les champs qu'on
  // vient vérifier.
  function json(res: Response): Promise<Record<string, string | number | boolean>> {
    return res.json() as Promise<Record<string, string | number | boolean>>;
  }

  it("une adresse connue et une adresse inconnue rendent la même réponse HTTP", async () => {
    await db.prisma.user.create({
      data: { email: "connue@example.com", username: "connue1", referralCode: "CONNUE1" },
    });

    const known = await post("/v1/auth/otp", { email: "connue@example.com" });
    const unknown = await post("/v1/auth/otp", { email: "jamais-vue@example.com" });

    expect(known.status).toBe(unknown.status);
    expect(known.status).toBe(200);
    await expect(known.json()).resolves.toEqual(await unknown.json());
    // Content-Type et Content-Length : rien qui distingue les deux réponses
    // par leur forme. Le temps de réponse n'est pas mesuré ici — il n'y a
    // rien à comparer statistiquement dans un test unique — mais il n'y a
    // pas lieu qu'il diverge non plus : AuthService.requestOtp ne consulte
    // jamais la table `user`, les deux adresses traversent donc exactement
    // le même code, dans le même ordre, avec le même nombre d'écritures.
    expect(known.headers.get("content-type")).toBe(unknown.headers.get("content-type"));
    expect(known.headers.get("content-length")).toBe(unknown.headers.get("content-length"));
  });

  // Un test direct sur AuthService ne peut pas montrer ce trou : il appelle
  // le service avec l'IP qu'on lui fournit, alors que c'est justement le
  // contrôleur (via @Ip()) qui doit la capturer et la transmettre. Seul un
  // vrai appel HTTP l'exerce. Vingt requêtes vers vingt adresses distinctes
  // ne heurtent jamais le plafond par destinataire (5 par adresse) — seul
  // celui par origine (20 par IP) peut les arrêter, ce qui distingue les deux
  // plafonds l'un de l'autre.
  it("le plafond par origine finit par arrêter un même appelant, même en changeant d'adresse à chaque fois", async () => {
    for (let i = 0; i < 20; i++) {
      const res = await post("/v1/auth/otp", { email: `cible-${i}@example.com` });
      expect(res.status).toBe(200);
    }
    const res = await post("/v1/auth/otp", { email: "cible-encore@example.com" });
    expect(res.status).toBe(429);
    const body = await json(res);
    expect(body.code).toBe("rate_limited");
    // L'adresse IP de l'appelant ne doit apparaître nulle part dans la réponse.
    expect(JSON.stringify(body)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(JSON.stringify(body)).not.toContain("::1");
    expect(JSON.stringify(body)).not.toContain("127.0.0.1");
  });

  // Revue tour 2, point 5 : /otp/verify n'avait aucun plafond par origine —
  // OtpService.verify borne les essais SUR UN CODE DONNÉ, mais rien
  // n'empêchait de balayer beaucoup d'adresses depuis une seule origine.
  // Comme pour /otp, seul un vrai appel HTTP peut le montrer.
  it("le plafond par origine finit par arrêter les tentatives de vérification, même en changeant d'adresse à chaque fois", async () => {
    for (let i = 0; i < 30; i++) {
      const res = await post("/v1/auth/otp/verify", { email: `verif-${i}@example.com`, code: "000000" });
      expect(res.status).toBe(422); // otp_invalid : aucun code en attente pour cette adresse
    }
    const res = await post("/v1/auth/otp/verify", { email: "verif-encore@example.com", code: "000000" });
    expect(res.status).toBe(429);
    const body = await json(res);
    expect(body.code).toBe("rate_limited");
  });

  it("POST /otp/verify rend un jeton d'inscription pour une adresse inconnue", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const res = await post("/v1/auth/otp/verify", { email: "awa@example.com", code, deviceId: "dev-http-1" });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toMatchObject({ outcome: "registration", email: "awa@example.com" });
    expect(typeof body.registrationToken).toBe("string");
    // Aucune session : ni jeton d'accès, ni jeton de renouvellement.
    expect(body.accessToken).toBeUndefined();
    expect(body.refreshToken).toBeUndefined();
  });

  // 201 : la route crée une ressource — un compte — dont le client apprend
  // l'existence. C'est la convention du contrat commun.
  it("POST /register crée le compte et rend 201 avec le détail des octrois", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const verif = await json(await post("/v1/auth/otp/verify", {
      email: "awa@example.com", code, deviceId: "dev-http-1",
    }));

    const res = await post("/v1/auth/register", {
      registrationToken: verif["registrationToken"], username: "awa", deviceId: "dev-http-1",
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body).toMatchObject({ outcome: "session", isNewAccount: true, signupCredits: 5 });
    expect(typeof body["accessToken"]).toBe("string");
    // Aucun code de parrainage donné : la ligne du bonus ne s'affiche pas.
    expect(body["referral"]).toBeNull();
  });

  it("POST /register refuse un jeton d'accès à la place du jeton d'inscription", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const verif = await json(await post("/v1/auth/otp/verify", {
      email: "awa@example.com", code, deviceId: "dev-http-1",
    }));
    const session = await json(await post("/v1/auth/register", {
      registrationToken: verif["registrationToken"], username: "awa", deviceId: "dev-http-1",
    }));

    // La séparation vaut dans les deux sens : un jeton d'accès ne crée pas de
    // compte, pas plus qu'un jeton d'inscription n'ouvre de session.
    const res = await post("/v1/auth/register", {
      registrationToken: session["accessToken"], username: "autre", deviceId: "dev-http-9",
    });
    expect(res.status).toBe(401);
  });

  it("POST /otp/verify refuse un mauvais code avec l'enveloppe d'erreur standard", async () => {
    await otp.issue("awa@example.com", "login");
    const res = await post("/v1/auth/otp/verify", { email: "awa@example.com", code: "000000", deviceId: "dev-http-1" });

    expect(res.status).toBe(422);
    const body = await json(res);
    expect(body.code).toBe("otp_invalid");
    expect(typeof body.message).toBe("string");
  });

  // L'identifiant d'appareil est exigé par /register, non plus par la
  // vérification : c'est là que le compte naît, donc là que le plafond
  // s'applique. Le rendre facultatif rouvrirait le contournement.
  it("POST /register refuse la création sans identifiant d'appareil", async () => {
    const { code } = await otp.issue("sans-appareil@example.com", "login");
    const verif = await json(await post("/v1/auth/otp/verify", {
      email: "sans-appareil@example.com", code,
    }));

    const res = await post("/v1/auth/register", {
      registrationToken: verif["registrationToken"], username: "quelquun",
    });
    expect(res.status).toBe(400);
    expect((await json(res)).code).toBe("validation_failed");
  });

  it("POST /refresh renouvelle la session et invalide l'ancien jeton", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const verif = await json(await post("/v1/auth/otp/verify", {
      email: "awa@example.com", code, deviceId: "dev-http-2",
    }));
    const { refreshToken } = await json(await post("/v1/auth/register", {
      registrationToken: verif["registrationToken"], username: "awa", deviceId: "dev-http-2",
    }));

    const res = await post("/v1/auth/refresh", { refreshToken });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.isNewAccount).toBe(false);
    expect(body.refreshToken).not.toBe(refreshToken);

    // Le jeton consommé ne se rejoue pas.
    const replay = await post("/v1/auth/refresh", { refreshToken });
    expect(replay.status).toBe(401);
  });

  it("DELETE /session exige un jeton d'accès (garde active sur la route)", async () => {
    const res = await del("/v1/auth/session", { refreshToken: "peu-importe" });
    expect(res.status).toBe(401);
  });

  it("DELETE /session avec un jeton invalide est refusé par la garde", async () => {
    const res = await del("/v1/auth/session", { refreshToken: "peu-importe" }, { authorization: "Bearer pas-un-vrai-jeton" });
    expect(res.status).toBe(401);
  });

  it("DELETE /session avec un jeton valide révoque la session", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const verifPourSession = await json(await post("/v1/auth/otp/verify", {
      email: "awa@example.com", code, deviceId: "dev-http-3",
    }));
    const verifyRes = await post("/v1/auth/register", {
      registrationToken: verifPourSession["registrationToken"], username: "awa", deviceId: "dev-http-3",
    });
    const { accessToken, refreshToken } = await json(verifyRes);

    const res = await del("/v1/auth/session", { refreshToken }, { authorization: `Bearer ${accessToken}` });
    expect(res.status).toBe(204);

    // La lignée entière est révoquée : le renouvellement échoue désormais.
    const refreshRes = await post("/v1/auth/refresh", { refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
