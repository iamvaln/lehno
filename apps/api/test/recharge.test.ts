import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { RechargeService } from "../src/payments/recharge.service.js";

/* La recharge par palier, voie semi-manuelle.
 *
 * Ces cas visent les REFUS plutôt que le nominal. Ce qui coûte cher ici n'est
 * pas de rater une recharge : c'est d'en accepter une qui ne devrait pas
 * l'être — sur un compte retiré, à un prix que le client a choisi, ou avec des
 * frais qu'on relira demain au tarif de demain. */
describe("la recharge", () => {
  let db: TestDb;
  let recharge: RechargeService;
  let awa: string;

  const compte = async (): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
      select: { id: true },
    });
    return u.id;
  };

  const palier = (montant = 1_000, credits = 10, actif = true, position = 1) =>
    db.prisma.creditBundle.create({
      data: { amount: montant, credits, position, isActive: actif, currency: "XAF" },
    });

  const canal = (over: Record<string, unknown> = {}) =>
    db.prisma.paymentChannel.create({
      data: {
        kind: "mobile_money", operator: `op-${randomBytes(3).toString("hex")}`,
        country: "CM", label: "Un opérateur",
        feePercent: 2, feeFixed: 0, feeBorneBy: "payer", currency: "XAF",
        isActive: true, ...over,
      },
    });

  const compteDeCollecte = (visible = true, actif = true) =>
    db.prisma.collectionAccount.create({
      data: {
        label: "Compte principal", operator: "MTN", number: "670000000",
        isVisibleInApp: visible, isActive: actif,
      },
    });

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    recharge = new RechargeService(db.prisma as never);
    awa = await compte();
  });

  /* `credit_bundle` est une table de RÉFÉRENCE : cinq paliers sont semés par
     la migration des paiements et volontairement préservés entre les cas — les
     vider laisserait l'application sans rien à proposer à l'achat. Ces cas
     raisonnent donc sur les paliers qu'ils créent, jamais sur le contenu entier
     de la table. */
  describe("ce qu'on propose", () => {
    it("rend les paliers actifs, dans leur ordre", async () => {
      const gros = await palier(5_000, 60, true, 91);
      const petit = await palier(1_000, 10, true, 90);

      const rendus = (await recharge.paliers()).map((p) => p.id);
      expect(rendus.indexOf(petit.id)).toBeLessThan(rendus.indexOf(gros.id));
    });

    it("ne rend pas un palier retiré", async () => {
      const retire = await palier(1_000, 10, false, 90);
      expect((await recharge.paliers()).map((p) => p.id)).not.toContain(retire.id);
    });

    /* Visible ET actif. Les deux ne disent pas la même chose : le premier
       décide de ce que le client voit, le second de ce qui reste employable.
       Un compte peut être actif pour l'administration et absent de
       l'application — c'est ainsi qu'on le retire en douceur. */
    it("ne rend qu'un compte à la fois visible et actif", async () => {
      await compteDeCollecte(true, true);
      await compteDeCollecte(false, true);
      await compteDeCollecte(true, false);
      expect(await recharge.comptesDeCollecte()).toHaveLength(1);
    });
  });

  describe("l'aperçu", () => {
    it("rend les quatre montants, et ils ne disent pas la même chose", async () => {
      const p = await palier(1_000, 10);
      const c = await canal({ feePercent: 2 });

      const a = await recharge.apercu({ bundleId: p.id, channelId: c.id });
      expect(a).toMatchObject({
        amount: 1_000, fee: 20, amountToSend: 1_020, expectedOnAccount: 1_000, credits: 10,
      });
    });

    // Sur la carte, le prestataire prélève sa part sur ce qu'il reverse : le
    // client verse le prix, et il en arrive moins.
    it("inverse le calcul quand c'est le service qui supporte les frais", async () => {
      const p = await palier(1_000, 10);
      const c = await canal({ feeBorneBy: "payee", feePercent: 2 });

      const a = await recharge.apercu({ bundleId: p.id, channelId: c.id });
      expect(a).toMatchObject({ amountToSend: 1_000, expectedOnAccount: 980 });
    });

    /* `resource_inactive`, pas `validation_failed` : la requête est bien
       formée, c'est l'offre qui ne l'est plus. L'écran peut alors dire « ce
       palier n'est plus proposé » plutôt que « la demande est mal formée ». */
    it("refuse un palier retiré, et le dit comme tel", async () => {
      const p = await palier(1_000, 10, false);
      const c = await canal();
      await expect(recharge.apercu({ bundleId: p.id, channelId: c.id }))
        .rejects.toMatchObject({ code: "resource_inactive" });
    });

    it("refuse un canal fermé", async () => {
      const p = await palier();
      const c = await canal({ isActive: false });
      await expect(recharge.apercu({ bundleId: p.id, channelId: c.id }))
        .rejects.toMatchObject({ code: "resource_inactive" });
    });

    /* Le cas n'existe pas aujourd'hui — tout est en XAF — et c'est précisément
       pourquoi il faut le fermer maintenant, tant qu'il ne coûte rien. */
    it("refuse un palier et un canal de devises différentes", async () => {
      const p = await palier();
      const c = await canal({ currency: "EUR" });
      await expect(recharge.apercu({ bundleId: p.id, channelId: c.id }))
        .rejects.toMatchObject({ code: "validation_failed" });
    });
  });

  describe("déclarer un versement", () => {
    const declarer = async (over: Record<string, unknown> = {}) => {
      const p = await palier(1_000, 10);
      const c = await canal({ feePercent: 2 });
      const k = await compteDeCollecte();
      return recharge.declarer(awa, {
        bundleId: p.id, channelId: c.id, collectionAccountId: k.id,
        payerMsisdn: "670111222", ...over,
      });
    };

    it("crée un paiement en attente, en mode semi-manuel", async () => {
      const r = await declarer();
      expect(r).toMatchObject({ status: "pending", mode: "semi_manual", credits: 10 });
    });

    /* LE point de ce lot. Les frais sont ANNONCÉS puis FIGÉS : un barème
       change, ce paiement garde ce qui lui a été dit. Relire le taux du jour
       pour expliquer un paiement d'il y a trois mois donnerait un chiffre faux
       — et c'est en litige qu'on va le lire. */
    it("fige les frais annoncés, qu'un changement de barème ne rattrape pas", async () => {
      const p = await palier(1_000, 10);
      const c = await canal({ feePercent: 2 });
      const k = await compteDeCollecte();

      const r = await recharge.declarer(awa, {
        bundleId: p.id, channelId: c.id, collectionAccountId: k.id, payerMsisdn: "670111222",
      });
      expect(r.fee).toBe(20);

      await db.prisma.paymentChannel.update({ where: { id: c.id }, data: { feePercent: 10 } });

      const relu = await recharge.lire(awa, r.id);
      expect(relu.fee).toBe(20);
      expect(relu.expectedOnAccount).toBe(1_000);
    });

    /* Rien de ce que le client envoie ne compose le paiement : il donne deux
       identifiants, le serveur lit le prix et les crédits EN BASE. Accepter un
       montant du corps de la requête ferait acheter mille crédits pour un franc
       à qui sait modifier une requête. */
    it("compose le montant et les crédits depuis le palier, pas depuis la requête", async () => {
      const r = await declarer();
      const ligne = await db.prisma.payment.findUniqueOrThrow({ where: { id: r.id } });
      expect(Number(ligne.amount)).toBe(1_000);
      expect(ligne.credits).toBe(10);
    });

    /* Le compte se vérifie AU MOMENT de la déclaration, pas quand l'écran s'est
       ouvert. Un client qui laisse son écran ouvert une heure verserait sinon
       sur un compte qu'on vient de retirer — et l'argent partirait vers un
       numéro que plus personne ne surveille. */
    it("refuse un compte de collecte devenu invisible entre-temps", async () => {
      const k = await compteDeCollecte(false, true);
      await expect(declarer({ collectionAccountId: k.id }))
        .rejects.toMatchObject({ code: "resource_inactive" });
    });

    it("refuse un compte de collecte désactivé", async () => {
      const k = await compteDeCollecte(true, false);
      await expect(declarer({ collectionAccountId: k.id }))
        .rejects.toMatchObject({ code: "resource_inactive" });
    });

    it("retient le numéro depuis lequel le client déclare avoir versé", async () => {
      const r = await declarer({ payerMsisdn: "699887766" });
      const ligne = await db.prisma.payment.findUniqueOrThrow({ where: { id: r.id } });
      // Ce qui remplace le reçu : c'est lui qui permet de retrouver la
      // transaction sur le relevé de l'opérateur.
      expect(ligne.payerMsisdn).toBe("699887766");
    });

    // Aucun crédit n'est octroyé à la déclaration : c'est l'administration qui
    // confirme, après avoir constaté la réception sur le compte.
    it("n'octroie aucun crédit à la déclaration", async () => {
      await declarer();
      expect(await db.prisma.creditTransaction.count({ where: { userId: awa } })).toBe(0);
    });
  });

  describe("suivre", () => {
    it("rend l'historique du plus récent au plus ancien", async () => {
      const p = await palier(1_000, 10);
      const c = await canal();
      const k = await compteDeCollecte();
      const un = { bundleId: p.id, channelId: c.id, collectionAccountId: k.id, payerMsisdn: "670111222" };
      const a = await recharge.declarer(awa, un);
      const b = await recharge.declarer(awa, un);

      expect((await recharge.lister(awa)).map((x) => x.id)).toEqual([b.id, a.id]);
    });

    /* Le paiement d'un autre N'EXISTE PAS pour le demandeur : 404, jamais 403 —
       un 403 confirmerait qu'il existe, et l'identifiant se devine. */
    it("ne rend pas le paiement de quelqu'un d'autre", async () => {
      const p = await palier(1_000, 10);
      const c = await canal();
      const k = await compteDeCollecte();
      const r = await recharge.declarer(awa, {
        bundleId: p.id, channelId: c.id, collectionAccountId: k.id, payerMsisdn: "670111222",
      });
      const bila = await compte();

      await expect(recharge.lire(bila, r.id)).rejects.toMatchObject({ code: "not_found" });
    });

    it("rappelle le compte sur lequel l'argent a été versé", async () => {
      const p = await palier(1_000, 10);
      const c = await canal();
      const k = await compteDeCollecte();
      const r = await recharge.declarer(awa, {
        bundleId: p.id, channelId: c.id, collectionAccountId: k.id, payerMsisdn: "670111222",
      });
      expect(r.collectionAccount).toMatchObject({ number: "670000000" });
    });
  });
});
