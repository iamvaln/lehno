import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { ConfigService } from "../src/public/config.controller.js";
import { FlagsService } from "../src/flags/flags.service.js";

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
    const flags = new FlagsService(db.prisma as never);
    const cfg = await new ConfigService(db.prisma as never, flags).get();
    expect(cfg.signupFreeCredits).toBe(5);
    expect(cfg.creditUnitPrice).toBe(100);

    await db.prisma.systemParameter.update({
      where: { key: "credit_unit_price" }, data: { value: "150" },
    });
    expect((await new ConfigService(db.prisma as never, flags).get()).creditUnitPrice).toBe(150);
  });

  // La preuve que ce test réclame explicitement (cahier tâche 2c) : un
  // drapeau PRIVÉ allumé en base ne doit jamais apparaître dans la
  // configuration publique — seuls les drapeaux du registre marqués
  // « public: true » (voir packages/contracts/src/flags.ts) y figurent.
  it("un drapeau privé allumé n'apparaît pas dans la configuration publique", async () => {
    await db.prisma.featureFlag.create({ data: { key: "me.persons", enabled: true } });
    const cfg = await new ConfigService(db.prisma as never, new FlagsService(db.prisma as never)).get();
    expect(cfg.flags).not.toHaveProperty("me.persons");
    expect(cfg.flags).toHaveProperty("launch.live");
  });

  // Les cas de la liste d'attente vivent dans waitlist.test.ts : depuis que
  // le point d'entrée limite le débit et confirme par courriel, ils demandent
  // un limiteur et un adaptateur de courriel, et ils couvrent sept
  // propriétés plutôt que deux — dont l'indistinguabilité reprise ici.
});
