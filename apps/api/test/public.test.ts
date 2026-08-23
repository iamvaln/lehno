import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { WaitlistService } from "../src/public/waitlist.service.js";
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

  it("un dépôt sur la liste d'attente enregistre l'adresse", async () => {
    const svc = new WaitlistService(db.prisma as never);
    await svc.join({ email: "awa@example.com", locale: "fr" });
    expect(await db.prisma.waitlistSignup.count()).toBe(1);
  });

  it("deux dépôts de la même adresse n'en font qu'un, et ne le disent pas", async () => {
    const svc = new WaitlistService(db.prisma as never);
    const a = await svc.join({ email: "awa@example.com", locale: "fr" });
    const b = await svc.join({ email: "AWA@EXAMPLE.COM", locale: "en" });
    expect(a).toEqual(b); // réponse identique : la liste ne s'énumère pas
    expect(await db.prisma.waitlistSignup.count()).toBe(1);
  });
});
