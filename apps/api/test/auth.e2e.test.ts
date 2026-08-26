import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AuthService } from "../src/auth/auth.service.js";
import { SignupService } from "../src/onboarding/signup.service.js";
import { LegalService } from "../src/public/legal.controller.js";
import { OtpService } from "../src/auth/otp.service.js";
import { TokenService } from "../src/auth/token.service.js";
import { RateLimitService } from "../src/common/rate-limit.service.js";
import type { Mail, MailPort } from "../src/mail/mail.port.js";
import { AppError } from "../src/common/errors.js";

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
  let tokens: TokenService;

  // Le limiteur impose un délai CROISSANT entre deux demandes de code — 5 s,
  // puis 25 s. Les cas qui éprouvent le PLAFOND doivent donc franchir ces
  // marches sans attendre réellement : on recule les frappes dans le temps.
  const franchirLaMarche = async (): Promise<void> => {
    const frappes = await db.prisma.rateLimitHit.findMany();
    for (const f of frappes) {
      await db.prisma.rateLimitHit.update({
        where: { id: f.id }, data: { createdAt: new Date(f.createdAt.getTime() - 200_000) },
      });
    }
  };

  // Le parcours réel en un appel : vérifier le code, puis s'inscrire. Les deux
  // étapes sont distinctes DEPUIS que le parrainage doit être atomique avec la
  // création — la vérification ne crée plus rien.
  const inscrire = async (email: string, deviceId: string, username?: string) => {
    const { code } = await otp.issue(email, "login");
    const r = await auth.verifyOtp({ email, code, deviceId });
    if (r.outcome !== "registration") throw new Error(`inscription attendue pour ${email}`);
    return auth.register({
      registrationToken: r.registrationToken,
      username: username ?? (email.split("@")[0]!.replace(/[^a-zA-Z0-9]/g, "") || "u"),
      deviceId,
    });
  };
  let envoyés: Mail[];

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    otp = new OtpService(db.prisma as never, PEPPER);
    envoyés = [];
    const mailDeTest: MailPort = { send: async (m) => { envoyés.push(m); } };
    tokens = new TokenService(db.prisma as never, SECRET);
    auth = new AuthService(
      db.prisma as never, otp, tokens,
      new SignupService(db.prisma as never, new LegalService()),
      new RateLimitService(db.prisma as never), mailDeTest,
    );
  });

  // Le plafond du code de connexion se comptait sur la casse abaissée
  // seulement. Une même boîte Gmail se laissait donc arroser en variant
  // l'étiquette après le « + » : cinq courriers par heure et par variante,
  // toutes livrées au même endroit.
  it("plafonne le code de connexion sur la boîte, pas sur la saisie", async () => {
    // Trois demandes suffisent maintenant à atteindre le plafond horaire.
    // Elles visent des SAISIES différentes — étiquette après le « + », points
    // — qui désignent toutes la même boîte réelle.
    for (let i = 0; i < 3; i += 1) {
      await auth.requestOtp({ email: `awa+${i}@gmail.com` });
      await franchirLaMarche();
    }
    await expect(auth.requestOtp({ email: "a.w.a@gmail.com" })).rejects.toBeInstanceOf(AppError);
  });

  // Aucune surface de l'application n'accepte une adresse jetable — celle-ci
  // ouvrirait un compte.
  it("refuse un code de connexion vers une adresse jetable", async () => {
    await expect(auth.requestOtp({ email: "awa@mailinator.com" })).rejects.toBeInstanceOf(AppError);
    expect(envoyés, "rien ne doit partir").toHaveLength(0);
  });

  // La vérification NE CRÉE PLUS DE COMPTE. Le code de parrainage se saisit à
  // l'écran du pseudo, donc après elle : créer d'abord et rattacher ensuite
  // laisserait un compte réclamer un parrainage des mois plus tard. Les deux
  // opérations doivent être atomiques, elles se font donc ensemble.
  it("la première vérification n'écrit rien et invite à s'inscrire", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const r = await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });

    expect(r.outcome).toBe("registration");
    expect(await db.prisma.user.count(), "aucun compte ne doit exister").toBe(0);
  });

  it("le jeton d'inscription n'ouvre aucune session", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const r = await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    if (r.outcome !== "registration") throw new Error("inscription attendue");

    // Il est signé de la même clé que les jetons d'accès : seule sa marque les
    // distingue. Sans elle, il ouvrirait tout.
    expect(() => tokens.verifyAccess(r.registrationToken)).toThrow();
  });

  it("l'inscription crée le compte avec le pseudo choisi", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const r = await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    if (r.outcome !== "registration") throw new Error("inscription attendue");

    const s = await auth.register({
      registrationToken: r.registrationToken, username: "awa", deviceId: "dev-1",
    });
    expect(s.isNewAccount).toBe(true);
    expect(s.signupCredits).toBe(5);
    expect(s.referral).toBeNull();

    const u = await db.prisma.user.findUniqueOrThrow({ where: { email: "awa@example.com" } });
    expect(u.emailVerified).toBe(true);
    // Le pseudo est CHOISI, plus tiré au sort : il forme l'adresse du Mur.
    expect(u.username).toBe("awa");
    expect(u.acceptedTermsVersion).not.toBeNull();
  });

  it("la deuxième connexion retrouve le même compte, sans repasser par l'inscription", async () => {
    const a = await otp.issue("awa@example.com", "login");
    const r = await auth.verifyOtp({ email: "awa@example.com", code: a.code, deviceId: "dev-1" });
    if (r.outcome !== "registration") throw new Error("inscription attendue");
    await auth.register({ registrationToken: r.registrationToken, username: "awa", deviceId: "dev-1" });

    const b = await otp.issue("awa@example.com", "login");
    const s = await auth.verifyOtp({ email: "awa@example.com", code: b.code, deviceId: "dev-1" });
    expect(s.outcome).toBe("session");
    if (s.outcome !== "session") throw new Error("session attendue");
    expect(s.isNewAccount).toBe(false);
    expect(await db.prisma.user.count()).toBe(1);
  });

  // Le jeton dit qu'une adresse a été VÉRIFIÉE, pas qu'elle est libre. Entre
  // la vérification et l'inscription, la même adresse a pu s'inscrire par une
  // autre voie — Google, par exemple.
  it("refuse une inscription sur une adresse devenue occupée", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const r = await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    if (r.outcome !== "registration") throw new Error("inscription attendue");

    await db.prisma.user.create({
      data: { email: "awa@example.com", username: "quelquun", referralCode: "ZZZ111" },
    });

    await expect(
      auth.register({ registrationToken: r.registrationToken, username: "awa", deviceId: "dev-1" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("refuse un pseudo déjà pris, plutôt que d'en inventer un autre", async () => {
    const premier = await otp.issue("a@example.com", "login");
    const r1 = await auth.verifyOtp({ email: "a@example.com", code: premier.code, deviceId: "d1" });
    if (r1.outcome !== "registration") throw new Error("inscription attendue");
    await auth.register({ registrationToken: r1.registrationToken, username: "valentine", deviceId: "d1" });

    const second = await otp.issue("b@example.com", "login");
    const r2 = await auth.verifyOtp({ email: "b@example.com", code: second.code, deviceId: "d2" });
    if (r2.outcome !== "registration") throw new Error("inscription attendue");

    // Le pseudo est un CHOIX : s'il est pris, l'utilisateur doit le savoir.
    // Retenter en silence avec un autre n'aurait aucun sens — on ne peut pas
    // deviner celui qu'il voulait.
    await expect(
      auth.register({ registrationToken: r2.registrationToken, username: "valentine", deviceId: "d2" }),
    ).rejects.toMatchObject({ code: "username_taken" });
  });

  it("le plafond par appareil refuse le quatrième compte", async () => {
    for (const n of [1, 2, 3]) await inscrire(`u${n}@example.com`, "partagé");
    await expect(inscrire("u4@example.com", "partagé"))
      .rejects.toMatchObject({ code: "device_limit_reached" });
    expect(await db.prisma.user.count()).toBe(3); // rien n'a été créé
  });

  // Le plafond se signale DÈS la vérification, sans bloquer : à quoi bon
  // faire choisir un pseudo à quelqu'un dont la création sera refusée au bout.
  // Il ne fait pas foi pour autant — la décision se prend sous verrou, à la
  // création, où deux inscriptions simultanées ne peuvent pas se croiser.
  it("le plafond se signale à la vérification, sans la refuser", async () => {
    for (const n of [1, 2, 3]) await inscrire(`u${n}@example.com`, "partagé");
    const { code } = await otp.issue("u4@example.com", "login");
    const r = await auth.verifyOtp({ email: "u4@example.com", code, deviceId: "partagé" });
    if (r.outcome !== "registration") throw new Error("inscription attendue");
    expect(r.deviceLimitReached).toBe(true);
  });

  it("un compte suspendu ne peut pas ouvrir de session", async () => {
    await inscrire("awa@example.com", "dev-1");
    await db.prisma.user.update({ where: { email: "awa@example.com" }, data: { status: "suspended" } });
    const next = await otp.issue("awa@example.com", "login");
    await expect(auth.verifyOtp({ email: "awa@example.com", code: next.code, deviceId: "dev-1" }))
      .rejects.toMatchObject({ code: "account_suspended" });
  });

  it("chaque tentative laisse une trace, réussie comme échouée", async () => {
    await inscrire("awa@example.com", "dev-1");
    await auth.verifyOtp({ email: "awa@example.com", code: "000000", deviceId: "dev-1" }).catch(() => {});
    const rows = await db.prisma.loginActivity.findMany();
    // Deux réussites : la vérification du code, puis la création du compte.
    // Le parcours compte deux étapes depuis que le parrainage doit être
    // atomique avec la création — chacune laisse sa trace.
    expect(rows.map((r) => r.result).sort()).toEqual(["failure", "success", "success"]);
  });

  it("demander un code pour une adresse inconnue ne le dit pas", async () => {
    const connue = await auth.requestOtp({ email: "awa@example.com" });
    const inconnue = await auth.requestOtp({ email: "personne@example.com" });
    // Même forme, aucun indice — le délai annoncé compris, qui ne dépend que
    // du compteur de la boîte visée et non de l'existence d'un compte.
    expect(connue).toEqual(inconnue);
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
    // Le délai annoncé en fait partie : il ne dépend que du compteur de la
    // boîte visée, jamais de l'existence d'un compte. Un délai qui différerait
    // entre les deux dirait lesquelles sont connues.
    expect(connue).toEqual({ sent: true, retryAfterSeconds: 5 });
    expect(inconnue).toEqual({ sent: true, retryAfterSeconds: 5 });
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
    for (let i = 0; i < 3; i++) {
      await auth.requestOtp({ email: "bombardée@example.com" });
      await franchirLaMarche();
    }
    await expect(auth.requestOtp({ email: "bombardée@example.com" }))
      .rejects.toMatchObject({ code: "rate_limited" });
  });

  // Revue tour 2, point 1 : rate_limit_hit.key n'est pas une colonne citext
  // (contrairement à user.email) — sans normalisation explicite de la casse
  // avant de composer la clé, "awa@x.com", "Awa@x.com" et "AWA@X.COM"
  // ouvriraient trois compteurs distincts pour la même boîte réelle,
  // c'est-à-dire aucun plafond du tout.
  it("le plafond par adresse résiste à un changement de casse", async () => {
    for (let i = 0; i < 3; i++) {
      await auth.requestOtp({ email: "casse@example.com" });
      await franchirLaMarche();
    }
    await expect(auth.requestOtp({ email: "CASSE@EXAMPLE.COM" }))
      .rejects.toMatchObject({ code: "rate_limited" });
  });

  it("borne les demandes par origine, tous destinataires confondus", async () => {
    // Vingt adresses DIFFÉRENTES : chacune a son propre compteur, donc aucune
    // ne bute sur le délai croissant. C'est bien le plafond par origine qui
    // arrête le vingt-et-unième — celui qui balaie un annuaire.
    for (let i = 0; i < 20; i++) await auth.requestOtp({ email: `cible-${i}@example.com`, ip: "203.0.113.9" });
    await expect(auth.requestOtp({ email: "cible-encore@example.com", ip: "203.0.113.9" }))
      .rejects.toMatchObject({ code: "rate_limited" });
  });

  // Revue tour 1 : deviceId facultatif dans le schéma de contrat, mais le
  // plafond par appareil se contournerait en l'omettant si le service ne
  // l'exigeait pas lui-même pour CRÉER un compte.
  // L'identifiant d'appareil est exigé par le CONTRAT de /auth/register, non
  // plus par la vérification : c'est là que le compte naît, donc là que le
  // plafond s'applique. Le rendre facultatif rouvrirait le contournement.
  it("la vérification ne demande pas d'identifiant d'appareil", async () => {
    const { code } = await otp.issue("sans-appareil@example.com", "login");
    const r = await auth.verifyOtp({ email: "sans-appareil@example.com", code });
    expect(r.outcome).toBe("registration");
    expect(await db.prisma.user.count()).toBe(0); // et rien n'est créé
  });

  it("se connecter à un compte existant ne demande pas d'identifiant d'appareil", async () => {
    await inscrire("awa@example.com", "dev-1");
    const b = await otp.issue("awa@example.com", "login");
    await expect(auth.verifyOtp({ email: "awa@example.com", code: b.code })).resolves.toMatchObject({
      outcome: "session", isNewAccount: false,
    });
  });

  // Revue tour 1 : ces trois refus surviennent après une vérification de
  // code réussie — sans trace, un porteur de code valide pourrait buter
  // dessus indéfiniment sans que rien n'en garde le souvenir.
  it("le refus par plafond d'appareil laisse une trace", async () => {
    for (const n of [1, 2, 3]) await inscrire(`u${n}@example.com`, "partagé");
    await inscrire("u4@example.com", "partagé").catch(() => {});
    const rows = await db.prisma.loginActivity.findMany({ where: { attemptedEmail: "u4@example.com" } });
    // Deux traces : la vérification a réussi — le code était bon — et la
    // création a été refusée. Sans la seconde, un porteur de code valide
    // buterait sur ce mur sans qu'il en reste rien.
    expect(rows.map((r) => r.result).sort()).toEqual(["failure", "success"]);
  });

  it("le refus d'un compte suspendu laisse une trace", async () => {
    await inscrire("awa@example.com", "dev-1");
    await db.prisma.user.update({ where: { email: "awa@example.com" }, data: { status: "suspended" } });
    const next = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code: next.code, deviceId: "dev-1" }).catch(() => {});
    const rows = await db.prisma.loginActivity.findMany({ where: { attemptedEmail: "awa@example.com" } });
    // Trois traces : la vérification de l'inscription, la création, puis le
    // refus. Un porteur de code valide qui bute sur ce mur doit laisser une
    // trace comme un succès l'aurait fait.
    expect(rows.map((r) => r.result).sort()).toEqual(["failure", "success", "success"]);
  });

  it("un compte en attente de suppression ne peut pas ouvrir de session, et le refus laisse une trace", async () => {
    await inscrire("awa@example.com", "dev-1");
    await db.prisma.user.update({ where: { email: "awa@example.com" }, data: { status: "pending_deletion" } });
    const next = await otp.issue("awa@example.com", "login");
    await expect(auth.verifyOtp({ email: "awa@example.com", code: next.code, deviceId: "dev-1" }))
      .rejects.toMatchObject({ code: "account_pending_deletion" });
    const rows = await db.prisma.loginActivity.findMany({ where: { attemptedEmail: "awa@example.com" } });
    expect(rows.map((r) => r.result).sort()).toEqual(["failure", "success", "success"]);
  });

  // Le pseudo n'est plus tiré au sort : il est choisi. La collision qui compte
  // est donc celle d'un CHOIX déjà pris, éprouvée plus haut par « refuse un
  // pseudo déjà pris ». Reste la collision du code de parrainage, lui bien
  // tiré au sort — une malchance, qu'on absorbe par un nouveau tirage.
  it("une collision de code de parrainage se retire, sans perdre le parcours", async () => {
    await db.prisma.user.create({
      data: { email: "deja-la@example.com", username: "deja", referralCode: "3q2+7w" },
    });
    cryptoOverride.nextRandomBytes = () => Buffer.from("deadbeefcafe", "hex");

    const { code } = await otp.issue("nouveau@example.com", "login");
    const r = await auth.verifyOtp({ email: "nouveau@example.com", code, deviceId: "dev-collision" });
    if (r.outcome !== "registration") throw new Error("inscription attendue");

    const s = await auth.register({
      registrationToken: r.registrationToken, username: "nouveau", deviceId: "dev-collision",
    });
    expect(s.isNewAccount).toBe(true);
    const u = await db.prisma.user.findUniqueOrThrow({ where: { email: "nouveau@example.com" } });
    expect(u.referralCode).not.toBe("3q2+7w");
  });
});
