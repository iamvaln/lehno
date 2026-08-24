import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { ConfigService } from "../src/public/config.controller.js";

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
    const cfg = await new ConfigService(db.prisma as never).get();
    expect(cfg.signupFreeCredits).toBe(5);
    expect(cfg.creditUnitPrice).toBe(100);

    await db.prisma.systemParameter.update({
      where: { key: "credit_unit_price" }, data: { value: "150" },
    });
    expect((await new ConfigService(db.prisma as never).get()).creditUnitPrice).toBe(150);
  });

  // Les cas de la liste d'attente vivent dans waitlist.test.ts : depuis que
  // le point d'entrée limite le débit et confirme par courriel, ils demandent
  // un limiteur et un adaptateur de courriel, et ils couvrent sept
  // propriétés plutôt que deux — dont l'indistinguabilité reprise ici.
});
