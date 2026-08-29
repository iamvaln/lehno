import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, avecMotif, type TestDb } from "./db.js";

/* Le module des motifs.
 *
 * Ce qui est éprouvé ici n'est pas « la table existe » — c'est qu'un code
 * enregistré veut dire quelque chose : qu'il est unique, qu'il survit à la
 * réécriture de son libellé, et qu'il ne s'applique pas à n'importe quel geste. */
describe("le module des motifs", () => {
  let db: TestDb;

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await resetDatabase(db.prisma); });

  describe("la semence tirée du kit", () => {
    it("pose les motifs du designer, dans les deux langues", async () => {
      const n = await db.prisma.auditReason.count();
      expect(n).toBeGreaterThan(50);
      const fraude = await db.prisma.auditReason.findUnique({ where: { code: "suspected_fraud" } });
      expect(fraude!.labelFr).toBe("Fraude suspectée");
      expect(fraude!.labelEn).toBe("Suspected fraud");
    });

    /* LA raison d'être de la table. Le même motif sert plusieurs gestes, et il
       ne doit exister qu'UNE fois : deux lignes finiraient par porter deux
       libellés pour un seul code — le défaut exact qu'on répare. */
    it("ne duplique pas un motif partagé entre deux gestes", async () => {
      const partages = await db.prisma.auditReasonScope.groupBy({
        by: ["reasonId"], _count: { _all: true },
        having: { reasonId: { _count: { gt: 1 } } },
      });
      expect(partages.length).toBeGreaterThan(0);

      // Et chacun n'a bien qu'une seule ligne de motif.
      for (const p of partages) {
        const m = await db.prisma.auditReason.findUnique({ where: { id: p.reasonId } });
        expect(m).not.toBeNull();
      }
    });

    /* Le geste, et non l'action journalisée : `user_status_update` couvre la
       suspension ET le rétablissement, et proposer « Compte de test » au moment
       de suspendre quelqu'un serait absurde. */
    it("range les motifs par geste, pas par action du journal", async () => {
      const suspension = await db.prisma.auditReasonScope.findMany({
        where: { geste: "account_suspend" }, include: { reason: true },
      });
      const codes = suspension.map((s) => s.reason.code);
      expect(codes).toContain("suspected_fraud");
      expect(codes).not.toContain("test_account");
    });

    // Huit gestes n'ont qu'une invitation à écrire, pas de liste. Le module doit
    // l'admettre : une liste vide n'est pas une erreur de semence.
    it("admet un geste sans aucun motif préréglé", async () => {
      const n = await db.prisma.auditReasonScope.count({ where: { geste: "feature_flag_toggle" } });
      expect(n).toBe(0);
    });
  });

  describe("ce que la base refuse", () => {
    it("refuse deux motifs sous le même code", async () => {
      await expect(avecMotif(db.prisma, "doublon", (tx) =>
        tx.auditReason.create({
          data: { code: "suspected_fraud", labelFr: "Autre chose", labelEn: "Something else" },
        }))).rejects.toThrow();
    });

    it("refuse de proposer deux fois le même motif au même geste", async () => {
      const m = await db.prisma.auditReason.findUniqueOrThrow({ where: { code: "suspected_fraud" } });
      await expect(avecMotif(db.prisma, "doublon", (tx) =>
        tx.auditReasonScope.create({ data: { reasonId: m.id, geste: "account_suspend" } })))
        .rejects.toThrow();
    });

    // Le module est une configuration d'administration comme une autre.
    it("refuse une écriture sans raison, comme toute configuration", async () => {
      await expect(db.prisma.$executeRawUnsafe(`
        INSERT INTO audit_reason (code, label_fr, label_en)
        VALUES ('sans_raison', 'Sans raison', 'No reason')
      `)).rejects.toThrow(/aucune raison posée/);
    });
  });

  describe("l'historique du motif lui-même", () => {
    /* La question que le code stable ne règle pas à lui seul : quel LIBELLÉ
       portait ce code le jour où quelqu'un l'a retenu. Corriger une faute deux
       ans plus tard ne doit pas réécrire ce qu'on a fait lire à l'époque. */
    it("garde le libellé qu'un code portait avant sa correction", async () => {
      const motif = await db.prisma.auditReason.findUniqueOrThrow({ where: { code: "suspected_fraud" } });
      await avecMotif(db.prisma, "faute d'orthographe corrigée", (tx) =>
        tx.auditReason.update({ where: { id: motif.id }, data: { labelFr: "Fraude présumée" } }));

      const versions = await db.prisma.auditReasonHistory.findMany({
        where: { auditReasonId: motif.id }, orderBy: { validFrom: "asc" },
      });
      expect(versions).toHaveLength(2);
      expect(versions[0]!.labelFr).toBe("Fraude suspectée");
      expect(versions[0]!.validTo).not.toBeNull();
      expect(versions[1]!.labelFr).toBe("Fraude présumée");
      // Le CODE, lui, n'a pas bougé — c'est tout l'intérêt.
      expect(versions[0]!.code).toBe(versions[1]!.code);
    });

    /* Le code voyage jusqu'à la ligne de version, à côté de la phrase. Sans
       lui, l'historique d'une configuration serait comptable comme le journal
       ne l'était pas — on retomberait sur des phrases libres à agréger. */
    it("porte le code retenu jusqu'à la version, à côté de la phrase", async () => {
      const motif = await db.prisma.auditReason.findUniqueOrThrow({ where: { code: "suspected_fraud" } });
      await avecMotif(db.prisma, "retiré de la liste", (tx) =>
        tx.auditReason.update({ where: { id: motif.id }, data: { isActive: false } }),
        "product_decision");

      const derniere = await db.prisma.auditReasonHistory.findFirstOrThrow({
        where: { auditReasonId: motif.id, validTo: null },
      });
      expect(derniere.reason).toBe("retiré de la liste");
      expect(derniere.reasonCode).toBe("product_decision");
    });

    // Un geste sans motif préréglé n'en a pas : la phrase suffit, et le code
    // reste nul plutôt que de valoir une chaîne vide qu'on croirait remplie.
    it("laisse le code nul quand aucun n'a été retenu", async () => {
      const motif = await db.prisma.auditReason.findUniqueOrThrow({ where: { code: "abuse_found" } });
      await avecMotif(db.prisma, "sans code", (tx) =>
        tx.auditReason.update({ where: { id: motif.id }, data: { isActive: false } }));

      const derniere = await db.prisma.auditReasonHistory.findFirstOrThrow({
        where: { auditReasonId: motif.id, validTo: null },
      });
      expect(derniere.reasonCode).toBeNull();
    });

    it("historise aussi les portées", async () => {
      const p = await db.prisma.auditReasonScope.findFirstOrThrow({ where: { geste: "account_suspend" } });
      const n = await db.prisma.auditReasonScopeHistory.count({ where: { auditReasonScopeId: p.id } });
      expect(n).toBe(1);
    });
  });
});
