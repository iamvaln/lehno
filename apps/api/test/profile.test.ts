import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { ProfileService } from "../src/me/profile.service.js";
import { profileSchema } from "@lehno/contracts";

describe("profil", () => {
  let db: TestDb;
  let svc: ProfileService;
  let userId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    svc = new ProfileService(db.prisma as never);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "A1" },
    });
    userId = u.id;
  });

  it("le profil rendu est conforme au contrat", async () => {
    expect(profileSchema.safeParse(await svc.get(userId)).success).toBe(true);
  });

  it("change la langue et le thème", async () => {
    const p = await svc.update(userId, { uiLanguage: "en", theme: "dark" });
    expect(p.uiLanguage).toBe("en");
    expect(p.theme).toBe("dark");
  });

  it("refuse un pseudo déjà pris, sans égard à la casse", async () => {
    await db.prisma.user.create({ data: { email: "k@x.com", username: "karim", referralCode: "K1" } });
    await expect(svc.update(userId, { username: "KARIM" }))
      .rejects.toMatchObject({ code: "username_taken" });
  });

  it("garder son propre pseudo n'est pas un conflit", async () => {
    await expect(svc.update(userId, { username: "awa" })).resolves.toMatchObject({ username: "awa" });
  });

  it("la disponibilité tient compte de la casse et du demandeur", async () => {
    expect(await svc.usernameAvailable("KARIM", userId)).toBe(true);
    expect(await svc.usernameAvailable("awa", userId)).toBe(true);   // le sien
    expect(await svc.usernameAvailable("awa", "autre-id")).toBe(false);
  });
});
