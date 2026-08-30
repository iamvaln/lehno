import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { DeviceService } from "../src/me/device.service.js";

/* Les appareils de notification — spec technique §5.7.
 *
 * Un « appareil » est un JETON D'INSTALLATION, pas un téléphone : réinstaller
 * l'application en produit un nouveau. C'est ce qui explique la forme des cas
 * ci-dessous.
 */
describe("appareils de notification", () => {
  let db: TestDb;
  let devices: DeviceService;
  let userId: string;
  let autreUserId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    devices = new DeviceService(db.prisma as never);

    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    userId = u.id;
    const autre = await db.prisma.user.create({
      data: { email: "karim@example.com", username: "karim", referralCode: "KAR1" },
    });
    autreUserId = autre.id;
  });

  const jeton = (n: number): string => `jeton-de-notification-${n}`;

  describe("enregistrement", () => {
    it("enregistre un jeton et rend l'appareil", async () => {
      const d = await devices.enregistrer(userId, { pushToken: jeton(1), platform: "ios", appVersion: "1.4.2" });
      expect(d.platform).toBe("ios");
      expect(d.appVersion).toBe("1.4.2");
    });

    /* Le piège gardé, et c'est le principal : le jeton est une CAPACITÉ
       D'ENVOI — qui l'obtient fait sonner le téléphone. Il ne doit jamais
       ressortir, ni de l'enregistrement, ni de la liste. Le schéma du contrat
       est `strict`, mais le service ne doit pas compter sur lui pour ça. */
    it("ne rend jamais le jeton de notification", async () => {
      const d = await devices.enregistrer(userId, { pushToken: jeton(1), platform: "ios" });
      expect(d).not.toHaveProperty("pushToken");
      const [liste] = await devices.lister(userId);
      expect(liste).not.toHaveProperty("pushToken");
    });

    /* Le piège gardé : l'application appelle ce chemin à CHAQUE démarrage,
       sans savoir si son jeton a changé. Un `create` ferait échouer un
       démarrage sur deux sur l'unicité, ou remplirait la table d'un doublon
       par ouverture. */
    it("réenregistrer le même jeton ne crée pas de doublon", async () => {
      await devices.enregistrer(userId, { pushToken: jeton(1), platform: "ios", appVersion: "1.4.0" });
      const d = await devices.enregistrer(userId, { pushToken: jeton(1), platform: "ios", appVersion: "1.5.0" });

      expect(await db.prisma.device.count({ where: { userId } })).toBe(1);
      // Et le rafraîchissement a bien pris : c'est le seul moment où le
      // serveur apprend que cette installation est toujours là.
      expect(d.appVersion).toBe("1.5.0");
    });

    /* Le piège gardé : un jeton que le service de notification avait rejeté,
       et que l'application represente. Le laisser inactif le condamnerait à ne
       plus rien recevoir sans que personne ne s'en aperçoive — la panne
       silencieuse qu'on ne diagnostique jamais. */
    it("réactive un jeton qu'on avait désactivé", async () => {
      await devices.enregistrer(userId, { pushToken: jeton(1), platform: "ios" });
      await db.prisma.device.updateMany({ where: { userId }, data: { isActive: false } });

      await devices.enregistrer(userId, { pushToken: jeton(1), platform: "ios" });
      const ligne = await db.prisma.device.findFirstOrThrow({ where: { userId } });
      expect(ligne.isActive).toBe(true);
    });
  });

  describe("le plafond par compte", () => {
    /** Remplit le compte jusqu'au plafond réglé en base. */
    async function remplirJusquAuPlafond(n: number) {
      for (let i = 0; i < n; i++) {
        await devices.enregistrer(userId, { pushToken: jeton(i), platform: "android" });
      }
    }

    it("refuse un appareil de plus une fois le plafond atteint", async () => {
      // Le plafond est réglable en back-office : on le resserre plutôt que
      // d'enregistrer dix appareils pour éprouver la règle.
      await db.prisma.systemParameter.update({
        where: { key: "max_devices_per_account" }, data: { value: "2" },
      });

      await remplirJusquAuPlafond(2);
      await expect(devices.enregistrer(userId, { pushToken: jeton(99), platform: "ios" }))
        .rejects.toMatchObject({ code: "device_limit_reached" });
    });

    /* Le piège gardé : compter un jeton DÉJÀ connu contre le plafond. Le
       démarrage quotidien d'une application se heurterait alors à une limite
       qu'il ne fait pourtant pas bouger — et l'appareil au plafond cesserait
       de rafraîchir sa dernière activité. */
    it("laisse un jeton déjà connu se réenregistrer au plafond", async () => {
      await db.prisma.systemParameter.update({
        where: { key: "max_devices_per_account" }, data: { value: "2" },
      });
      await remplirJusquAuPlafond(2);

      await expect(devices.enregistrer(userId, { pushToken: jeton(0), platform: "android", appVersion: "2.0.0" }))
        .resolves.toBeDefined();
      expect(await db.prisma.device.count({ where: { userId } })).toBe(2);
    });

    /* Le piège gardé : un plafond qui se compterait sur TOUS les comptes. Le
       premier utilisateur bavard fermerait la porte à tout le monde. */
    it("compte par compte, pas globalement", async () => {
      await db.prisma.systemParameter.update({
        where: { key: "max_devices_per_account" }, data: { value: "2" },
      });
      await remplirJusquAuPlafond(2);

      await expect(devices.enregistrer(autreUserId, { pushToken: jeton(50), platform: "ios" }))
        .resolves.toBeDefined();
    });
  });

  describe("retrait", () => {
    it("retire son propre appareil", async () => {
      const d = await devices.enregistrer(userId, { pushToken: jeton(1), platform: "ios" });
      await devices.retirer(userId, d.id);
      expect(await db.prisma.device.count({ where: { userId } })).toBe(0);
    });

    /* Le piège gardé, et il est nommément demandé par la spec technique §9.3 :
       retirer l'appareil d'autrui doit rendre 404, JAMAIS 403. Un 403
       confirmerait que cet identifiant existe, et ferait de ce chemin un
       oracle sur les appareils des autres comptes.

       La forme du code compte autant que le refus : c'est `not_found` qu'on
       vérifie, pas seulement « ça a échoué ». */
    it("rend 404 sur l'appareil d'un autre compte, jamais 403", async () => {
      const sien = await devices.enregistrer(autreUserId, { pushToken: jeton(1), platform: "ios" });

      await expect(devices.retirer(userId, sien.id)).rejects.toMatchObject({ code: "not_found" });
      // Et il est toujours là : le refus n'est pas qu'un message.
      expect(await db.prisma.device.count({ where: { userId: autreUserId } })).toBe(1);
    });

    it("rend la même réponse pour un appareil qui n'existe pas du tout", async () => {
      await expect(devices.retirer(userId, "3f2504e0-4f89-11d3-9a0c-0305e82c3303"))
        .rejects.toMatchObject({ code: "not_found" });
    });
  });

  describe("liste", () => {
    it("ne rend jamais les appareils d'un autre compte", async () => {
      await devices.enregistrer(autreUserId, { pushToken: jeton(1), platform: "ios" });
      expect(await devices.lister(userId)).toHaveLength(0);
    });
  });
});
