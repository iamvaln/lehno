import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { ConfigService } from "../src/public/config.controller.js";

/* Le fournisseur `PUBLIC_WEB_URL` du conteneur, ici à la main : il normalise
   déjà la valeur (barres finales retirées), donc l'épreuve reçoit ce que le
   service recevra en vrai. */
const SITE = "https://lehno.io";

describe("surfaces publiques", () => {
  let db: TestDb;
  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await resetDatabase(db.prisma); });

  it("la configuration publique vient de la base, pas du code", async () => {
    // `system_parameter` est une table de référence : resetDatabase() la
    // préserve, elle porte déjà `signup_free_credits` et `credit_unit_price`
    // depuis la migration qui l'amorce (tâche 8). `skipDuplicates` tolère
    // cet état plutôt que d'échouer sur la contrainte d'unicité — les
    // valeurs semées correspondent de toute façon à celles-ci.
    await db.prisma.systemParameter.createMany({
      data: [
        { key: "signup_free_credits", value: "5", valueType: "number" },
        { key: "credit_unit_price", value: "100", valueType: "money" },
      ],
      skipDuplicates: true,
    });
    const cfg = await new ConfigService(db.prisma as never, SITE).get();
    expect(cfg.signupFreeCredits).toBe(5);
    expect(cfg.creditUnitPrice).toBe(100);

    await db.prisma.systemParameter.update({
      where: { key: "credit_unit_price" }, data: { value: "150" },
    });
    expect((await new ConfigService(db.prisma as never, SITE).get()).creditUnitPrice).toBe(150);
  });

  /* L'ADRESSE DU SITE EST SERVIE, PAS DEVINÉE.
   *
   * Le mobile compose des liens qui sortent de lui — une liste partagée, un
   * mur, une invitation — et n'avait aucune source pour la racine. La déduire
   * de l'URL de l'API marcherait aujourd'hui et casserait le jour où les deux
   * domaines divergent ; sur la sandbox, ils diffèrent DÉJÀ. */
  it("rend l'adresse du site, sans barre finale", async () => {
    const cfg = await new ConfigService(db.prisma as never, SITE).get();
    expect(cfg.siteUrl).toBe("https://lehno.io");
    expect(cfg.siteUrl.endsWith("/")).toBe(false);
  });

  /* ET ELLE SUIT L'ENVIRONNEMENT. Écrite en dur, la sandbox aurait renvoyé ses
     visiteurs vers la production — des liens qui marchent, vers les mauvaises
     données. */
  it("suit l'environnement plutôt qu'une valeur écrite en dur", async () => {
    const cfg = await new ConfigService(db.prisma as never, "https://sandbox.lehno.io").get();
    expect(cfg.siteUrl).toBe("https://sandbox.lehno.io");
  });

  // La configuration publique ne porte PLUS aucun drapeau : la spécification
  // §6.2 veut que les clients reçoivent la liste RÉSOLUE de ce qui est actif,
  // par /public/features, et jamais l'état brut. Ce cas garde la frontière —
  // remettre des drapeaux ici les exposerait sous une forme que le contrat
  // commun interdit.
  it("ne porte aucun drapeau : ils passent par /public/features", async () => {
    await db.prisma.featureFlag.create({ data: { key: "launch.live", enabled: true } });
    const cfg = await new ConfigService(db.prisma as never, SITE).get();
    expect(cfg).not.toHaveProperty("flags");
  });

  // Les cas de la liste d'attente vivent dans waitlist.test.ts : depuis que
  // le point d'entrée limite le débit et confirme par courriel, ils demandent
  // un limiteur et un adaptateur de courriel, et ils couvrent sept
  // propriétés plutôt que deux — dont l'indistinguabilité reprise ici.
});
