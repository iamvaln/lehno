import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

/* LA REMISE À ZÉRO FACE À UN VERROU TENU AILLEURS.
 *
 * Le nettoyage entre épreuves suppose être seul sur la base, et il ne l'est
 * pas : plusieurs fichiers démarrent une vraie application Nest, qui ouvre sa
 * propre réserve de connexions vers la même base. Les deux prennent les mêmes
 * verrous dans un ordre différent, et PostgreSQL en tue un — « deadlock
 * detected », 40P01. C'est arrivé une fois sur 1 632 épreuves.
 *
 * On ne peut pas fabriquer une étreinte à volonté : il y faut deux attentes
 * croisées, au bon instant. On éprouve donc le MÊME CHEMIN par son cousin
 * déterministe — un verrou exclusif tenu par une autre connexion, qui fait
 * expirer le `lock_timeout` (55P03). Les deux codes passent par la même reprise ;
 * si celle-ci marche pour l'un, elle marche pour l'autre.
 *
 * Ce que cette épreuve garde vraiment : que l'erreur de PostgreSQL soit LUE là
 * où Prisma la range. Elle vit dans `meta.code` d'un `P2010`, pas à la racine —
 * la chercher au mauvais endroit ferait relancer sur rien, et la reprise
 * n'aurait jamais servi sans que personne s'en aperçoive.
 */

describe("la remise à zéro de la base d'épreuve", () => {
  let db: TestDb;
  let voisin: PrismaClient;

  beforeAll(async () => {
    db = await withDatabase();
    voisin = new PrismaClient({ datasources: { db: { url: db.url } } });
    await voisin.$connect();
  }, 180_000);

  afterAll(async () => { await voisin?.$disconnect(); await db?.close(); });

  it("réessaie quand une autre connexion tient un verrou, puis aboutit", async () => {
    await db.prisma.user.create({
      data: { email: "a@exemple.cm", username: "a", referralCode: "AAA1" },
    });

    /* Le verrou se tient PLUS LONGTEMPS que le `lock_timeout` de deux
       secondes — sans quoi la première tentative se contenterait d'attendre et
       passerait : l'épreuve serait verte sans avoir rien éprouvé. Tenu 2,6 s,
       il fait expirer la première et libère à temps pour la deuxième. */
    const verrou = voisin.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('lock table "public"."user" in access exclusive mode');
      await new Promise((fini) => setTimeout(fini, 2_600));
    }, { timeout: 20_000 });

    // On laisse le verrou se poser avant de lancer le nettoyage.
    await new Promise((fini) => setTimeout(fini, 50));
    const depart = Date.now();
    await resetDatabase(db.prisma);
    const duree = Date.now() - depart;
    await verrou;

    /* LA DURÉE EST LA PREUVE que la reprise a servi : sous les deux secondes du
       `lock_timeout`, c'est que la première tentative est passée — et l'épreuve
       ne dirait alors rien de la reprise. */
    expect(duree, "le nettoyage a bien attendu puis réessayé").toBeGreaterThanOrEqual(2_000);
    expect(await db.prisma.user.count()).toBe(0);
  }, 60_000);

  /* ET LE RESTE REMONTE TEL QUEL. Une reprise qui avalerait tout ferait passer
     une migration oubliée pour une contention passagère. */
  it("ne rattrape pas une erreur qui n'est pas un verrou", async () => {
    await expect(db.prisma.$executeRawUnsafe('truncate table "public"."table_absente"'))
      .rejects.toThrow();
  });
});
