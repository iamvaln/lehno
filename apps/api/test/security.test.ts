import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { SecurityService } from "../src/me/security.service.js";
import { TokenService } from "../src/auth/token.service.js";

const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

describe("sécurité et connexions", () => {
  let db: TestDb;
  let tokens: TokenService;
  let security: SecurityService;
  let userId: string;
  let autreUserId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    tokens = new TokenService(db.prisma as never, SECRET);
    security = new SecurityService(db.prisma as never, tokens);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    userId = u.id;
    const autre = await db.prisma.user.create({
      data: { email: "karim@example.com", username: "karim", referralCode: "KAR1" },
    });
    autreUserId = autre.id;
  });

  describe("connexions récentes — une lignée, pas un jeton", () => {
    it("un téléphone rafraîchi plusieurs fois ne rend qu'UNE session", async () => {
      const premier = await tokens.issuePair(userId, "Chrome — macOS");
      const deuxieme = await tokens.rotate(premier.refreshToken, "Chrome — macOS");
      await tokens.rotate(deuxieme.refreshToken, "Chrome — macOS");

      const sessions = await security.listSessions(userId);
      expect(sessions).toHaveLength(1);
    });

    it("deux appareils distincts rendent deux sessions", async () => {
      await tokens.issuePair(userId, "Chrome — macOS");
      await tokens.issuePair(userId, "Safari — iOS");

      const sessions = await security.listSessions(userId);
      expect(sessions).toHaveLength(2);
    });

    it("la date d'ouverture est celle du premier jeton, la dernière activité celle du plus récent", async () => {
      const premier = await tokens.issuePair(userId, "Chrome — macOS");
      await new Promise((r) => setTimeout(r, 10));
      await tokens.rotate(premier.refreshToken, "Chrome — macOS");

      const [session] = await security.listSessions(userId);
      expect(session).toBeDefined();
      expect(new Date(session!.lastActiveAt).getTime()).toBeGreaterThan(new Date(session!.createdAt).getTime());
    });

    it("une lignée révoquée ne paraît plus dans la liste", async () => {
      const paire = await tokens.issuePair(userId, "Chrome — macOS");
      await tokens.revokeFamily(paire.refreshToken);

      expect(await security.listSessions(userId)).toHaveLength(0);
    });

    it("ne rend jamais les sessions d'un autre compte", async () => {
      await tokens.issuePair(userId, "Chrome — macOS");
      await tokens.issuePair(autreUserId, "Safari — iOS");

      const sessions = await security.listSessions(userId);
      expect(sessions).toHaveLength(1);
    });

    it("aucune adresse ne sort de la session rendue", async () => {
      await tokens.issuePair(userId, "Chrome — macOS", "102.244.18.7");

      const [session] = await security.listSessions(userId);
      expect(session).not.toHaveProperty("ip");
      expect(session).not.toHaveProperty("location");
    });
  });

  describe("se déconnecter de partout", () => {
    it("révoque toutes les lignées du compte", async () => {
      const a = await tokens.issuePair(userId, "Chrome — macOS");
      const b = await tokens.issuePair(userId, "Safari — iOS");

      await security.logoutEverywhere(userId, null);

      await expect(tokens.rotate(a.refreshToken)).rejects.toThrow();
      await expect(tokens.rotate(b.refreshToken)).rejects.toThrow();
    });

    it("ne révoque pas les lignées d'un autre compte", async () => {
      const paireAutre = await tokens.issuePair(autreUserId, "Chrome — macOS");

      await security.logoutEverywhere(userId, null);

      await expect(tokens.rotate(paireAutre.refreshToken)).resolves.toBeDefined();
    });
  });

  describe("moyens de connexion externes", () => {
    it("rend les identités rattachées, sans la connexion par code (absente de la table)", async () => {
      await db.prisma.federatedIdentity.create({
        data: { userId, provider: "google", providerUserId: "g-1" },
      });

      const identities = await security.listIdentities(userId);
      expect(identities).toHaveLength(1);
      expect(identities[0]!.provider).toBe("google");
    });

    it("ne rend jamais les identités d'un autre compte", async () => {
      await db.prisma.federatedIdentity.create({
        data: { userId: autreUserId, provider: "apple", providerUserId: "a-1" },
      });

      expect(await security.listIdentities(userId)).toHaveLength(0);
    });
  });

  /* « Déconnecter les autres appareils » doit épargner celui qui le demande.
   *
   * Il les révoquait tous, y compris le sien — non par choix mais par
   * ignorance : le jeton d'accès ne portait que le compte, jamais la session.
   * Le libellé, lui, promettait « les autres » dans les deux langues. */
  describe("déconnecter les autres appareils", () => {
    it("épargne la lignée qui appelle", async () => {
      const mienne = await tokens.issuePair(userId, "Chrome — macOS");
      const autre = await tokens.issuePair(userId, "Safari — iOS");

      await security.logoutEverywhere(userId, mienne.sessionId);

      await expect(tokens.rotate(mienne.refreshToken)).resolves.toBeDefined();
      await expect(tokens.rotate(autre.refreshToken)).rejects.toThrow();
    });

    /* Sur un jeton émis AVANT que `sid` n'y voyage, la lignée est inconnue : on
       retombe sur l'ancien comportement. C'est le bon côté du doute — mieux
       vaut déconnecter une session de trop que d'en laisser une ouverte parce
       qu'on ne savait pas la nommer. */
    it("révoque tout quand la lignée est inconnue", async () => {
      const a = await tokens.issuePair(userId, "Chrome — macOS");
      const b = await tokens.issuePair(userId, "Safari — iOS");

      await security.logoutEverywhere(userId, null);

      await expect(tokens.rotate(a.refreshToken)).rejects.toThrow();
      await expect(tokens.rotate(b.refreshToken)).rejects.toThrow();
    });

    // Les lignées d'un AUTRE compte ne bougent pas.
    it("ne touche pas aux sessions d'un autre compte", async () => {
      const mienne = await tokens.issuePair(userId, "Chrome");
      const ailleurs = await tokens.issuePair(autreUserId, "Firefox");

      await security.logoutEverywhere(userId, mienne.sessionId);

      await expect(tokens.rotate(ailleurs.refreshToken)).resolves.toBeDefined();
    });
  });
});
