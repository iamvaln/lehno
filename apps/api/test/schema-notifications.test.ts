import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

describe("schéma — notifications", () => {
  let db: TestDb;
  let userId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    userId = u.id;
  });

  it("la clé d'anti-doublon empêche le même envoi deux fois", async () => {
    const row = {
      userId, type: "event_reminder" as const, channel: "push" as const,
      titleKey: "reminder.title", dedupeKey: "event_reminder:occ-1:7",
    };
    await db.prisma.notification.create({ data: row });
    await expect(db.prisma.notification.create({ data: row })).rejects.toThrow();
  });

  it("une préférence est unique par compte et par nature", async () => {
    const row = { userId, type: "digest" as const };
    await db.prisma.notificationPreference.create({ data: row });
    await expect(db.prisma.notificationPreference.create({ data: row })).rejects.toThrow();
  });

  it("les deux canaux sont actifs par défaut, et coupables tous les deux", async () => {
    const p = await db.prisma.notificationPreference.create({ data: { userId, type: "digest" } });
    expect(p.pushEnabled).toBe(true);
    expect(p.emailEnabled).toBe(true);
    const off = await db.prisma.notificationPreference.update({
      where: { id: p.id }, data: { pushEnabled: false, emailEnabled: false },
    });
    expect(off.pushEnabled).toBe(false);
  });

  it("réenregistrer le même jeton d'appareil ne crée pas de doublon", async () => {
    const row = { userId, pushToken: "tok-1", platform: "ios" as const };
    await db.prisma.device.create({ data: row });
    await expect(db.prisma.device.create({ data: row })).rejects.toThrow();
  });

  it("les paramètres du socle sont semés", async () => {
    const keys = await db.prisma.systemParameter.findMany({ select: { key: true } });
    expect(keys.map((k) => k.key)).toEqual(
      expect.arrayContaining([
        "reminder_lead_days_default", "wish_window_lead_days",
        "wish_window_trail_days", "max_accounts_per_device", "account_grace_period_days",
      ]),
    );
  });

  it("la suppression d'un compte efface ses notifications, mais laisse survivre son avis sans propriétaire", async () => {
    await db.prisma.notification.create({
      data: {
        userId, type: "event_reminder", channel: "push",
        titleKey: "reminder.title", dedupeKey: "event_reminder:occ-2:7",
      },
    });
    const feedback = await db.prisma.feedback.create({
      data: { userId, rating: 5, body: "Très utile" },
    });

    await db.prisma.user.delete({ where: { id: userId } });

    const notifications = await db.prisma.notification.findMany({ where: { userId } });
    expect(notifications).toHaveLength(0);

    const survivor = await db.prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } });
    expect(survivor.userId).toBeNull();
  });
});
