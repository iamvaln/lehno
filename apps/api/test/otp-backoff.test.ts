import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { RateLimitService } from "../src/common/rate-limit.service.js";

describe("le délai croissant entre deux demandes de code", () => {
  let db: TestDb;
  let limiteur: RateLimitService;

  const OPTS = { plafond: 3, fenetreMs: 3_600_000, baseSecondes: 5 };

  // Reculer la dernière frappe dans le temps, pour éprouver les marches sans
  // attendre réellement cent vingt-cinq secondes.
  const reculer = async (cle: string, secondes: number): Promise<void> => {
    const lignes = await db.prisma.rateLimitHit.findMany({
      where: { key: cle }, orderBy: { createdAt: "desc" },
    });
    for (const l of lignes) {
      await db.prisma.rateLimitHit.update({
        where: { id: l.id },
        data: { createdAt: new Date(l.createdAt.getTime() - secondes * 1000) },
      });
    }
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    limiteur = new RateLimitService(db.prisma as never);
  });

  describe("les marches", () => {
    // 5, puis 25, puis 125 — l'exponentielle laisse le premier renvoi presque
    // immédiat (le cas légitime, où le courriel a vraiment tardé) et rend le
    // suivant assez lointain pour qu'on aille regarder sa boîte.
    it("annonce cinq secondes après la première demande", async () => {
      const r = await limiteur.hitWithBackoff("otp:email:awa", OPTS);
      expect(r.retryAfterSeconds).toBe(5);
    });

    it("annonce vingt-cinq secondes après la deuxième", async () => {
      await limiteur.hitWithBackoff("otp:email:awa", OPTS);
      await reculer("otp:email:awa", 5);
      const r = await limiteur.hitWithBackoff("otp:email:awa", OPTS);
      expect(r.retryAfterSeconds).toBe(25);
    });
  });

  describe("ce que le délai refuse", () => {
    it("refuse une deuxième demande immédiate, en disant combien attendre", async () => {
      await limiteur.hitWithBackoff("otp:email:awa", OPTS);
      await expect(limiteur.hitWithBackoff("otp:email:awa", OPTS)).rejects.toMatchObject({
        code: "rate_limited",
      });
    });

    // Le refus DIT le délai. Sans lui, le client devrait coder la formule de
    // son côté, et deux versions du parc appliqueraient deux règles
    // différentes — celle du serveur restant la seule qui compte.
    it("le refus porte le délai restant", async () => {
      await limiteur.hitWithBackoff("otp:email:awa", OPTS);
      try {
        await limiteur.hitWithBackoff("otp:email:awa", OPTS);
        throw new Error("un refus était attendu");
      } catch (e) {
        const details = (e as { details?: { retryAfterSeconds?: number } }).details;
        expect(details?.retryAfterSeconds).toBeGreaterThan(0);
        expect(details?.retryAfterSeconds).toBeLessThanOrEqual(5);
      }
    });

    it("laisse passer une fois le délai écoulé", async () => {
      await limiteur.hitWithBackoff("otp:email:awa", OPTS);
      await reculer("otp:email:awa", 5);
      await expect(limiteur.hitWithBackoff("otp:email:awa", OPTS)).resolves.toBeDefined();
    });

    // La deuxième marche est plus haute : attendre cinq secondes ne suffit
    // plus. Sans ce cas, un délai fixe passerait pour un délai croissant.
    it("la deuxième marche exige plus que la première", async () => {
      await limiteur.hitWithBackoff("otp:email:awa", OPTS);
      await reculer("otp:email:awa", 5);
      await limiteur.hitWithBackoff("otp:email:awa", OPTS);
      await reculer("otp:email:awa", 5);
      // Cinq secondes plus tard : la première marche l'aurait laissé passer,
      // la deuxième non.
      await expect(limiteur.hitWithBackoff("otp:email:awa", OPTS)).rejects.toMatchObject({
        code: "rate_limited",
      });
    });
  });

  describe("le plafond horaire", () => {
    const troisDemandes = async (): Promise<void> => {
      await limiteur.hitWithBackoff("otp:email:awa", OPTS);
      await reculer("otp:email:awa", 10);
      await limiteur.hitWithBackoff("otp:email:awa", OPTS);
      await reculer("otp:email:awa", 200);
      await limiteur.hitWithBackoff("otp:email:awa", OPTS);
    };

    it("refuse la quatrième demande de l'heure, quel que soit le temps écoulé", async () => {
      await troisDemandes();
      // Une heure de patience ne débloquerait pas : c'est le plafond, pas le
      // délai. On recule d'un jour pour l'éprouver.
      await expect(limiteur.hitWithBackoff("otp:email:awa", OPTS)).rejects.toMatchObject({
        code: "rate_limited",
      });
    });

    // Le plafond GLISSE : on dit quand la plus ancienne frappe sortira de la
    // fenêtre, pas « dans une heure ». Sinon quelqu'un qui a demandé son
    // troisième code il y a cinquante-neuf minutes s'entend dire d'attendre
    // soixante de plus.
    it("annonce quand la fenêtre se libère, pas une heure pleine", async () => {
      await troisDemandes();
      // On recule juste assez pour que la plus ancienne frappe soit à 3400 s
      // — encore DANS la fenêtre, qui se libère donc dans 200 s et non dans
      // une heure. Reculer davantage la ferait sortir, et le plafond
      // tomberait : ce n'est pas ce qu'on éprouve ici.
      await reculer("otp:email:awa", 3190);
      try {
        await limiteur.hitWithBackoff("otp:email:awa", OPTS);
        throw new Error("un refus était attendu");
      } catch (e) {
        const details = (e as { details?: { retryAfterSeconds?: number } }).details;
        expect(details?.retryAfterSeconds).toBeLessThan(300);
        expect(details?.retryAfterSeconds).toBeGreaterThan(0);
      }
    });

    it("rouvre quand la fenêtre a glissé", async () => {
      await troisDemandes();
      await reculer("otp:email:awa", 3_700);
      await expect(limiteur.hitWithBackoff("otp:email:awa", OPTS)).resolves.toBeDefined();
    });
  });

  // Deux boîtes n'ont aucune raison de se gêner : le compteur est par clé.
  it("ne fait pas payer une boîte pour une autre", async () => {
    await limiteur.hitWithBackoff("otp:email:awa", OPTS);
    await expect(limiteur.hitWithBackoff("otp:email:bila", OPTS)).resolves.toBeDefined();
  });

  // Le message d'erreur atteint le journal ET la réponse : il ne doit jamais
  // porter l'adresse elle-même, seulement le périmètre.
  it("ne laisse pas fuiter l'adresse dans le message de refus", async () => {
    await limiteur.hitWithBackoff("otp:email:awa@example.com", OPTS);
    await expect(limiteur.hitWithBackoff("otp:email:awa@example.com", OPTS))
      .rejects.toMatchObject({ message: expect.not.stringContaining("awa@example.com") });
  });
});
