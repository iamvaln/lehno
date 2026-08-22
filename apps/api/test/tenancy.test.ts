import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";

describe("cloisonnement", () => {
  let db: TestDb;
  let repo: TenantRepository;
  let awa: string, karim: string, fichesDeKarim: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    repo = new TenantRepository(db.prisma as never);
    const a = await db.prisma.user.create({ data: { email: "a@x.com", username: "awa", referralCode: "A1" } });
    const k = await db.prisma.user.create({ data: { email: "k@x.com", username: "karim", referralCode: "K1" } });
    awa = a.id; karim = k.id;
    const p = await db.prisma.person.create({ data: { userId: karim, displayName: "Maman de Karim" } });
    fichesDeKarim = p.id;
  });

  it("la liste ne rend que ce qui appartient au demandeur", async () => {
    await db.prisma.person.create({ data: { userId: awa, displayName: "Maman d'Awa" } });
    const à_awa = await repo.persons(awa).findMany();
    expect(à_awa).toHaveLength(1);
    expect(à_awa[0]!.displayName).toBe("Maman d'Awa");
  });

  it("lire la fiche d'autrui rend 404, jamais 403", async () => {
    await expect(repo.persons(awa).findOrThrow(fichesDeKarim))
      .rejects.toMatchObject({ code: "not_found" });
  });

  it("une fiche inexistante rend le même 404 — indistinguable", async () => {
    const inventé = "00000000-0000-4000-8000-000000000000";
    const autrui = await repo.persons(awa).findOrThrow(fichesDeKarim).catch((e) => e);
    const absent = await repo.persons(awa).findOrThrow(inventé).catch((e) => e);
    expect(autrui.code).toBe(absent.code);
    expect(autrui.message).toBe(absent.message);
  });

  it("modifier la fiche d'autrui ne touche rien", async () => {
    await expect(repo.persons(awa).updateOrThrow(fichesDeKarim, { displayName: "détourné" }))
      .rejects.toMatchObject({ code: "not_found" });
    const intacte = await db.prisma.person.findUniqueOrThrow({ where: { id: fichesDeKarim } });
    expect(intacte.displayName).toBe("Maman de Karim");
  });

  it("supprimer la fiche d'autrui ne touche rien", async () => {
    await expect(repo.persons(awa).deleteOrThrow(fichesDeKarim))
      .rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.person.count()).toBe(1);
  });

  it("les échéances passent par le même filtre", async () => {
    const e = await db.prisma.event.create({
      data: { personId: fichesDeKarim, referenceDate: new Date("1990-01-01") },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId: karim, occurrenceDate: new Date("2026-01-01"), occurrenceYear: 2026 },
    });
    await expect(repo.occurrences(awa).findOrThrow(o.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(repo.occurrences(karim).findOrThrow(o.id)).resolves.toMatchObject({ id: o.id });
  });
});
