import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

describe("schéma — identité", () => {
  let db: TestDb;
  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await db.close(); });

  const user = (over: Record<string, unknown> = {}) => ({
    email: "awa@example.com", username: "awa", referralCode: "AWA123", ...over,
  });

  it("l'adresse est unique sans égard à la casse", async () => {
    await db.prisma.user.create({ data: user() });
    await expect(
      db.prisma.user.create({ data: user({ email: "AWA@EXAMPLE.COM", username: "awa2", referralCode: "AWA124" }) }),
    ).rejects.toThrow();
  });

  it("le pseudo est unique sans égard à la casse", async () => {
    await db.prisma.user.create({ data: user() });
    await expect(
      db.prisma.user.create({ data: user({ email: "b@example.com", username: "AWA", referralCode: "B1" }) }),
    ).rejects.toThrow();
  });

  it("le thème vaut « system » par défaut et la langue « fr »", async () => {
    const u = await db.prisma.user.create({ data: user() });
    expect(u.theme).toBe("system");
    expect(u.uiLanguage).toBe("fr");
    expect(u.sendHour).toBe(9);
  });

  it("une identité externe ne pointe que vers un compte", async () => {
    const a = await db.prisma.user.create({ data: user() });
    const b = await db.prisma.user.create({ data: user({ email: "b@example.com", username: "b", referralCode: "B1" }) });
    const identity = { provider: "google" as const, providerUserId: "g-1" };
    await db.prisma.federatedIdentity.create({ data: { ...identity, userId: a.id } });
    await expect(
      db.prisma.federatedIdentity.create({ data: { ...identity, userId: b.id } }),
    ).rejects.toThrow();
  });

  it("supprimer un compte emporte ses jetons de rafraîchissement", async () => {
    const u = await db.prisma.user.create({ data: user() });
    await db.prisma.refreshToken.create({
      data: { userId: u.id, familyId: crypto.randomUUID(), tokenHash: "x".repeat(64),
              expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await db.prisma.user.delete({ where: { id: u.id } });
    expect(await db.prisma.refreshToken.count()).toBe(0);
  });

  it("la liste d'attente refuse deux fois la même adresse", async () => {
    await db.prisma.waitlistSignup.create({ data: { email: "x@example.com", locale: "fr" } });
    await expect(
      db.prisma.waitlistSignup.create({ data: { email: "X@EXAMPLE.COM", locale: "en" } }),
    ).rejects.toThrow();
  });
});
