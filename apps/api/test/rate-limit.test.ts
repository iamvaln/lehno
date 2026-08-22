import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
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

  // Revue tour 2, point 4 : count() puis create(), sans rien qui les lie,
  // c'est le même motif lire-puis-écrire déjà corrigé dans OtpService et
  // TokenService. Une seule connexion Prisma ne suffit pas à faire
  // apparaître la course de façon fiable (voir leurs tests respectifs) :
  // on chauffe N connexions indépendantes, puis on les lance toutes en
  // même temps sur LA MÊME clé.
  it("plusieurs frappes concurrentes sur la même clé ne dépassent jamais le plafond", async () => {
    const N = 8;
    const LIMIT = 3;
    const clients = Array.from({ length: N }, () => new PrismaClient({ datasources: { db: { url: db.url } } }));
    const limiters = clients.map((c) => new RateLimitService(c as never));
    try {
      await Promise.all(clients.map((c) => c.$queryRaw`select 1`));
      const results = await Promise.allSettled(
        limiters.map((l) => l.hit("otp:course@example.com", LIMIT, 60_000)),
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(LIMIT);
      expect(rejected).toHaveLength(N - LIMIT);
      // Le compte en base ne dépasse jamais le plafond non plus : la preuve
      // qu'aucune frappe excédentaire n'a été acceptée par erreur.
      expect(await db.prisma.rateLimitHit.count({ where: { key: "otp:course@example.com" } })).toBe(LIMIT);
    } finally {
      await Promise.all(clients.map((c) => c.$disconnect()));
    }
  });
});
