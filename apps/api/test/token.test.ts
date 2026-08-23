import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { TokenService } from "../src/auth/token.service.js";

const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

describe("sessions", () => {
  let db: TestDb;
  let tokens: TokenService;
  let userId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    tokens = new TokenService(db.prisma as never, SECRET);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    userId = u.id;
  });

  it("le jeton d'accès porte le compte et se vérifie", async () => {
    const pair = await tokens.issuePair(userId);
    expect(tokens.verifyAccess(pair.accessToken)).toEqual({ userId });
  });

  it("le jeton de rafraîchissement n'est jamais stocké en clair", async () => {
    const pair = await tokens.issuePair(userId);
    const row = await db.prisma.refreshToken.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(pair.refreshToken);
    expect(row.tokenHash).toHaveLength(64); // SHA-256 en hexadécimal
  });

  it("la rotation rend un jeton neuf et consomme l'ancien", async () => {
    const first = await tokens.issuePair(userId);
    const second = await tokens.rotate(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    const rows = await db.prisma.refreshToken.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows[0]!.consumedAt).not.toBeNull();
    expect(rows[1]!.consumedAt).toBeNull();
    expect(rows[1]!.familyId).toBe(rows[0]!.familyId); // même lignée
  });

  it("rejouer un jeton consommé abat toute la lignée", async () => {
    const first = await tokens.issuePair(userId);
    const second = await tokens.rotate(first.refreshToken);
    // le voleur présente l'ancien
    await expect(tokens.rotate(first.refreshToken)).rejects.toMatchObject({ code: "refresh_reused" });
    // le légitime tombe aussi : on ne sait pas qui est qui
    await expect(tokens.rotate(second.refreshToken)).rejects.toThrow();
    const vivants = await db.prisma.refreshToken.count({ where: { revokedAt: null } });
    expect(vivants).toBe(0);
  });

  it("plusieurs rotations concurrentes sur le même jeton : une seule gagne, la lignée tombe", async () => {
    const first = await tokens.issuePair(userId);
    // Comme pour l'OTP : une seule connexion Prisma partagée ne fait pas
    // apparaître la course de façon fiable (la latence de la première requête
    // sur une connexion neuve biaise la course). On instancie N connexions
    // indépendantes, on les chauffe, puis on les lance en même temps sur le
    // même jeton de rafraîchissement.
    const N = 4;
    const clients = Array.from({ length: N }, () => new PrismaClient({ datasources: { db: { url: db.url } } }));
    const services = clients.map((c) => new TokenService(c as never, SECRET));
    try {
      await Promise.all(clients.map((c) => c.$queryRaw`select 1`));
      const results = await Promise.allSettled(services.map((s) => s.rotate(first.refreshToken)));
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(N - 1);
      // Le premier perdant à relire l'état détecte le rejeu (refresh_reused) et
      // révoque la lignée ; les perdants suivants peuvent la trouver déjà
      // révoquée (session_expired) selon l'ordre d'arrivée — les deux sont des
      // refus légitimes. Ce qui compte : au moins un rejet nomme explicitement
      // le rejeu, et tous sont des échecs d'authentification reconnus.
      const codes = rejected.map((r) => (r.reason as { code?: string }).code);
      expect(codes).toContain("refresh_reused");
      for (const code of codes) expect(["refresh_reused", "session_expired"]).toContain(code);
      // le rejeu détecté abat toute la lignée, y compris le jeton que le gagnant vient d'obtenir
      const vivants = await db.prisma.refreshToken.count({ where: { revokedAt: null } });
      expect(vivants).toBe(0);
    } finally {
      await Promise.all(clients.map((c) => c.$disconnect()));
    }
  });

  it("un jeton inconnu est refusé sans rien révéler", async () => {
    await expect(tokens.rotate("inconnu")).rejects.toMatchObject({ code: "session_expired" });
  });

  it("la déconnexion révoque la lignée côté serveur", async () => {
    const pair = await tokens.issuePair(userId);
    await tokens.revokeFamily(pair.refreshToken);
    await expect(tokens.rotate(pair.refreshToken)).rejects.toThrow();
  });
});
