import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { ENTETES_CLIENT } from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { dansLeContexte, lireEntetes, contexteCourant } from "../src/tracking/contexte.js";
import { origine } from "../src/clients/origine.js";

/**
 * D'OÙ VIENT CHAQUE LIGNE QU'ON RELIRA.
 *
 * Six tables portent l'origine, et vingt endroits l'écrivent. Le risque de ce
 * lot n'est pas qu'un en-tête soit mal lu — c'est qu'UN CHEMIN D'ÉCRITURE SOIT
 * OUBLIÉ. L'oubli serait silencieux : la ligne s'écrirait, la colonne resterait
 * nulle, et on croirait que personne n'appelait depuis cette version.
 *
 * Ces cas gardent les deux moitiés : ce que le contexte comprend des en-têtes,
 * et le fait que `origine()` en sorte vraiment ce que la base doit recevoir.
 */
describe("l'origine d'une ligne", () => {
  let db: TestDb;

  const entetes = (valeurs: Record<string, string>): Record<string, unknown> => valeurs;

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await resetDatabase(db.prisma); });

  describe("ce que le contexte comprend", () => {
    it("lit les six en-têtes d'un appel complet", () => {
      const c = lireEntetes(entetes({
        [ENTETES_CLIENT.clientId]: "mobile_ios_prod_a3f9",
        [ENTETES_CLIENT.clientType]: "mobile_ios",
        [ENTETES_CLIENT.appVersion]: "1.4.2",
        [ENTETES_CLIENT.os]: "ios:17.4",
        [ENTETES_CLIENT.env]: "prod",
      }), null);

      expect(c).toMatchObject({
        clientId: "mobile_ios_prod_a3f9",
        clientType: "mobile_ios",
        appVersion: "1.4.2",
        osName: "ios",
        osVersion: "17.4",
        env: "prod",
      });
    });

    /* LE DÉCOUPAGE SE FAIT UNE FOIS, AU BORD. Laisser `ios:17.4` traverser
       obligerait chaque lecture à le découper — et celle qui oublierait
       compterait `ios:17.4` et `ios:17.5` comme deux systèmes différents.

       Ce cas a mordu : le nettoyage des en-têtes mangeait le deux-points, donc
       le séparateur n'existait déjà plus quand le découpage cherchait. */
    it("sépare le système de sa version, deux-points compris", () => {
      expect(lireEntetes(entetes({ [ENTETES_CLIENT.os]: "android:34" }), null))
        .toMatchObject({ osName: "android", osVersion: "34" });
    });

    /* Un client qui envoie « web » dit quelque chose d'utile : on garde le nom
       plutôt que de tout jeter faute de version. */
    it("garde un système sans version", () => {
      expect(lireEntetes(entetes({ [ENTETES_CLIENT.os]: "web" }), null))
        .toMatchObject({ osName: "web", osVersion: null });
    });

    /* UNE VALEUR HORS LISTE VAUT « INCONNU » ET NON LA VALEUR BRUTE. La ranger
       telle quelle mettrait dans la colonne ce que le client a bien voulu y
       écrire, et une colonne de journal n'est pas un champ libre. */
    it("refuse un type et un environnement inventés", () => {
      const c = lireEntetes(entetes({
        [ENTETES_CLIENT.clientType]: "mainframe",
        [ENTETES_CLIENT.env]: "preprod",
      }), null);
      expect(c.clientType).toBeNull();
      expect(c.env).toBeNull();
    });

    /* UN EN-TÊTE EST ÉCRIT PAR LE CLIENT : il peut porter un retour à la ligne
       pour casser une ligne de journal. On le nettoie AVANT qu'il n'aille où que
       ce soit — c'est la règle que `CorrelationMiddleware` pose déjà. */
    it("nettoie un en-tête forgé plutôt que de le recopier", () => {
      const c = lireEntetes(entetes({
        [ENTETES_CLIENT.clientId]: "abc\ndef\r\nGET /admin",
      }), null);
      expect(c.clientId).not.toContain("\n");
      expect(c.clientId).not.toContain(" ");
    });

    /* HORS REQUÊTE, TOUT EST NUL, et c'est un état légitime : un passage
       programmé, un semis, un test unitaire n'ont pas de client. La traçabilité
       ne fait jamais échouer ce qu'elle trace. */
    it("rend des nuls hors requête, sans lever", () => {
      expect(origine()).toEqual({
        clientId: null, clientType: null, appVersion: null, osName: null, osVersion: null,
      });
    });
  });

  describe("ce qui arrive vraiment en base", () => {
    const DANS_UN_APPEL = {
      [ENTETES_CLIENT.clientId]: "mobile_android_prod_7b2c",
      [ENTETES_CLIENT.clientType]: "mobile_android",
      [ENTETES_CLIENT.appVersion]: "2.0.1",
      [ENTETES_CLIENT.os]: "android:34",
    };

    const ATTENDU = {
      clientId: "mobile_android_prod_7b2c",
      clientType: "mobile_android",
      appVersion: "2.0.1",
      osName: "android",
      osVersion: "34",
    };

    /* LE CAS QUI COMPTE. Il ne lit pas `origine()` — il écrit une vraie ligne
       dans une vraie table, et relit les colonnes. Un test qui se contenterait
       de comparer `origine()` à ce qu'il vient d'y mettre ne dirait rien du
       câblage, qui est précisément l'endroit où l'on peut oublier. */
    it("descend jusque dans la ligne écrite", async () => {
      const u = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        select: { id: true },
      });

      await dansLeContexte(lireEntetes(DANS_UN_APPEL, null), async () => {
        await db.prisma.loginActivity.create({
          data: { ...origine(), userId: u.id, ip: "203.0.113.7", result: "success" },
        });
      });

      const ligne = await db.prisma.loginActivity.findFirstOrThrow({ where: { userId: u.id } });
      expect(ligne).toMatchObject(ATTENDU);
    });

    /* L'IP SUR UNE TRANSACTION — écart assumé à la doctrine du dépôt, parce
       qu'une transaction SE CONTESTE et que l'origine de la déclaration ne se
       reconstitue pas après coup. */
    it("range l'IP sur un mouvement de crédit", async () => {
      const u = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        select: { id: true },
      });

      await dansLeContexte(lireEntetes(DANS_UN_APPEL, null), async () => {
        await db.prisma.creditTransaction.create({
          data: {
            ...origine(), userId: u.id, type: "grant", source: "signup_grant",
            amount: 5, ip: "198.51.100.42",
          },
        });
      });

      const ligne = await db.prisma.creditTransaction.findFirstOrThrow({ where: { userId: u.id } });
      expect(ligne).toMatchObject(ATTENDU);
      expect(ligne.ip).toBe("198.51.100.42");
    });

    /* ET LE CONTEXTE NE FUIT PAS D'UNE REQUÊTE À L'AUTRE. Sans cette garde, un
       stockage mal posé attribuerait à la requête suivante le client de la
       précédente — et le journal mentirait sans que rien ne tombe. */
    it("ne survit pas à la requête qui l'a posé", async () => {
      await dansLeContexte(lireEntetes(DANS_UN_APPEL, null), () => {
        expect(contexteCourant().clientId).toBe(ATTENDU.clientId);
      });
      expect(contexteCourant().clientId).toBeNull();
    });
  });

  /* LA CLÉ NE VA PAS DANS LE CONTEXTE, et c'est délibéré : le contexte se
     journalise, et une clé journalisée est une clé publiée. */
  it("ne laisse jamais la clé entrer dans le contexte", () => {
    const c = lireEntetes(entetes({
      [ENTETES_CLIENT.clientId]: "web_prod_11aa",
      [ENTETES_CLIENT.clientKey]: "une-cle-tres-secrete",
    }), null);
    expect(JSON.stringify(c)).not.toContain("une-cle-tres-secrete");
  });
});
