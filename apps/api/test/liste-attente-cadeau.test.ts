import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { SignupService } from "../src/onboarding/signup.service.js";
import { LegalService } from "../src/public/legal.controller.js";

/* Le cadeau de celui qui attendait.
 *
 * La détection se fait sur l'ADRESSE, jamais sur un jeton porté par le lien :
 * un bonus dans le lien serait transférable, et dix amis toucheraient ce qui
 * était réservé à un inscrit. */
describe("le cadeau de la liste d'attente", () => {
  let db: TestDb;
  let signup: SignupService;

  const attendre = async (email: string): Promise<void> => {
    await db.prisma.waitlistSignup.create({
      data: { email, emailCanonical: email.toLowerCase() },
    });
  };

  const creer = async (email: string) => {
    const r = await signup.creer({
      email, emailVerified: true,
      username: `u${randomBytes(4).toString("hex")}`,
      deviceId: randomBytes(8).toString("hex"),
    });
    if (r.plafondAtteint) throw new Error("plafond inattendu");
    return r;
  };

  /* Les paramètres se posent EXPLICITEMENT : ils vivent en base, partagée entre
     fichiers de tests (`singleFork: true`), et un cas qui s'appuierait sur la
     valeur ambiante tomberait selon l'ordre d'exécution. */
  const poser = async (cle: string, valeur: string): Promise<void> => {
    await db.prisma.systemParameter.upsert({
      where: { key: cle },
      update: { value: valeur },
      create: { key: cle, value: valeur, valueType: "number" },
    });
  };

  const bonusDe = async (userId: string): Promise<number> => {
    const a = await db.prisma.creditTransaction.aggregate({
      where: { userId, source: "waitlist_bonus" }, _sum: { amount: true },
    });
    return a._sum.amount ?? 0;
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    signup = new SignupService(db.prisma as never, new LegalService());
    await poser("signup_free_credits", "5");
    await poser("waitlist_bonus_credits", "10");
  });

  it("offre le cadeau à qui attendait", async () => {
    await attendre("awa@example.com");
    const r = await creer("awa@example.com");
    expect(r.cadeauAttente?.credits).toBeGreaterThan(0);
    expect(await bonusDe(r.user.id)).toBeGreaterThan(0);
  });

  it("n'offre rien à qui n'attendait pas", async () => {
    const r = await creer("bila@example.com");
    expect(r.cadeauAttente).toBeNull();
    expect(await bonusDe(r.user.id)).toBe(0);
  });

  /* L'adresse se compare sous sa forme CANONIQUE : « A.W.A+lehno@gmail.com »
     et « awa@gmail.com » sont la même boîte. Sans ça, quelqu'un qui s'inscrit
     avec une variante ne toucherait pas son cadeau. */
  it("reconnaît la même boîte sous une autre écriture", async () => {
    await db.prisma.waitlistSignup.create({
      data: { email: "A.W.A+liste@gmail.com", emailCanonical: "awa@gmail.com" },
    });
    const r = await creer("awa@gmail.com");
    expect(r.cadeauAttente?.credits).toBeGreaterThan(0);
  });

  /* L'anti-double-crédit vit dans le schéma. Supprimer son compte et
     recommencer ne rend pas le cadeau disponible une seconde fois. */
  it("ne l'offre qu'une fois, même après suppression du compte", async () => {
    await attendre("awa@example.com");
    const un = await creer("awa@example.com");
    expect(un.cadeauAttente).not.toBeNull();

    await db.prisma.user.delete({ where: { id: un.user.id } });
    const deux = await creer("awa@example.com");
    expect(deux.cadeauAttente).toBeNull();
    expect(await bonusDe(deux.user.id)).toBe(0);
  });

  // La conversion se marque même quand le cadeau vaut zéro : c'est la mesure
  // de ce que la liste a rapporté, indépendamment de ce qu'on a offert.
  it("marque la conversion même sans cadeau", async () => {
    await poser("waitlist_bonus_credits", "0");
    await attendre("awa@example.com");
    const r = await creer("awa@example.com");

    expect(r.cadeauAttente?.credits).toBe(0);
    const l = await db.prisma.waitlistSignup.findFirstOrThrow({
      where: { emailCanonical: "awa@example.com" },
    });
    expect(l.convertedUserId).toBe(r.user.id);
    expect(l.convertedAt).not.toBeNull();
  });

  // Il s'ajoute au cadeau de bienvenue, il ne le remplace pas.
  it("s'ajoute au cadeau de bienvenue de tout le monde", async () => {
    await attendre("awa@example.com");
    const r = await creer("awa@example.com");
    expect(r.creditsOfferts).toBeGreaterThan(0);
    expect(r.cadeauAttente?.credits).toBeGreaterThan(0);
  });
});
