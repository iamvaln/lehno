import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

describe("schéma — parrainage et crédits", () => {
  let db: TestDb;
  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await db.close(); });

  const compte = async (): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    return u.id;
  };

  describe("l'anti-double-crédit", () => {
    // La règle la plus coûteuse à rater du lot : elle porte sur de l'argent.
    // Elle vit dans le SCHÉMA — contrainte d'unicité sur invited_user_id — et
    // non dans du code applicatif qu'on oublie de relire. Une garde en code se
    // contourne par une seconde voie d'inscription, une reprise, une course
    // entre deux requêtes ; une contrainte de base ne se contourne pas.
    it("un filleul ne peut être rattaché qu'à un seul parrainage", async () => {
      const parrain = await compte();
      const autreParrain = await compte();
      const filleul = await compte();

      await db.prisma.referral.create({
        data: { referrerId: parrain, invitedUserId: filleul, codeUsed: "AAA111" },
      });

      await expect(
        db.prisma.referral.create({
          data: { referrerId: autreParrain, invitedUserId: filleul, codeUsed: "BBB222" },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    });

    // L'unicité ne doit pas empêcher un parrain d'avoir plusieurs filleuls,
    // ni plusieurs invitations d'attendre leur inscription : elle porte sur le
    // filleul, pas sur le parrain.
    it("un parrain peut avoir plusieurs filleuls", async () => {
      const parrain = await compte();
      const a = await compte();
      const b = await compte();
      await db.prisma.referral.create({ data: { referrerId: parrain, invitedUserId: a, codeUsed: "X" } });
      await db.prisma.referral.create({ data: { referrerId: parrain, invitedUserId: b, codeUsed: "X" } });
      expect(await db.prisma.referral.count({ where: { referrerId: parrain } })).toBe(2);
    });

    // Plusieurs invitations peuvent coexister sans filleul : « invited » est
    // l'état d'une invitation lancée que personne n'a encore honorée. Un
    // UNIQUE naïf sur une colonne nullable les aurait interdites — PostgreSQL
    // ne compare pas les NULL entre eux, et c'est ce qui sauve ce cas.
    it("plusieurs invitations sans filleul coexistent", async () => {
      const parrain = await compte();
      await db.prisma.referral.create({ data: { referrerId: parrain, codeUsed: "X" } });
      await db.prisma.referral.create({ data: { referrerId: parrain, codeUsed: "X" } });
      expect(await db.prisma.referral.count()).toBe(2);
    });

    // La trace du parrainage doit survivre au départ du filleul : sans quoi
    // supprimer puis recréer un compte remettrait le crédit en jeu. Même
    // logique que device_signup, dont la ligne survit pour que le plafond par
    // appareil ne se contourne pas.
    it("la trace survit à la suppression du filleul", async () => {
      const parrain = await compte();
      const filleul = await compte();
      await db.prisma.referral.create({
        data: { referrerId: parrain, invitedUserId: filleul, codeUsed: "X" },
      });

      await db.prisma.user.delete({ where: { id: filleul } });

      const restant = await db.prisma.referral.findFirst({ where: { referrerId: parrain } });
      expect(restant).not.toBeNull();
      expect(restant?.invitedUserId).toBeNull();
    });
  });

  describe("le registre des crédits", () => {
    // Le solde est une SOMME, jamais une colonne. C'est ce qui garantit qu'un
    // solde affiché correspond à l'histoire qui l'a produit — une colonne
    // stockée peut se désynchroniser de son registre, une somme ne le peut pas.
    it("le solde se calcule, il ne se stocke pas", async () => {
      const u = await compte();
      await db.prisma.creditTransaction.createMany({
        data: [
          { userId: u, type: "grant", amount: 5, reason: "inscription" },
          { userId: u, type: "grant", amount: 5, reason: "parrainage" },
          { userId: u, type: "consumption", amount: -3, reason: "portrait" },
        ],
      });

      const somme = await db.prisma.creditTransaction.aggregate({
        where: { userId: u }, _sum: { amount: true },
      });
      expect(somme._sum.amount).toBe(7);

      // Aucune colonne de solde nulle part : si quelqu'un en ajoutait une, ce
      // cas ne la verrait pas — mais le schéma n'en porte pas, et c'est la
      // somme qui fait foi partout dans le code.
      const compteEnBase = await db.prisma.user.findUnique({ where: { id: u } });
      expect(compteEnBase).not.toHaveProperty("creditBalance");
      expect(compteEnBase).not.toHaveProperty("credits");
    });

    // Un débit est un montant NÉGATIF, pas un type qu'on interprète : sans
    // cela, une somme naïve compterait les consommations comme des crédits.
    it("un débit est un montant négatif", async () => {
      const u = await compte();
      await db.prisma.creditTransaction.create({
        data: { userId: u, type: "consumption", amount: -3 },
      });
      const somme = await db.prisma.creditTransaction.aggregate({
        where: { userId: u }, _sum: { amount: true },
      });
      expect(somme._sum.amount).toBe(-3);
    });
  });

  describe("l'acceptation des conditions", () => {
    // Les deux colonnes sont nullables, et c'est voulu : les comptes créés
    // avant cette migration n'ont rien accepté d'explicitement tracé, et
    // prétendre le contraire serait faux.
    it("se trace avec sa version, pas seulement sa date", async () => {
      const u = await compte();
      await db.prisma.user.update({
        where: { id: u },
        data: { acceptedTermsAt: new Date(), acceptedTermsVersion: "2026-08-23" },
      });
      const relu = await db.prisma.user.findUnique({ where: { id: u } });
      expect(relu?.acceptedTermsVersion).toBe("2026-08-23");
      expect(relu?.acceptedTermsAt).toBeInstanceOf(Date);
    });
  });
});
