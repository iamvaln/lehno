import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AuthService } from "../src/auth/auth.service.js";
import { OtpService } from "../src/auth/otp.service.js";
import { TokenService } from "../src/auth/token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

describe("authentification", () => {
  let db: TestDb;
  let auth: AuthService;
  let otp: OtpService;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    otp = new OtpService(db.prisma as never, PEPPER);
    auth = new AuthService(db.prisma as never, otp, new TokenService(db.prisma as never, SECRET));
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
});
