import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { DataExportService } from "../src/me/data-export.service.js";

/* L'export de ses données — politique de confidentialité §8, spec technique
 * §5.7 et §9.11.
 *
 * Ce fichier garde surtout UNE chose : ce qui ne doit pas sortir. Le document
 * produit part chez la personne et échappe ensuite à toute révocation — une
 * fuite ici ne se rattrape pas, contrairement à un écran qu'on corrige au
 * déploiement suivant.
 *
 * D'où la forme des cas : ils sérialisent le document entier et cherchent la
 * valeur interdite DEDANS, plutôt que d'inspecter un champ nommé. Un champ
 * ajouté demain par mégarde — dans une jointure, dans un `...spread` — serait
 * attrapé par cette recherche et par aucune autre.
 */
describe("export de données", () => {
  let db: TestDb;
  let exports: DataExportService;
  let userId: string;
  let autreUserId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    exports = new DataExportService(db.prisma as never);

    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    userId = u.id;
    const autre = await db.prisma.user.create({
      data: { email: "karim-secret@example.com", username: "karim", referralCode: "KAR1" },
    });
    autreUserId = autre.id;
  });

  /** Le document entier, à plat, pour y chercher ce qui n'aurait pas dû sortir. */
  async function documentSerialise(): Promise<string> {
    return JSON.stringify(await exports.assembler(userId));
  }

  describe("la demande", () => {
    it("enregistre une demande en attente", async () => {
      const d = await exports.demander(userId);
      expect(d.status).toBe("pending");
      expect(d.completedAt).toBeNull();
    });

    /* Le piège gardé : un client qui réessaie empilerait dix demandes, donc
       dix fois la lecture intégrale d'un compte, pour un seul fichier utile. */
    it("refuse une seconde demande tant que la première prépare", async () => {
      await exports.demander(userId);
      await expect(exports.demander(userId)).rejects.toMatchObject({ code: "conflict" });
    });

    it("laisse redemander une fois la précédente terminée", async () => {
      const d = await exports.demander(userId);
      await db.prisma.dataExportRequest.update({
        where: { id: d.id }, data: { status: "ready", completedAt: new Date() },
      });
      await expect(exports.demander(userId)).resolves.toBeDefined();
    });

    it("ne voit pas la demande en cours d'un autre compte", async () => {
      await exports.demander(autreUserId);
      await expect(exports.demander(userId)).resolves.toBeDefined();
      expect(await exports.derniere(autreUserId)).not.toBeNull();
    });
  });

  describe("ce que le document contient", () => {
    it("rend le carnet : proches, notes, dates", async () => {
      const p = await db.prisma.person.create({ data: { userId, displayName: "Maman" } });
      await db.prisma.note.create({ data: { personId: p.id, content: "aime le jasmin" } });

      const doc = await exports.assembler(userId);
      expect(doc.persons).toHaveLength(1);
      expect(doc.notes).toHaveLength(1);
      expect(JSON.stringify(doc)).toContain("aime le jasmin");
    });

    /* Les notes parlent de proches qui n'ont rien demandé — et c'est
       précisément pour ça qu'elles appartiennent au carnet de celui qui les a
       écrites. Les lui retirer ne protégerait personne : il les lit tous les
       jours dans l'application. Ce cas garde la décision contre un excès de
       zèle qui rendrait un export mutilé. */
    it("rend les notes du carnet, bien qu'elles parlent de tiers", async () => {
      const p = await db.prisma.person.create({ data: { userId, displayName: "Maman" } });
      await db.prisma.note.create({ data: { personId: p.id, content: "déteste la coriandre" } });
      expect(await documentSerialise()).toContain("déteste la coriandre");
    });

    /* Le piège gardé : servir la source COMPTABLE d'un mouvement de crédits.
       « manual_topup » n'est pas du vocabulaire d'utilisateur, et coupler son
       document à notre plan comptable le ferait vieillir avec lui. */
    it("dit les crédits dans le vocabulaire de la personne, pas le nôtre", async () => {
      await db.prisma.creditTransaction.create({
        data: { userId, type: "purchase", source: "manual_topup", amount: 40 },
      });
      const serialise = await documentSerialise();
      expect(serialise).toContain("purchase");
      expect(serialise).not.toContain("manual_topup");
    });
  });

  describe("ce qui ne sort jamais", () => {
    /* LE piège du chantier, et la règle a déjà un précédent dans le dépôt :
       « un parrain n'a pas à connaître la boîte de ses filleuls sous prétexte
       qu'il les a invités » (contrat de parrainage). L'export ne peut pas être
       la porte de service par laquelle cette règle se contourne — c'est même
       le seul endroit du produit où elle serait invisible. */
    it("ne laisse pas fuir l'adresse e-mail d'un filleul", async () => {
      await db.prisma.referral.create({
        data: { referrerId: userId, invitedUserId: autreUserId, codeUsed: "AWA1", status: "credited" },
      });

      const serialise = await documentSerialise();
      // Le pseudo, oui — c'est ce que l'écran de parrainage affiche déjà.
      expect(serialise).toContain("karim");
      // La boîte, jamais.
      expect(serialise).not.toContain("karim-secret@example.com");
    });

    /* Le piège gardé : l'identité de qui a CONTRIBUÉ. Une note d'origine
       `collected` a été déposée par un proche répondant à une invitation ; il
       ne s'est pas inscrit sur une liste que quelqu'un emporte. Son contenu
       sort (le propriétaire le lit déjà), son rattachement à un compte non. */
    it("ne laisse pas fuir l'identité de qui a contribué une note", async () => {
      const p = await db.prisma.person.create({ data: { userId, displayName: "Maman" } });
      await db.prisma.note.create({
        data: { personId: p.id, content: "il adore le ndolé", origin: "collected", authorUserId: autreUserId },
      });

      const serialise = await documentSerialise();
      expect(serialise).toContain("il adore le ndolé");
      expect(serialise).toContain("collected");
      expect(serialise).not.toContain(autreUserId);
    });

    it("ne laisse pas fuir l'identité de qui a contribué un souhait", async () => {
      const p = await db.prisma.person.create({ data: { userId, displayName: "Maman" } });
      const e = await db.prisma.event.create({
        data: { personId: p.id, kind: "birthday", referenceDate: new Date("2026-12-01") },
      });
      const o = await db.prisma.eventOccurrence.create({
        data: { eventId: e.id, userId, occurrenceDate: new Date("2026-12-01") },
      });
      await db.prisma.wishlistItem.create({
        data: { eventOccurrenceId: o.id, label: "une écharpe", origin: "collected", authorUserId: autreUserId },
      });

      const serialise = await documentSerialise();
      expect(serialise).toContain("une écharpe");
      expect(serialise).not.toContain(autreUserId);
    });

    /* Le piège gardé : le jeton de notification. Ce n'est pas une donnée
       personnelle qu'on porte ailleurs, c'est un moyen d'agir sur le compte —
       qui l'obtient fait sonner le téléphone. */
    it("ne laisse pas fuir un jeton de notification", async () => {
      await db.prisma.device.create({
        data: { userId, pushToken: "JETON-QUI-FAIT-SONNER", platform: "ios" },
      });
      const serialise = await documentSerialise();
      expect(serialise).toContain("ios");
      expect(serialise).not.toContain("JETON-QUI-FAIT-SONNER");
    });

    /* Le piège gardé : le numéro mobile money en clair, et la référence du
       prestataire. La spec technique §9.11 les veut masqués « dans
       l'application comme dans le back-office » ; un fichier qui circule est
       le pire endroit pour les laisser passer. Seuls l'opérateur et les
       derniers chiffres sortent. */
    it("ne laisse fuir ni numéro mobile money ni référence du prestataire", async () => {
      await db.prisma.paymentMethod.create({
        data: {
          userId, kind: "mobile_money", brand: "MTN MoMo", last4: "4321",
          msisdn: "237699887766", providerRef: "REF-PRESTATAIRE-XYZ",
        },
      });

      const serialise = await documentSerialise();
      expect(serialise).toContain("MTN MoMo");
      expect(serialise).toContain("4321");
      expect(serialise).not.toContain("237699887766");
      expect(serialise).not.toContain("REF-PRESTATAIRE-XYZ");
    });

    /* Le piège gardé : les traces de sécurité. §9.11 en fait des données
       d'investigation qui survivent au compte sous forme anonymisée, et §9.3
       refuse déjà de les rendre à l'affichage. Un inventaire des sessions
       vivantes dans un fichier qui circule est par ailleurs une carte du
       compte. */
    it("ne laisse fuir ni adresse IP, ni condensé de jeton de session", async () => {
      await db.prisma.loginActivity.create({
        data: { userId, result: "success", method: "otp", ip: "102.244.18.7" },
      });
      await db.prisma.refreshToken.create({
        data: {
          userId, familyId: "3f2504e0-4f89-11d3-9a0c-0305e82c3303",
          tokenHash: "CONDENSE-DE-JETON-DE-SESSION",
          expiresAt: new Date(Date.now() + 60_000), ip: "102.244.18.7",
        },
      });

      const serialise = await documentSerialise();
      expect(serialise).not.toContain("102.244.18.7");
      expect(serialise).not.toContain("CONDENSE-DE-JETON-DE-SESSION");
    });

    /* Le piège gardé : le condensé d'un code à usage unique. Un code à six
       chiffres ne compte qu'un million de valeurs — le condensé sorti du
       service est un cadeau pour qui veut les énumérer hors ligne. */
    it("ne laisse pas fuir le condensé d'un code à usage unique", async () => {
      await db.prisma.otpCode.create({
        data: {
          userId, targetEmail: "awa@example.com", reason: "login",
          codeHash: "CONDENSE-DU-CODE-A-USAGE-UNIQUE",
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      expect(await documentSerialise()).not.toContain("CONDENSE-DU-CODE-A-USAGE-UNIQUE");
    });

    /* Le piège gardé : le cloisonnement, sur le chemin le moins surveillé du
       produit. Un export qui ramasserait les proches de tout le monde serait
       la fuite la plus grave possible, et la plus silencieuse. */
    it("ne ramasse jamais les données d'un autre compte", async () => {
      const sien = await db.prisma.person.create({
        data: { userId: autreUserId, displayName: "Le proche de Karim" },
      });
      await db.prisma.note.create({
        data: { personId: sien.id, content: "note privée de Karim" },
      });

      const doc = await exports.assembler(userId);
      expect(doc.persons).toHaveLength(0);
      expect(doc.notes).toHaveLength(0);
      expect(JSON.stringify(doc)).not.toContain("note privée de Karim");
    });
  });
});
