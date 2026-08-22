import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { RateLimitService } from "../src/common/rate-limit.service.js";

describe("limitation de débit", () => {
  let db: TestDb;
  let limiter: RateLimitService;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await resetDatabase(db.prisma); limiter = new RateLimitService(db.prisma as never); });

  it("laisse passer sous le plafond", async () => {
    for (let i = 0; i < 3; i++) await limiter.hit("otp:awa@example.com", 3, 60_000);
    expect(true).toBe(true);
  });

  it("refuse au-delà du plafond", async () => {
    for (let i = 0; i < 3; i++) await limiter.hit("otp:awa@example.com", 3, 60_000);
    await expect(limiter.hit("otp:awa@example.com", 3, 60_000))
      .rejects.toMatchObject({ code: "rate_limited" });
  });

  it("les clés ne se gênent pas entre elles", async () => {
    for (let i = 0; i < 3; i++) await limiter.hit("otp:awa@example.com", 3, 60_000);
    await expect(limiter.hit("otp:karim@example.com", 3, 60_000)).resolves.toBeUndefined();
  });

  it("la fenêtre glisse : les frappes anciennes ne comptent plus", async () => {
    for (let i = 0; i < 3; i++) await limiter.hit("otp:awa@example.com", 3, 60_000);
    // Antidater les frappes revient au même que d'avancer l'horloge,
    // sans toucher aux minuteries du pilote.
    await db.prisma.rateLimitHit.updateMany({
      where: { key: "otp:awa@example.com" },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });
    await expect(limiter.hit("otp:awa@example.com", 3, 60_000)).resolves.toBeUndefined();
  });
});
