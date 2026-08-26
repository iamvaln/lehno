import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { creditBalanceSchema, referralSummarySchema, invitationSchema } from "@lehno/contracts";
import { CreditsService } from "../src/onboarding/credits.controller.js";
import { SignupService } from "../src/onboarding/signup.service.js";
import { LegalService } from "../src/public/legal.controller.js";

describe("crédits, parrainage et invitation", () => {
  let db: TestDb;
  let credits: CreditsService;
  let signup: SignupService;

  const creer = async (referralCode?: string) => {
    const r = await signup.creer({
      email: `${randomBytes(6).toString("hex")}@example.com`,
      emailVerified: true,
      username: `u${randomBytes(4).toString("hex")}`,
      deviceId: randomBytes(8).toString("hex"),
      ...(referralCode !== undefined ? { referralCode } : {}),
    });
    if (r.plafondAtteint) throw new Error("plafond inattendu");
    const u = await db.prisma.user.findUniqueOrThrow({ where: { id: r.user.id } });
    return { id: u.id, code: u.referralCode, username: u.username };
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    credits = new CreditsService(db.prisma as never);
    signup = new SignupService(db.prisma as never, new LegalService());
    for (const [key, value] of [
      ["signup_free_credits", "5"],
      ["referral_bonus_referrer", "5"],
      ["referral_bonus_invited", "5"],
    ] as const) {
      await db.prisma.systemParameter.upsert({
        where: { key }, update: { value }, create: { key, value, valueType: "number" },
      });
    }
  });

  describe("le solde", () => {
    it("rend la somme des mouvements et leur histoire", async () => {
      const u = await creer();
      const s = await credits.solde(u.id);
      expect(creditBalanceSchema.safeParse(s).success).toBe(true);
      expect(s.balance).toBe(5);
      expect(s.transactions).toHaveLength(1);
      // Le CODE, pas la phrase : c'est lui que le client traduit, et lui qui
      // permet à l'écran de bienvenue de séparer ses deux lignes.
      expect(s.transactions[0]).toMatchObject({ type: "grant", source: "signup_grant", amount: 5 });
    });

    // Un débit réduit le solde. Le montant est signé : le compter positif le
    // gonflerait au lieu de le réduire.
    it("un débit réduit le solde", async () => {
      const u = await creer();
      await db.prisma.creditTransaction.create({
        data: { userId: u.id, type: "consumption", source: "consumption", amount: -3 },
      });
      expect((await credits.solde(u.id)).balance).toBe(2);
    });

    // Le cloisonnement : le solde d'un compte ne doit jamais inclure les
    // mouvements d'un autre. C'est une somme filtrée, pas une somme globale.
    it("ne mélange pas les soldes de deux comptes", async () => {
      const a = await creer();
      const b = await creer();
      await db.prisma.creditTransaction.create({
        data: { userId: b.id, type: "grant", source: "admin_adjustment", amount: 100, reason: "geste commercial" },
      });
      expect((await credits.solde(a.id)).balance).toBe(5);
      expect((await credits.solde(b.id)).balance).toBe(105);
    });
  });

  describe("le résumé de parrainage", () => {
    it("rend son code, ses filleuls et ce qu'il a gagné", async () => {
      const parrain = await creer();
      const filleul = await creer(parrain.code);

      const r = await credits.parrainage(parrain.id);
      expect(referralSummarySchema.safeParse(r).success).toBe(true);
      expect(r.code).toBe(parrain.code);
      expect(r.invited).toHaveLength(1);
      expect(r.invited[0]).toMatchObject({ username: filleul.username, status: "credited" });
      expect(r.creditsEarned).toBe(5);
    });

    // LE piège de ce calcul : les mouvements rattachés à un parrainage
    // existent en DEUX exemplaires — un pour le parrain, un pour le filleul.
    // Sans le filtre sur le compte, le parrain verrait le double de ce qu'il
    // a réellement gagné.
    it("ne compte que SES gains, pas ceux versés à ses filleuls", async () => {
      const parrain = await creer();
      await creer(parrain.code);
      await creer(parrain.code);

      const r = await credits.parrainage(parrain.id);
      expect(r.invited).toHaveLength(2);
      // Deux filleuls × 5 crédits pour le parrain. Les 5 versés à CHAQUE
      // filleul ne lui appartiennent pas.
      expect(r.creditsEarned).toBe(10);
    });

    // Un parrain n'a pas à connaître la boîte de ses filleuls sous prétexte
    // qu'il les a invités. Le pseudo suffit à l'écran, l'adresse ne doit pas
    // sortir.
    it("ne laisse pas fuiter l'adresse d'un filleul", async () => {
      const parrain = await creer();
      await creer(parrain.code);
      const r = await credits.parrainage(parrain.id);
      expect(JSON.stringify(r)).not.toMatch(/@example\.com/);
    });

    // Un filleul qui supprime son compte laisse une trace anonyme (on delete
    // set null). On ne l'affiche pas plutôt que d'inventer un nom.
    it("n'affiche pas un filleul dont le compte a disparu", async () => {
      const parrain = await creer();
      const filleul = await creer(parrain.code);
      await db.prisma.user.delete({ where: { id: filleul.id } });

      const r = await credits.parrainage(parrain.id);
      expect(r.invited).toHaveLength(0);
      // La trace, elle, demeure : c'est ce qui empêche de rejouer le crédit.
      expect(await db.prisma.referral.count({ where: { referrerId: parrain.id } })).toBe(1);
    });
  });

  describe("la page d'invitation", () => {
    it("rend qui invite et ce que l'invité y gagne", async () => {
      const parrain = await creer();
      const inv = await credits.invitation(parrain.code);
      expect(invitationSchema.safeParse(inv).success).toBe(true);
      expect(inv).toMatchObject({
        code: parrain.code, inviterUsername: parrain.username, creditsForInvited: 5,
      });
    });

    // Cette page s'ouvre SANS compte, et son code circule par message et par
    // réseau. Tout ce qu'on y met circule avec lui.
    it("ne laisse rien fuiter du parrain au-delà de son pseudo", async () => {
      const parrain = await creer();
      const inv = await credits.invitation(parrain.code);
      expect(Object.keys(inv).sort()).toEqual(["code", "creditsForInvited", "inviterUsername"]);
      expect(JSON.stringify(inv)).not.toMatch(/@example\.com/);
    });

    // 404 plutôt qu'un message distinguant « code inconnu » : sinon ce point
    // d'entrée devient un oracle pour énumérer les codes existants.
    it("rend not_found sur un code inconnu", async () => {
      await expect(credits.invitation("INEXISTANT")).rejects.toMatchObject({ code: "not_found" });
    });
  });
});
