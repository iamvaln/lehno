import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, avecMotif, type TestDb } from "./db.js";

/* L'historisation des configurations réglées en administration.
 *
 * Ce qui est éprouvé ici n'est pas « une ligne est écrite » — c'est que la
 * ligne ne PEUT PAS manquer, ni mentir. Un historique alimenté par
 * l'application se contourne ; celui-ci vient d'un déclencheur, et ces cas
 * l'attaquent par les chemins qui contournent justement l'application. */
describe("l'historisation des configurations", () => {
  let db: TestDb;

  const canal = async (motif = "mise en place", champs: Record<string, unknown> = {}) =>
    avecMotif(db.prisma, motif, (tx) =>
      tx.paymentChannel.create({
        data: {
          kind: "mobile_money", operator: "MTN", country: "CM", label: "MTN Cameroun",
          feePercent: 2, feeFixed: 0, ...champs,
        },
      }));

  const versions = async (canalId: string) =>
    db.prisma.paymentChannelHistory.findMany({
      where: { paymentChannelId: canalId }, orderBy: { validFrom: "asc" },
    });

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await resetDatabase(db.prisma); });

  describe("la période de validité", () => {
    it("ouvre une période à la création", async () => {
      const c = await canal();
      const v = await versions(c.id);
      expect(v).toHaveLength(1);
      expect(v[0]!.validTo).toBeNull();
      expect(v[0]!.reason).toBe("mise en place");
    });

    /* LA propriété : l'ancienne version garde sa valeur. Sans elle, expliquer
       un paiement d'il y a trois mois donnerait le taux d'aujourd'hui — un
       chiffre faux que personne ne peut détecter. */
    it("ferme la précédente et en ouvre une neuve, sans retoucher l'ancienne", async () => {
      const c = await canal();
      await avecMotif(db.prisma, "baisse du taux au 1er septembre", (tx) =>
        tx.paymentChannel.update({ where: { id: c.id }, data: { feePercent: 1.5 } }));

      const v = await versions(c.id);
      expect(v).toHaveLength(2);
      expect(Number(v[0]!.feePercent)).toBe(2);
      expect(v[0]!.validTo).not.toBeNull();
      expect(Number(v[1]!.feePercent)).toBe(1.5);
      expect(v[1]!.validTo).toBeNull();
      expect(v[1]!.reason).toBe("baisse du taux au 1er septembre");
    });

    // La période fermée finit là où la suivante commence : sans quoi il
    // existerait un instant sans configuration en vigueur.
    it("ne laisse aucun trou entre deux versions", async () => {
      const c = await canal();
      await avecMotif(db.prisma, "correction", (tx) =>
        tx.paymentChannel.update({ where: { id: c.id }, data: { label: "MTN CM" } }));
      const v = await versions(c.id);
      expect(v[0]!.validTo!.getTime()).toBeLessThanOrEqual(v[1]!.validFrom.getTime());
    });

    it("ferme la période à l'effacement, sans en ouvrir d'autre", async () => {
      const c = await canal();
      await avecMotif(db.prisma, "opérateur retiré du pays", (tx) =>
        tx.paymentChannel.delete({ where: { id: c.id } }));

      const v = await versions(c.id);
      expect(v).toHaveLength(1);
      expect(v[0]!.validTo).not.toBeNull();
    });

    /* C'est ce qui permet à un paiement de garder son explication quand le
       canal disparaît — et ce qui autorisera à passer la clé étrangère de
       `Restrict` à `SetNull`. */
    it("survit à l'effacement du canal", async () => {
      const c = await canal();
      await avecMotif(db.prisma, "opérateur retiré", (tx) =>
        tx.paymentChannel.delete({ where: { id: c.id } }));
      expect(await versions(c.id)).toHaveLength(1);
    });
  });

  describe("ce que la base refuse", () => {
    /* Le motif est une CONDITION POUR ÉCRIRE. Cette écriture-ci passe à côté
       de l'application entière — c'est exactement le chemin qu'un historique
       applicatif ne verrait pas. */
    it("refuse une écriture sans raison", async () => {
      await expect(db.prisma.$executeRawUnsafe(`
        INSERT INTO payment_channel (kind, operator, country, label)
        VALUES ('mobile_money', 'ORANGE', 'CM', 'Orange Cameroun')
      `)).rejects.toThrow(/aucune raison posée/);
    });

    it("refuse aussi une modification sans raison", async () => {
      const c = await canal();
      await expect(db.prisma.$executeRawUnsafe(
        `UPDATE payment_channel SET fee_percent = 9 WHERE id = '${c.id}'`,
      )).rejects.toThrow(/aucune raison posée/);
    });

    /* Deux administrateurs modifiant le même canal en même temps produiraient
       deux lignes ouvertes — et « quelle configuration était en vigueur »
       deviendrait indéterminé là précisément où on l'interroge. */
    it("refuse une seconde période ouverte pour le même canal", async () => {
      const c = await canal();
      await expect(db.prisma.$executeRawUnsafe(`
        INSERT INTO payment_channel_history
        SELECT gen_random_uuid(), h.payment_channel_id, h.kind, h.operator, h.country, h.label,
               h.fee_percent, h.fee_fixed, h.fee_min, h.fee_max, h.fee_borne_by, h.currency,
               h.is_active, h.position, h.updated_at, now(), NULL, NULL, 'doublon'
        FROM payment_channel_history h WHERE h.payment_channel_id = '${c.id}'
      `)).rejects.toThrow();
    });
  });

  describe("ce que l'historique permet de lire", () => {
    /* La question qui a motivé le chantier, et à laquelle le journal d'audit
       ne répond pas sans rejouer toutes ses entrées. */
    it("répond à « quelle configuration était en vigueur à cette date »", async () => {
      const c = await canal();
      await new Promise((r) => setTimeout(r, 20));
      const bascule = new Date();
      await new Promise((r) => setTimeout(r, 20));
      await avecMotif(db.prisma, "nouveau barème", (tx) =>
        tx.paymentChannel.update({ where: { id: c.id }, data: { feePercent: 7 } }));

      const enVigueur = await db.prisma.paymentChannelHistory.findFirst({
        where: {
          paymentChannelId: c.id,
          validFrom: { lte: bascule },
          OR: [{ validTo: null }, { validTo: { gt: bascule } }],
        },
      });
      expect(Number(enVigueur!.feePercent)).toBe(2);
    });

    // Une colonne oubliée ne se verrait pas : elle serait simplement nulle, et
    // l'historique mentirait par omission.
    it("recopie toutes les colonnes, les nulles comprises", async () => {
      const c = await canal("bornes posées", {
        feeMin: 50, feeMax: null, currency: "XAF", position: 3, feeBorneBy: "payee",
      });
      const [v] = await versions(c.id);
      expect(Number(v!.feeMin)).toBe(50);
      expect(v!.feeMax).toBeNull();
      expect(v!.position).toBe(3);
      expect(v!.feeBorneBy).toBe("payee");
      expect(v!.operator).toBe("MTN");
      expect(v!.isActive).toBe(true);
    });
  });
});
