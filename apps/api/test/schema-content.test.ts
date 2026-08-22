import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

describe("schéma — contenu", () => {
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

  it("un compte n'a qu'une seule fiche de soi", async () => {
    await db.prisma.person.create({ data: { userId, displayName: "Awa", isSelf: true } });
    await expect(
      db.prisma.person.create({ data: { userId, displayName: "Awa bis", isSelf: true } }),
    ).rejects.toThrow();
    // mais autant de fiches ordinaires qu'on veut
    await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    expect(await db.prisma.person.count()).toBe(2);
  });

  it("un schedule récurrent exige unité et intervalle", async () => {
    const p = await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    const e = await db.prisma.event.create({
      data: { personId: p.id, kind: "birthday", referenceDate: new Date("1990-08-24") },
    });
    await expect(
      db.prisma.schedule.create({ data: { eventId: e.id, type: "recurrent" } }),
    ).rejects.toThrow();
    const ok = await db.prisma.schedule.create({
      data: { eventId: e.id, type: "recurrent", unit: "year", interval: 1 },
    });
    expect(ok.interval).toBe(1);
  });

  it("un schedule offset exige unité et quantité", async () => {
    const p = await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    const e = await db.prisma.event.create({
      data: { personId: p.id, referenceDate: new Date("2024-03-14") },
    });
    await expect(
      db.prisma.schedule.create({ data: { eventId: e.id, type: "offset" } }),
    ).rejects.toThrow();
  });

  it("une occurrence est unique pour un événement et une date", async () => {
    const p = await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    const e = await db.prisma.event.create({
      data: { personId: p.id, kind: "birthday", referenceDate: new Date("1990-08-24") },
    });
    const row = { eventId: e.id, userId, occurrenceDate: new Date("2026-08-24"), occurrenceYear: 2026 };
    await db.prisma.eventOccurrence.create({ data: row });
    await expect(db.prisma.eventOccurrence.create({ data: row })).rejects.toThrow();
  });

  it("une note relève de deux catégories, et supprimer la fiche l'emporte", async () => {
    const p = await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    const n = await db.prisma.note.create({ data: { personId: p.id, content: "il traverse une période dure" } });
    const cats = await db.prisma.category.findMany({ where: { code: { in: ["challenges", "encouragements"] } } });
    expect(cats).toHaveLength(2); // semées par la migration
    await db.prisma.noteCategory.createMany({
      data: cats.map((c) => ({ noteId: n.id, categoryId: c.id })),
    });
    expect(await db.prisma.noteCategory.count()).toBe(2);
    await db.prisma.person.delete({ where: { id: p.id } });
    expect(await db.prisma.note.count()).toBe(0);
    expect(await db.prisma.noteCategory.count()).toBe(0);
  });

  it("un souhait porte une photo et des précisions", async () => {
    const p = await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    const e = await db.prisma.event.create({
      data: { personId: p.id, kind: "birthday", referenceDate: new Date("1990-08-24") },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId, occurrenceDate: new Date("2026-08-24"), occurrenceYear: 2026 },
    });
    const w = await db.prisma.wishlistItem.create({
      data: { eventOccurrenceId: o.id, label: "moulin à café manuel", origin: "owner",
              imageUrl: "https://media.example/x.jpg", details: "manuel, pas électrique" },
    });
    expect(w.status).toBe("available");
    expect(w.isPublic).toBe(false);
  });
});
