import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

/**
 * Ce que la base garantit, indépendamment du service qui écrit.
 *
 * Ces contraintes ne sont pas des doublons de vérifications applicatives :
 * elles tiennent là où un service ne peut pas. Deux confirmations concurrentes
 * liraient toutes deux « aucun octroi » avant que l'une n'écrive — seule une
 * contrainte d'unicité empêche le double crédit. Le raisonnement vaut pour
 * chacune de celles qu'on éprouve ici.
 */
describe("schéma — les paiements", () => {
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

  const compteDeCollecte = async () => db.prisma.collectionAccount.create({
    data: { label: "Orange Money principal", operator: "orange_money", number: "690000000" },
  });

  const paiement = async (over: Record<string, unknown> = {}) => {
    const userId = await compte();
    const collecte = await compteDeCollecte();
    return db.prisma.payment.create({
      data: {
        userId, mode: "manual", collectionAccountId: collecte.id,
        amount: 1000, currency: "XAF", credits: 10, ...over,
      },
    });
  };

  // ─── L'octroi ──────────────────────────────────────────────────────────────

  // « Les crédits sont octroyés une seule fois, quelle que soit la voie qui a
  // constaté le succès. » Une vérification en service perdrait la course.
  it("un paiement n'octroie ses crédits qu'une seule fois", async () => {
    const p = await paiement();
    const octroi = { userId: p.userId, type: "purchase" as const, source: "purchase" as const, amount: 10, paymentId: p.id };

    await db.prisma.creditTransaction.create({ data: octroi });

    await expect(db.prisma.creditTransaction.create({ data: octroi })).rejects.toThrow();
  });

  // L'unicité est partielle : la plupart des mouvements — octrois d'inscription,
  // consommations, ajustements — n'ont pas de paiement, et un index total les
  // ferait entrer en collision sur une valeur nulle.
  it("les mouvements sans paiement ne se gênent pas entre eux", async () => {
    const userId = await compte();

    await db.prisma.creditTransaction.create({ data: { userId, type: "grant", source: "signup_grant", amount: 5 } });
    await db.prisma.creditTransaction.create({ data: { userId, type: "grant", source: "referral_bonus", amount: 3 } });

    expect(await db.prisma.creditTransaction.count()).toBe(2);
  });

  // ─── La référence de transaction ───────────────────────────────────────────

  it("deux paiements ne partagent pas une référence", async () => {
    await paiement({ providerRef: "MP260826.1200.A11111" });

    await expect(paiement({ providerRef: "MP260826.1200.A11111" })).rejects.toThrow();
  });

  // Chez le prestataire elle arrive avec la notification ; sur les voies
  // manuelles, c'est l'administrateur qui la consigne à la confirmation. Deux
  // paiements en attente n'en ont donc aucune, et un index total les ferait
  // entrer en collision.
  it("plusieurs paiements en attente coexistent sans référence", async () => {
    await paiement();
    await paiement();

    expect(await db.prisma.payment.count()).toBe(2);
  });

  // ─── L'histoire des états ──────────────────────────────────────────────────

  // Sans cette contrainte, deux changements concurrents laisseraient deux états
  // courants, et la durée de chacun deviendrait indéterminée.
  it("un paiement n'a qu'un seul état ouvert à la fois", async () => {
    const p = await paiement();
    await db.prisma.paymentStatusHistory.create({
      data: { paymentId: p.id, status: "pending", origin: "user" },
    });

    await expect(db.prisma.paymentStatusHistory.create({
      data: { paymentId: p.id, status: "succeeded", origin: "admin", reason: "Réception constatée" },
    })).rejects.toThrow();
  });

  it("un état fermé laisse la place au suivant", async () => {
    const p = await paiement();
    const ouvert = await db.prisma.paymentStatusHistory.create({
      data: { paymentId: p.id, status: "pending", origin: "user" },
    });
    await db.prisma.paymentStatusHistory.update({
      where: { id: ouvert.id }, data: { endedAt: new Date() },
    });

    await db.prisma.paymentStatusHistory.create({
      data: { paymentId: p.id, status: "succeeded", origin: "admin", reason: "Réception constatée" },
    });

    expect(await db.prisma.paymentStatusHistory.count({ where: { paymentId: p.id } })).toBe(2);
  });

  // « Motif obligatoire lorsque origin = admin. » La base refuse l'écriture
  // plutôt qu'un service : c'est ce qui rend le registre lisible le jour d'un
  // litige, quel que soit le chemin qui l'a écrit.
  it("une décision d'administration sans motif est refusée", async () => {
    const p = await paiement();

    await expect(db.prisma.paymentStatusHistory.create({
      data: { paymentId: p.id, status: "succeeded", origin: "admin" },
    })).rejects.toThrow();
  });

  it("un motif d'administration trop court est refusé", async () => {
    const p = await paiement();

    await expect(db.prisma.paymentStatusHistory.create({
      data: { paymentId: p.id, status: "succeeded", origin: "admin", reason: "ok" },
    })).rejects.toThrow();
  });

  // Un utilisateur qui lance son achat n'a rien à justifier.
  it("un changement venu de l'utilisateur n'exige pas de motif", async () => {
    const p = await paiement();

    await db.prisma.paymentStatusHistory.create({
      data: { paymentId: p.id, status: "pending", origin: "user" },
    });

    expect(await db.prisma.paymentStatusHistory.count()).toBe(1);
  });

  it("un état ne peut pas se terminer avant d'avoir commencé", async () => {
    const p = await paiement();
    const debut = new Date();

    await expect(db.prisma.paymentStatusHistory.create({
      data: {
        paymentId: p.id, status: "pending", origin: "system",
        startedAt: debut, endedAt: new Date(debut.getTime() - 1000),
      },
    })).rejects.toThrow();
  });

  // ─── Ce qui rend un paiement explicable ────────────────────────────────────

  // Sans ce compte, on ne saurait pas où aller vérifier la réception — et c'est
  // elle, pas le reçu, qui fait foi.
  it("une voie manuelle sans compte de collecte est refusée", async () => {
    const userId = await compte();

    await expect(db.prisma.payment.create({
      data: { userId, mode: "manual", amount: 1000, currency: "XAF", credits: 10 },
    })).rejects.toThrow();
  });

  it("la voie du prestataire n'en demande pas", async () => {
    const userId = await compte();

    await db.prisma.payment.create({
      data: { userId, mode: "provider", amount: 1000, currency: "XAF", credits: 10 },
    });

    expect(await db.prisma.payment.count()).toBe(1);
  });

  // Le compte qui a reçu l'argent ne s'efface pas : le paiement deviendrait
  // inexplicable. Il se désactive.
  it("un compte de collecte référencé ne se supprime pas", async () => {
    const p = await paiement();

    await expect(db.prisma.collectionAccount.delete({
      where: { id: p.collectionAccountId as string },
    })).rejects.toThrow();
  });

  // Un remboursement est une direction, pas un signe. Les confondre ferait un
  // total faux dès la première somme.
  it("un montant négatif est refusé", async () => {
    const userId = await compte();
    const collecte = await compteDeCollecte();

    await expect(db.prisma.payment.create({
      data: {
        userId, mode: "manual", collectionAccountId: collecte.id,
        amount: -1000, currency: "XAF", credits: 10,
      },
    })).rejects.toThrow();
  });

  // ─── Les réglages ──────────────────────────────────────────────────────────

  // Deux barèmes concurrents rendraient l'aperçu indéterminé, et personne ne
  // saurait lequel a servi.
  it("un opérateur n'a qu'un barème par pays", async () => {
    const canal = { kind: "mobile_money" as const, operator: "mtn_momo", country: "CM", label: "MTN MoMo" };
    await db.prisma.paymentChannel.create({ data: canal });

    await expect(db.prisma.paymentChannel.create({ data: { ...canal, label: "MTN MoMo bis" } })).rejects.toThrow();
  });

  it("le même opérateur a un barème par pays différent", async () => {
    const canal = { kind: "mobile_money" as const, operator: "mtn_momo", label: "MTN MoMo" };
    await db.prisma.paymentChannel.create({ data: { ...canal, country: "CM" } });

    await db.prisma.paymentChannel.create({ data: { ...canal, country: "CI" } });

    expect(await db.prisma.paymentChannel.count()).toBe(2);
  });

  it("un plafond de frais sous son plancher est refusé", async () => {
    await expect(db.prisma.paymentChannel.create({
      data: {
        kind: "mobile_money", operator: "mtn_momo", country: "CM", label: "MTN MoMo",
        feeMin: 100, feeMax: 50,
      },
    })).rejects.toThrow();
  });

  it("un palier sans crédit n'existe pas", async () => {
    await expect(db.prisma.creditBundle.create({
      data: { amount: 500, credits: 0, position: 9 },
    })).rejects.toThrow();
  });

  // Les cinq paliers de départ sont semés par la migration : sans eux, la
  // première ouverture de l'application ne proposerait rien à acheter.
  it("les cinq paliers de départ sont en place", async () => {
    const paliers = await db.prisma.creditBundle.findMany({ orderBy: { position: "asc" } });

    expect(paliers.map((p) => [Number(p.amount), p.credits])).toEqual([
      [500, 5], [1000, 10], [2000, 22], [5000, 57], [10000, 120],
    ]);
  });
});
