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
// Distinct de SECRET, et c'est le sujet d'un des tests : deux mondes, deux clés.
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

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
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
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

  // Une session d'exploitation dure trente minutes ; le jeton de
  // rafraîchissement vit douze heures. Sans échange, l'administrateur repasse
  // par sa boîte aux lettres deux fois par heure — et le jeton long qu'on lui
  // remet ne sert à rien.
  const ouvrirSession = async (over: Record<string, unknown> = {}) => {
    const admin = await creerAdmin(over);
    const code = await otp.demander(admin.email);
    const reponse = await fetch(`${baseUrl}/v1/admin/auth/otp/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: admin.email, code }),
    });
    const paire = (await reponse.json()) as { accessToken: string; refreshToken: string; role: string };
    return { admin, ...paire };
  };

  const rafraichir = (refreshToken: string) =>
    fetch(`${baseUrl}/v1/admin/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

  it("le jeton de rafraîchissement s'échange contre une paire neuve", async () => {
    const session = await ouvrirSession();

    const reponse = await rafraichir(session.refreshToken);

    expect(reponse.status).toBe(200);
    const neuve = (await reponse.json()) as { accessToken: string; refreshToken: string; role: string };
    expect(neuve.refreshToken).not.toBe(session.refreshToken);
    expect(app.get(AdminTokenService).verifierAcces(neuve.accessToken).adminId).toBe(session.admin.id);
    // Le rôle repart avec la paire : il peut avoir changé depuis l'ouverture,
    // et l'outil doit suivre sans attendre une reconnexion.
    expect(neuve.role).toBe("support");
  });

  // Impossible de distinguer le voleur du légitime : les deux présentent le
  // même jeton. On ne tranche donc pas, on ferme tout.
  it("rejouer un jeton consommé révoque toute la lignée", async () => {
    const session = await ouvrirSession();
    const premiere = await rafraichir(session.refreshToken);
    const enfant = (await premiere.json()) as { refreshToken: string };

    const rejeu = await rafraichir(session.refreshToken);

    expect(rejeu.status).toBe(401);
    expect(((await rejeu.json()) as { code: string }).code).toBe("refresh_reused");
    // Ce qui compte n'est pas le refus du rejeu, c'est que l'enfant tombe avec :
    // sinon le voleur garde une session ouverte pendant qu'on refuse la sienne.
    const apres = await rafraichir(enfant.refreshToken);
    expect(apres.status).toBe(401);
  });

  // Le point propre à l'administration : révoquer un compte doit couper la
  // session en cours. Sans cette vérification, un administrateur écarté tient
  // encore douze heures en faisant tourner son jeton.
  it("un compte désactivé ne rafraîchit plus", async () => {
    const session = await ouvrirSession();
    await db.prisma.admin.update({ where: { id: session.admin.id }, data: { isActive: false } });

    const reponse = await rafraichir(session.refreshToken);

    expect(reponse.status).toBe(401);
  });

  it("un jeton de rafraîchissement d'utilisateur n'ouvre pas d'administration", async () => {
    const utilisateur = await db.prisma.user.create({
      data: { email: "client@exemple.cm", username: "client", referralCode: "CLI1" },
    });
    const paire = await app.get(TokenService).issuePair(utilisateur.id);

    const reponse = await rafraichir(paire.refreshToken);

    expect(reponse.status).toBe(401);
    // Et il ne doit surtout pas avoir été consommé au passage : les deux mondes
    // ne se touchent pas, même pour échouer.
    const ligne = await db.prisma.refreshToken.findFirstOrThrow();
    expect(ligne.consumedAt).toBeNull();
  });

  it("se déconnecter coupe la lignée, pas seulement le dernier jeton", async () => {
    const session = await ouvrirSession();
    const premiere = await rafraichir(session.refreshToken);
    const enfant = (await premiere.json()) as { refreshToken: string };

    await fetch(`${baseUrl}/v1/admin/auth/session`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: enfant.refreshToken }),
    });

    expect((await rafraichir(enfant.refreshToken)).status).toBe(401);
    const vivants = await db.prisma.adminRefreshToken.count({ where: { revokedAt: null } });
    expect(vivants).toBe(0);
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

  // Un JWT ne consulte aucune table : il porte sa preuve en lui-même, et une
  // garde qui vérifie une signature ne sait rien de l'URL par laquelle le jeton
  // est arrivé. C'est pour ça que des tables séparées ne suffisaient pas — il
  // fallait des clés séparées.
  it("un jeton d'utilisateur n'ouvre pas l'administration", async () => {
    const jetonsAdmin = app.get(AdminTokenService);
    const jetonsUtilisateur = app.get(TokenService);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });

    const paire = await jetonsUtilisateur.issuePair(u.id);

    expect(() => jetonsAdmin.verifierAcces(paire.accessToken)).toThrow();
  });

  // La réciproque, qui vaut d'être tenue aussi : une session d'exploitation ne
  // doit pas ouvrir le compte d'un utilisateur.
  it("un jeton d'administration n'ouvre pas un compte d'utilisateur", async () => {
    const sam = await creerAdmin();
    const jetonsAdmin = app.get(AdminTokenService);
    const jetonsUtilisateur = app.get(TokenService);

    const paire = await jetonsAdmin.ouvrir(sam.id);

    expect(() => jetonsUtilisateur.verifyAccess(paire.accessToken)).toThrow();
  });

  it("aucune session d'administration n'atterrit dans les tables des utilisateurs", async () => {
    await creerAdmin();
    await demander("sam@lehno.app");
    expect(await db.prisma.otpCode.count()).toBe(0);
    expect(await db.prisma.refreshToken.count()).toBe(0);
  });
});
