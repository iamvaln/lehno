import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AuthService } from "../src/auth/auth.service.js";
import { OtpService } from "../src/auth/otp.service.js";
import { TokenService } from "../src/auth/token.service.js";
import { RateLimitService } from "../src/common/rate-limit.service.js";
import type { Mail, MailPort } from "../src/mail/mail.port.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

// node:crypto s'expose en ESM via un objet d'espace de noms figé : vi.spyOn
// ne peut pas le redéfinir ("Cannot redefine property"). vi.mock intercepte
// la résolution du module avant que cet objet gelé n'existe ; par défaut il
// délègue entièrement au module réel, et un seul test (la collision de
// pseudo) programme un tirage truqué pour son tout premier appel.
const cryptoOverride = vi.hoisted(() => ({ nextRandomBytes: null as ((size: number) => Buffer) | null }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomBytes: (size: number) => {
      const override = cryptoOverride.nextRandomBytes;
      if (override) {
        cryptoOverride.nextRandomBytes = null;
        return override(size);
      }
      return actual.randomBytes(size);
    },
  };
});

describe("authentification", () => {
  let db: TestDb;
  let auth: AuthService;
  let otp: OtpService;
  let envoyés: Mail[];

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    otp = new OtpService(db.prisma as never, PEPPER);
    envoyés = [];
    const mailDeTest: MailPort = { send: async (m) => { envoyés.push(m); } };
    auth = new AuthService(
      db.prisma as never, otp, new TokenService(db.prisma as never, SECRET),
      new RateLimitService(db.prisma as never), mailDeTest,
    );
  });

  it("la première vérification crée le compte", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const s = await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    expect(s.isNewAccount).toBe(true);
    const u = await db.prisma.user.findUniqueOrThrow({ where: { email: "awa@example.com" } });
    expect(u.emailVerified).toBe(true);
    expect(u.username).toMatch(/^u[0-9a-f]{8}$/); // pseudo provisoire, choisi ensuite
  });

  it("la deuxième connexion retrouve le même compte", async () => {
    const a = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code: a.code, deviceId: "dev-1" });
    const b = await otp.issue("awa@example.com", "login");
    const s = await auth.verifyOtp({ email: "awa@example.com", code: b.code, deviceId: "dev-1" });
    expect(s.isNewAccount).toBe(false);
    expect(await db.prisma.user.count()).toBe(1);
  });

  it("le plafond par appareil refuse le quatrième compte", async () => {
    for (const n of [1, 2, 3]) {
      const { code } = await otp.issue(`u${n}@example.com`, "login");
      await auth.verifyOtp({ email: `u${n}@example.com`, code, deviceId: "partagé" });
    }
    const { code } = await otp.issue("u4@example.com", "login");
    await expect(auth.verifyOtp({ email: "u4@example.com", code, deviceId: "partagé" }))
      .rejects.toMatchObject({ code: "device_limit_reached" });
    expect(await db.prisma.user.count()).toBe(3); // rien n'a été créé
  });

  it("un compte suspendu ne peut pas ouvrir de session", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    await db.prisma.user.update({ where: { email: "awa@example.com" }, data: { status: "suspended" } });
    const next = await otp.issue("awa@example.com", "login");
    await expect(auth.verifyOtp({ email: "awa@example.com", code: next.code, deviceId: "dev-1" }))
      .rejects.toMatchObject({ code: "account_suspended" });
  });

  it("chaque tentative laisse une trace, réussie comme échouée", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    await auth.verifyOtp({ email: "awa@example.com", code: "000000", deviceId: "dev-1" }).catch(() => {});
    const rows = await db.prisma.loginActivity.findMany();
    expect(rows.map((r) => r.result).sort()).toEqual(["failure", "success"]);
  });

  it("demander un code pour une adresse inconnue ne le dit pas", async () => {
    const connue = await auth.requestOtp({ email: "awa@example.com" });
    const inconnue = await auth.requestOtp({ email: "personne@example.com" });
    expect(connue).toEqual(inconnue); // même forme, aucun indice
  });

  // Le limiteur et l'envoi sont désormais dans le chemin de requestOtp :
  // cette propriété (identique, adresse connue ou non) est la plus facile
  // à casser sans s'en apercevoir en la modifiant.
  it("la réponse reste identique après le branchement du limiteur et de l'envoi, adresse connue ou non", async () => {
    await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA12345" },
    });
    const connue = await auth.requestOtp({ email: "awa@example.com" });
    const inconnue = await auth.requestOtp({ email: "personne-inconnue@example.com" });
    expect(connue).toEqual({ sent: true });
    expect(inconnue).toEqual({ sent: true });
    expect(connue).toEqual(inconnue);
  });

  it("demander un code envoie effectivement un courrier, dans la langue du compte", async () => {
    await db.prisma.user.create({
      data: { email: "en-anglais@example.com", username: "enanglais", referralCode: "ENGL1234", uiLanguage: "en" },
    });
    await auth.requestOtp({ email: "en-anglais@example.com" });
    expect(envoyés).toHaveLength(1);
    expect(envoyés[0]).toMatchObject({ to: "en-anglais@example.com", locale: "en", subject: "Your Lehno code" });
  });

  it("une adresse inconnue reçoit tout de même un courrier, en français par défaut", async () => {
    await auth.requestOtp({ email: "personne@example.com" });
    expect(envoyés).toHaveLength(1);
    expect(envoyés[0]).toMatchObject({ to: "personne@example.com", locale: "fr", subject: "Votre code Lehno" });
  });

  it("borne les demandes par adresse destinataire", async () => {
    for (let i = 0; i < 5; i++) await auth.requestOtp({ email: "bombardée@example.com" });
    await expect(auth.requestOtp({ email: "bombardée@example.com" }))
      .rejects.toMatchObject({ code: "rate_limited" });
  });

  // Revue tour 2, point 1 : rate_limit_hit.key n'est pas une colonne citext
  // (contrairement à user.email) — sans normalisation explicite de la casse
  // avant de composer la clé, "awa@x.com", "Awa@x.com" et "AWA@X.COM"
  // ouvriraient trois compteurs distincts pour la même boîte réelle,
  // c'est-à-dire aucun plafond du tout.
  it("le plafond par adresse résiste à un changement de casse", async () => {
    for (let i = 0; i < 5; i++) await auth.requestOtp({ email: "casse@example.com" });
    await expect(auth.requestOtp({ email: "CASSE@EXAMPLE.COM" }))
      .rejects.toMatchObject({ code: "rate_limited" });
  });

  it("borne les demandes par origine, tous destinataires confondus", async () => {
    for (let i = 0; i < 20; i++) await auth.requestOtp({ email: `cible-${i}@example.com`, ip: "203.0.113.9" });
    await expect(auth.requestOtp({ email: "cible-encore@example.com", ip: "203.0.113.9" }))
      .rejects.toMatchObject({ code: "rate_limited" });
  });

  // Revue tour 1 : deviceId facultatif dans le schéma de contrat, mais le
  // plafond par appareil se contournerait en l'omettant si le service ne
  // l'exigeait pas lui-même pour CRÉER un compte.
  it("créer un compte sans identifiant d'appareil est refusé", async () => {
    const { code } = await otp.issue("sans-appareil@example.com", "login");
    await expect(auth.verifyOtp({ email: "sans-appareil@example.com", code }))
      .rejects.toMatchObject({ code: "validation_failed" });
    expect(await db.prisma.user.count()).toBe(0); // rien n'a été créé
  });

  it("se connecter à un compte existant ne demande pas d'identifiant d'appareil", async () => {
    const a = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code: a.code, deviceId: "dev-1" });
    const b = await otp.issue("awa@example.com", "login");
    await expect(auth.verifyOtp({ email: "awa@example.com", code: b.code })).resolves.toMatchObject({
      isNewAccount: false,
    });
  });

  // Revue tour 1 : ces trois refus surviennent après une vérification de
  // code réussie — sans trace, un porteur de code valide pourrait buter
  // dessus indéfiniment sans que rien n'en garde le souvenir.
  it("le refus par plafond d'appareil laisse une trace", async () => {
    for (const n of [1, 2, 3]) {
      const { code } = await otp.issue(`u${n}@example.com`, "login");
      await auth.verifyOtp({ email: `u${n}@example.com`, code, deviceId: "partagé" });
    }
    const { code } = await otp.issue("u4@example.com", "login");
    await auth.verifyOtp({ email: "u4@example.com", code, deviceId: "partagé" }).catch(() => {});
    const rows = await db.prisma.loginActivity.findMany({ where: { attemptedEmail: "u4@example.com" } });
    expect(rows.map((r) => r.result)).toEqual(["failure"]);
  });

  it("le refus d'un compte suspendu laisse une trace", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    await db.prisma.user.update({ where: { email: "awa@example.com" }, data: { status: "suspended" } });
    const next = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code: next.code, deviceId: "dev-1" }).catch(() => {});
    const rows = await db.prisma.loginActivity.findMany({ where: { attemptedEmail: "awa@example.com" } });
    expect(rows.map((r) => r.result).sort()).toEqual(["failure", "success"]);
  });

  it("un compte en attente de suppression ne peut pas ouvrir de session, et le refus laisse une trace", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    await db.prisma.user.update({ where: { email: "awa@example.com" }, data: { status: "pending_deletion" } });
    const next = await otp.issue("awa@example.com", "login");
    await expect(auth.verifyOtp({ email: "awa@example.com", code: next.code, deviceId: "dev-1" }))
      .rejects.toMatchObject({ code: "account_pending_deletion" });
    const rows = await db.prisma.loginActivity.findMany({ where: { attemptedEmail: "awa@example.com" } });
    expect(rows.map((r) => r.result).sort()).toEqual(["failure", "success"]);
  });

  // Revue tour 1 : une collision du pseudo tiré au hasard (32 bits) ne doit
  // pas faire échouer tout le parcours après que le code a déjà été
  // consommé — on retire avec un nouveau tirage plutôt que d'abandonner.
  it("une collision de pseudo se rattrape par un nouveau tirage", async () => {
    await db.prisma.user.create({
      data: { email: "deja-la@example.com", username: "udeadbeef", referralCode: "AAAAAAAA" },
    });
    // Truque le tout premier tirage à venir (celui du pseudo de la
    // prochaine création) pour qu'il reproduise "udeadbeef", déjà pris.
    cryptoOverride.nextRandomBytes = () => Buffer.from("deadbeef", "hex");

    const { code } = await otp.issue("nouveau-pseudo@example.com", "login");
    const s = await auth.verifyOtp({ email: "nouveau-pseudo@example.com", code, deviceId: "dev-collision" });
    expect(s.isNewAccount).toBe(true);
    const u = await db.prisma.user.findUniqueOrThrow({ where: { email: "nouveau-pseudo@example.com" } });
    expect(u.username).not.toBe("udeadbeef");
    expect(u.username).toMatch(/^u[0-9a-f]{8}$/);
  });
});
