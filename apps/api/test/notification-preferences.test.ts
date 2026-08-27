import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { NotificationPreferencesService } from "../src/me/notification-preferences.service.js";
import { notificationPreferencesSchema } from "@lehno/contracts";

describe("préférences de notification", () => {
  let db: TestDb;
  let svc: NotificationPreferencesService;
  let userId: string;
  let autreId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    svc = new NotificationPreferencesService(db.prisma as never);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "A1" },
    });
    userId = u.id;
    const autre = await db.prisma.user.create({
      data: { email: "karim@example.com", username: "karim", referralCode: "K1" },
    });
    autreId = autre.id;
  });

  it("l'état rendu est conforme au contrat", async () => {
    expect(notificationPreferencesSchema.safeParse(await svc.get(userId)).success).toBe(true);
  });

  // Une ligne absente vaut le défaut (§3.11) : sans écriture préalable, un
  // compte neuf doit déjà voir ses onze types configurables réglés à
  // « poussée et courriel activés ».
  it("rend le défaut activé pour un type sans ligne en base", async () => {
    const lu = await svc.get(userId);
    expect(lu.preferences).toHaveLength(11);
    for (const p of lu.preferences) {
      expect(p.pushEnabled).toBe(true);
      expect(p.emailEnabled).toBe(true);
    }
    expect(lu.digestFrequency).toBe("monthly");
  });

  it("pose une ligne pour un type encore sans préférence, sans toucher aux autres", async () => {
    const lu = await svc.update(userId, {
      preferences: [{ type: "event_reminder", pushEnabled: false, emailEnabled: true }],
    });
    const rappel = lu.preferences.find((p) => p.type === "event_reminder");
    expect(rappel).toMatchObject({ pushEnabled: false, emailEnabled: true });
    const digest = lu.preferences.find((p) => p.type === "digest");
    expect(digest).toMatchObject({ pushEnabled: true, emailEnabled: true });
  });

  it("remplace une ligne déjà posée plutôt que d'en créer une seconde", async () => {
    await svc.update(userId, {
      preferences: [{ type: "digest", pushEnabled: false, emailEnabled: false }],
    });
    const lu = await svc.update(userId, {
      preferences: [{ type: "digest", pushEnabled: true, emailEnabled: false }],
    });
    expect(lu.preferences.find((p) => p.type === "digest")).toMatchObject({
      pushEnabled: true, emailEnabled: false,
    });
    const lignes = await db.prisma.notificationPreference.findMany({ where: { userId, type: "digest" } });
    expect(lignes).toHaveLength(1);
  });

  it("change la fréquence du récapitulatif sans exiger de préférence de canal", async () => {
    const lu = await svc.update(userId, { digestFrequency: "weekly" });
    expect(lu.digestFrequency).toBe("weekly");
  });

  // Cloisonnement : une écriture pour un compte ne doit rien poser ni rendre
  // pour un autre.
  it("ne mélange pas les préférences de deux comptes", async () => {
    await svc.update(userId, {
      preferences: [{ type: "digest", pushEnabled: false, emailEnabled: false }],
    });
    const lu = await svc.get(autreId);
    expect(lu.preferences.find((p) => p.type === "digest")).toMatchObject({
      pushEnabled: true, emailEnabled: true,
    });
  });
});
