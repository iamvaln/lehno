import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, avecMotif, type TestDb } from "./db.js";
import { AuditService, CODE_AUTRE } from "../src/admin/audit.service.js";

/* Le module des motifs.
 *
 * Ce qui est éprouvé ici n'est pas « la table existe » — c'est qu'un code
 * enregistré veut dire quelque chose : qu'il est unique, qu'il survit à la
 * réécriture de son libellé, et qu'il ne s'applique pas à n'importe quel geste. */
describe("le module des motifs", () => {
  let db: TestDb;

  /* Les tests qui MODIFIENT un motif s'en fabriquent un.
     `audit_reason` est une table de référence : `resetDatabase` ne la restaure
     pas, donc retirer un motif semé déciderait du point de départ du test
     suivant. Un ordre d'exécution deviendrait une condition de réussite. */
  const motifAMoi = async (code: string, geste: string) =>
    avecMotif(db.prisma, "fixture de test", (tx) =>
      tx.auditReason.create({
        data: {
          code, labelFr: `Motif ${code}`, labelEn: `Reason ${code}`,
          scopes: { create: [{ geste }] },
        },
      }));

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
      const motif = await motifAMoi("a_corriger", "account_suspend");
      await avecMotif(db.prisma, "faute d'orthographe corrigée", (tx) =>
        tx.auditReason.update({ where: { id: motif.id }, data: { labelFr: "Fraude présumée" } }));

      const versions = await db.prisma.auditReasonHistory.findMany({
        where: { auditReasonId: motif.id }, orderBy: { validFrom: "asc" },
      });
      expect(versions).toHaveLength(2);
      expect(versions[0]!.labelFr).toBe("Motif a_corriger");
      expect(versions[0]!.validTo).not.toBeNull();
      expect(versions[1]!.labelFr).toBe("Fraude présumée");
      // Le CODE, lui, n'a pas bougé — c'est tout l'intérêt.
      expect(versions[0]!.code).toBe(versions[1]!.code);
    });

    /* Le code voyage jusqu'à la ligne de version, à côté de la phrase. Sans
       lui, l'historique d'une configuration serait comptable comme le journal
       ne l'était pas — on retomberait sur des phrases libres à agréger. */
    it("porte le code retenu jusqu'à la version, à côté de la phrase", async () => {
      const motif = await motifAMoi("a_retirer", "account_suspend");
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
      const motif = await motifAMoi("sans_code", "account_suspend");
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

  describe("le code retenu est vérifié, jamais cru sur parole", () => {
    let journal: AuditService;
    let admin: string;

    beforeEach(async () => {
      journal = new AuditService(db.prisma as never);
      const a = await db.prisma.admin.create({
        data: { email: "chef@lehno.app", role: "admin" }, select: { id: true },
      });
      admin = a.id;
    });

    const consigner = (codeMotif?: string, geste?: string) =>
      journal.consigner({
        auteurId: admin, action: "user_status_update", motif: "un motif suffisant",
        ...(geste !== undefined ? { geste } : {}),
        ...(codeMotif !== undefined ? { codeMotif } : {}),
      });

    it("accepte un code proposé pour ce geste, et le garde", async () => {
      await consigner("suspected_fraud", "account_suspend");
      const trace = await db.prisma.auditLog.findFirstOrThrow({});
      expect(trace.reasonCode).toBe("suspected_fraud");
      expect(trace.reason).toBe("un motif suffisant");
    });

    it("refuse un code qui n'existe pas", async () => {
      await expect(consigner("parce_que", "account_suspend")).rejects.toThrow();
      expect(await db.prisma.auditLog.count()).toBe(0);
    });

    /* LE cas qui compte, et le seul qui ne se verrait pas autrement : le code
       existe, il est actif, mais il appartient à un autre geste. Sans ce refus,
       « Compte de test » s'enregistrerait sur une suspension et le comptage
       serait faux sans que rien ne le signale. */
    it("refuse un code emprunté à un autre geste", async () => {
      const ailleurs = await db.prisma.auditReasonScope.findFirstOrThrow({
        where: { geste: "account_erase" }, include: { reason: true },
      });
      await expect(consigner(ailleurs.reason.code, "account_suspend")).rejects.toThrow();
      expect(await db.prisma.auditLog.count()).toBe(0);
    });

    it("refuse un code retiré de la liste", async () => {
      const m = await motifAMoi("retire_pour_le_test", "account_suspend");
      await avecMotif(db.prisma, "retiré", (tx) =>
        tx.auditReason.update({ where: { id: m.id }, data: { isActive: false } }));
      await expect(consigner("retire_pour_le_test", "account_suspend")).rejects.toThrow();
    });

    /* Un contrôle qui s'abstient quand l'appelant est incomplet ne protège que
       les appels déjà corrects. */
    it("refuse un code posé sans geste déclaré", async () => {
      await expect(consigner("suspected_fraud")).rejects.toThrow();
    });

    // Le motif libre n'a pas de portée et n'en aura jamais.
    it("laisse passer le motif libre, sans portée", async () => {
      await consigner(CODE_AUTRE, "account_suspend");
      expect((await db.prisma.auditLog.findFirstOrThrow({})).reasonCode).toBe(CODE_AUTRE);
    });

    /* C'EST CE REFUS QUI REND LE CÂBLAGE OBLIGATOIRE. Sans lui, un geste qu'on
       oublie de brancher continuerait d'écrire une phrase libre, et son
       comptage resterait muet sans que rien ne le signale — le module aurait
       l'air posé et ne servirait qu'aux gestes déjà corrects. */
    it("exige un code quand le geste en propose", async () => {
      await expect(consigner(undefined, "account_suspend")).rejects.toThrow();
      expect(await db.prisma.auditLog.count()).toBe(0);
    });

    // Huit gestes n'ont aucun préréglage : la phrase seule doit suffire.
    it("accepte un geste sans code, quand aucun n'est proposé", async () => {
      await consigner(undefined, "feature_flag_toggle");
      expect(await db.prisma.auditLog.count()).toBe(1);
    });
  });

});
