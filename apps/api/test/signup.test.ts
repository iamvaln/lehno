import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { SignupService } from "../src/onboarding/signup.service.js";
import { LegalService } from "../src/public/legal.controller.js";

describe("la création de compte", () => {
  let db: TestDb;
  let signup: SignupService;

  const adresse = (): string => `${randomBytes(6).toString("hex")}@example.com`;

  const solde = async (userId: string): Promise<number> => {
    const s = await db.prisma.creditTransaction.aggregate({
      where: { userId }, _sum: { amount: true },
    });
    return s._sum.amount ?? 0;
  };

  const creer = async (over: Partial<Parameters<SignupService["creer"]>[0]> = {}) =>
    signup.creer({
      email: adresse(), emailVerified: true,
      username: `u${randomBytes(4).toString("hex")}`,
      deviceId: randomBytes(8).toString("hex"), ...over,
    });

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    signup = new SignupService(db.prisma as never, new LegalService());

    // resetDatabase PRÉSERVE system_parameter — c'est voulu, la table porte la
    // configuration semée par les migrations. Mais un test qui change un
    // paramètre contamine alors tous les suivants, et l'ordre d'exécution
    // devient une dépendance invisible. On repose donc les valeurs dont cette
    // suite dépend, à chaque cas.
    for (const [key, value] of [
      ["signup_free_credits", "5"],
      ["referral_bonus_referrer", "5"],
      ["referral_bonus_invited", "5"],
      ["max_accounts_per_device", "3"],
    ] as const) {
      await db.prisma.systemParameter.upsert({
        where: { key }, update: { value }, create: { key, value, valueType: "number" },
      });
    }
  });

  describe("les crédits d'inscription", () => {
    it("octroie les crédits offerts, lus en base", async () => {
      const r = await creer();
      expect(r.plafondAtteint).toBe(false);
      if (r.plafondAtteint) return;
      expect(r.creditsOfferts).toBe(5);
      expect(await solde(r.user.id)).toBe(5);
    });

    // Le montant vient de system_parameter, jamais du code : le jour où
    // l'administration le change, l'octroi doit suivre sans livraison.
    it("suit le paramètre plutôt qu'une valeur écrite en dur", async () => {
      await db.prisma.systemParameter.upsert({
        where: { key: "signup_free_credits" },
        update: { value: "12" },
        create: { key: "signup_free_credits", value: "12", valueType: "number" },
      });
      const r = await creer();
      if (r.plafondAtteint) throw new Error("plafond inattendu");
      expect(await solde(r.user.id)).toBe(12);
    });
  });

  describe("l'acceptation des conditions", () => {
    // Aucune case à cocher : les CGU disent elles-mêmes que créer un compte
    // vaut acceptation. Mais la trace, elle, doit exister — et porter la
    // VERSION, sans quoi on ne saura pas de quel texte on parle le jour où
    // elles changent.
    it("se trace avec la version du document servi", async () => {
      const r = await creer();
      if (r.plafondAtteint) throw new Error("plafond inattendu");
      const u = await db.prisma.user.findUniqueOrThrow({ where: { id: r.user.id } });
      const version = await new LegalService().version("cgu", "fr");
      expect(u.acceptedTermsVersion).toBe(version);
      expect(u.acceptedTermsAt).toBeInstanceOf(Date);
    });
  });

  describe("le plafond par appareil", () => {
    // La faille corrigée : la voie fédérée créait des comptes sans jamais lire
    // le seuil. Ce cas éprouve LE chemin unique — donc les deux voies à la
    // fois, puisqu'elles n'en ont plus qu'un.
    it("refuse au-delà du seuil, sur le chemin unique", async () => {
      const appareil = randomBytes(8).toString("hex");
      for (let i = 0; i < 3; i++) {
        const r = await creer({ deviceId: appareil });
        expect(r.plafondAtteint, `la création ${i + 1} aurait dû passer`).toBe(false);
      }
      expect((await creer({ deviceId: appareil })).plafondAtteint).toBe(true);
    });

    // Un refus ne doit rien laisser derrière : ni compte, ni crédit, ni ligne
    // d'appareil. Sinon le quatrième essai consommerait une place du plafond
    // tout en échouant.
    it("un refus n'écrit rien", async () => {
      const appareil = randomBytes(8).toString("hex");
      for (let i = 0; i < 3; i++) await creer({ deviceId: appareil });

      const comptesAvant = await db.prisma.user.count();
      const mouvementsAvant = await db.prisma.creditTransaction.count();

      await creer({ deviceId: appareil });

      expect(await db.prisma.user.count()).toBe(comptesAvant);
      expect(await db.prisma.creditTransaction.count()).toBe(mouvementsAvant);
      expect(await db.prisma.deviceSignup.count({ where: { deviceId: appareil } })).toBe(3);
    });
  });

  describe("le parrainage", () => {
    const parrain = async (): Promise<{ id: string; code: string }> => {
      const r = await creer();
      if (r.plafondAtteint) throw new Error("plafond inattendu");
      const u = await db.prisma.user.findUniqueOrThrow({ where: { id: r.user.id } });
      return { id: u.id, code: u.referralCode };
    };

    it("crédite les DEUX parties, et le dit", async () => {
      const p = await parrain();
      const soldeParrainAvant = await solde(p.id);

      const r = await creer({ referralCode: p.code });
      if (r.plafondAtteint) throw new Error("plafond inattendu");

      expect(r.parrainage.etat).toBe("credite");
      // Le filleul : ses crédits d'inscription PLUS son bonus d'invitation.
      expect(await solde(r.user.id)).toBe(5 + 5);
      // Le parrain : son solde augmente de son propre bonus.
      expect(await solde(p.id)).toBe(soldeParrainAvant + 5);
    });

    // L'écran de bienvenue annonce le bonus et par qui l'invitation est venue
    // (maquette §3.1, étape 5) : le serveur doit donc le rendre.
    it("nomme le parrain, pour l'écran de bienvenue", async () => {
      const p = await parrain();
      const nom = (await db.prisma.user.findUniqueOrThrow({ where: { id: p.id } })).username;

      const r = await creer({ referralCode: p.code });
      if (r.plafondAtteint) throw new Error("plafond inattendu");
      expect(r.parrainage).toMatchObject({ etat: "credite", parrain: nom, bonusFilleul: 5 });
    });

    it("trace le parrainage à l'état crédité", async () => {
      const p = await parrain();
      const r = await creer({ referralCode: p.code });
      if (r.plafondAtteint) throw new Error("plafond inattendu");

      const trace = await db.prisma.referral.findFirstOrThrow({ where: { referrerId: p.id } });
      expect(trace.invitedUserId).toBe(r.user.id);
      expect(trace.codeUsed).toBe(p.code);
      expect(trace.status).toBe("credited");
    });

    // Les mouvements de parrainage pointent vers leur trace : sans ce lien,
    // un solde ne s'expliquerait pas, et un litige sur un bonus se réglerait
    // à l'estime.
    it("rattache chaque bonus à son parrainage", async () => {
      const p = await parrain();
      const r = await creer({ referralCode: p.code });
      if (r.plafondAtteint) throw new Error("plafond inattendu");

      const trace = await db.prisma.referral.findFirstOrThrow({ where: { referrerId: p.id } });
      const liés = await db.prisma.creditTransaction.findMany({ where: { referralId: trace.id } });
      expect(liés).toHaveLength(2);
      expect(liés.map((m) => m.userId).sort()).toEqual([p.id, r.user.id].sort());
    });

    describe("les cas qui ne doivent PAS casser l'inscription", () => {
      // Maquette §3.1 : « code de parrainage inconnu ou expiré — l'écran le
      // signale et laisse poursuivre, le champ étant facultatif ». Refuser un
      // compte pour un champ facultatif perdrait un utilisateur pour rien.
      it("un code inconnu laisse le compte se créer", async () => {
        const r = await creer({ referralCode: "INEXISTANT" });
        expect(r.plafondAtteint).toBe(false);
        if (r.plafondAtteint) return;
        expect(r.parrainage.etat).toBe("inconnu");
        // Les crédits d'inscription, eux, sont bien là.
        expect(await solde(r.user.id)).toBe(5);
        expect(await db.prisma.referral.count()).toBe(0);
      });

      it("aucun code : aucun parrainage, et le compte existe", async () => {
        const r = await creer();
        if (r.plafondAtteint) throw new Error("plafond inattendu");
        expect(r.parrainage.etat).toBe("aucun");
        expect(await db.prisma.referral.count()).toBe(0);
      });
    });

    // LA règle qui porte sur de l'argent. L'unicité vit dans le schéma, mais
    // ce cas éprouve ce que l'application en fait : une seconde inscription
    // avec le même code crée un SECOND parrainage — filleul différent, donc
    // légitime — sans jamais recréditer le premier filleul.
    it("un même code sert plusieurs fois, sans jamais recréditer le même filleul", async () => {
      const p = await parrain();
      const a = await creer({ referralCode: p.code });
      const b = await creer({ referralCode: p.code });
      if (a.plafondAtteint || b.plafondAtteint) throw new Error("plafond inattendu");

      expect(await db.prisma.referral.count({ where: { referrerId: p.id } })).toBe(2);
      expect(await solde(a.user.id)).toBe(10);
      expect(await solde(b.user.id)).toBe(10);

      // Chaque filleul n'a qu'un seul mouvement de parrainage — pas deux.
      const parrainagesDeA = await db.prisma.creditTransaction.count({
        where: { userId: a.user.id, referralId: { not: null } },
      });
      expect(parrainagesDeA).toBe(1);
    });
  });
});
