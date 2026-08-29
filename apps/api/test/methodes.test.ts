import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { MethodesService } from "../src/payments/methodes.service.js";

/* Les méthodes de paiement enregistrées.
 *
 * Ce qui compte ici n'est pas la liste — c'est `refundEligible`. Les CGU §6
 * promettent le remboursement des crédits achetés sur une méthode enregistrée,
 * sous DEUX conditions. Le serveur rend le verdict ; le client ne le recalcule
 * pas. Se tromper d'un côté rend la promesse intenable, de l'autre ouvre la
 * porte au vol de session qu'elle protège. */
describe("les méthodes de paiement", () => {
  let db: TestDb;
  let service: MethodesService;
  let awa: string;

  const JOUR = 86_400_000;

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

  const methode = async (ageJours = 0, userId = awa): Promise<string> => {
    const m = await db.prisma.paymentMethod.create({
      data: {
        userId, kind: "mobile_money", brand: "MTN MoMo", last4: "4417",
        msisdn: "+237655554417",
        createdAt: new Date(Date.now() - ageJours * JOUR),
      },
      select: { id: true },
    });
    return m.id;
  };

  const paiement = (methodeId: string, statut: "succeeded" | "pending" | "failed", userId = awa) =>
    db.prisma.payment.create({
      data: {
        userId, paymentMethodId: methodeId, mode: "provider",
        amount: 1000, currency: "XAF", credits: 10, status: statut,
      },
    });

  const eligible = async (id: string): Promise<boolean> =>
    (await service.lister(awa)).find((m) => m.id === id)!.refundEligible;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    service = new MethodesService(db.prisma as never);
    awa = await compte();
  });

  describe("l'éligibilité au remboursement", () => {
    /* LES DEUX CONDITIONS DES CGU, et il en faut deux. Une seule laisserait
       passer exactement le cas qu'elles visent : un numéro ajouté à l'instant
       sur un compte volé, ou un ancien numéro que le titulaire n'a jamais
       employé. */
    it("accepte une méthode ancienne ET déjà employée", async () => {
      const m = await methode(20);
      await paiement(m, "succeeded");
      expect(await eligible(m)).toBe(true);
    });

    it("refuse une méthode ancienne mais jamais employée", async () => {
      const m = await methode(20);
      expect(await eligible(m)).toBe(false);
    });

    it("refuse une méthode employée mais trop récente", async () => {
      const m = await methode(3);
      await paiement(m, "succeeded");
      expect(await eligible(m)).toBe(false);
    });

    // Le délai est de deux semaines : treize jours ne suffisent pas, quinze si.
    it("compte le délai à deux semaines exactement", async () => {
      const trop = await methode(13);
      const assez = await methode(15);
      await paiement(trop, "succeeded");
      await paiement(assez, "succeeded");
      expect(await eligible(trop)).toBe(false);
      expect(await eligible(assez)).toBe(true);
    });

    /* « A déjà servi » veut dire RÉUSSI. Un paiement en attente ou rejeté ne
       prouve rien — c'est justement celui qu'un voleur de session laisserait
       derrière lui, et l'accepter viderait la garde de son sens. */
    it("ne compte ni un paiement en attente ni un rejeté", async () => {
      const m = await methode(20);
      await paiement(m, "pending");
      await paiement(m, "failed");
      expect(await eligible(m)).toBe(false);
    });

    // Une méthode neuve n'est jamais éligible : les deux conditions échouent.
    it("n'est jamais éligible à l'enregistrement", async () => {
      const m = await service.enregistrer(awa, { kind: "mobile_money", msisdn: "+237655554417" });
      expect(m.refundEligible).toBe(false);
    });

    // Le paiement d'un AUTRE compte ne rend pas ma méthode éligible.
    it("ne compte pas le paiement de quelqu'un d'autre", async () => {
      const bila = await compte();
      const m = await methode(20);
      await paiement(m, "succeeded", bila);
      expect(await eligible(m)).toBe(false);
    });
  });

  describe("ce qui sort, et ce qui ne sort jamais", () => {
    /* Le numéro entier NE RESSORT JAMAIS. `paymentMethodSchema` est `strict` et
       ne le porte pas : un service qui le laisserait fuir ferait échouer le
       parsage plutôt que de l'envoyer jusqu'à un journal de bord. */
    it("ne rend que les quatre derniers chiffres", async () => {
      const m = await service.enregistrer(awa, { kind: "mobile_money", msisdn: "+237655554417" });
      expect(m.last4).toBe("4417");
      expect(JSON.stringify(m)).not.toMatch(/655554417/);
      expect(m).not.toHaveProperty("msisdn");
      expect(m).not.toHaveProperty("providerRef");
    });

    /* La plus récemment employée EN TÊTE : c'est celle que l'achat propose par
       défaut. Les jamais employées suivent — sans le `nulls last` explicite,
       Postgres les placerait en premier et l'écran ouvrirait sur une méthode
       que personne n'a jamais utilisée. */
    it("range la plus récemment employée en tête", async () => {
      const jamais = await methode(30);
      const employee = await methode(30);
      await db.prisma.paymentMethod.update({
        where: { id: employee }, data: { lastUsedAt: new Date() },
      });
      expect((await service.lister(awa))[0]!.id).toBe(employee);
      expect((await service.lister(awa))[1]!.id).toBe(jamais);
    });

    it("ne rend pas la méthode de quelqu'un d'autre", async () => {
      const bila = await compte();
      await methode(10, bila);
      expect(await service.lister(awa)).toHaveLength(0);
    });
  });

  describe("retirer", () => {
    /* La ligne est SUPPRIMÉE, pas désactivée — contrairement à un compte de
       collecte, qu'un paiement passé référence. Ici `payment_method_id` est en
       SetNull : l'historique garde le paiement et perd seulement le moyen. */
    it("supprime la ligne sans emporter le paiement", async () => {
      const m = await methode(20);
      await paiement(m, "succeeded");
      await service.retirer(awa, m);

      expect(await db.prisma.paymentMethod.count({ where: { userId: awa } })).toBe(0);
      const p = await db.prisma.payment.findFirstOrThrow({ where: { userId: awa } });
      expect(p.paymentMethodId).toBeNull();
    });

    // Celle d'un autre N'EXISTE PAS pour le demandeur : 404, jamais 403 — un
    // 403 confirmerait qu'elle existe, et l'identifiant se devine.
    it("ne retire pas celle de quelqu'un d'autre", async () => {
      const bila = await compte();
      const m = await methode(10, bila);
      await expect(service.retirer(awa, m)).rejects.toMatchObject({ code: "not_found" });
      expect(await db.prisma.paymentMethod.count({ where: { userId: bila } })).toBe(1);
    });
  });

  /* Une liste sans borne est une liste qu'on ne relit plus — et c'est dans une
     liste qu'on ne relit plus qu'un numéro étranger passe inaperçu. */
  it("refuse au-delà du plafond", async () => {
    for (let i = 0; i < 10; i += 1) await methode(1);
    await expect(service.enregistrer(awa, { kind: "mobile_money", msisdn: "+237655554417" }))
      .rejects.toMatchObject({ code: "validation_failed" });
  });
});
