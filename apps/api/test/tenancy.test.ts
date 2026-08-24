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

  // Revue tour 1, point 1 : avant la correction, `{ ...this.scope, ...where }`
  // laissait une clé `userId` du `where` de l'appelant supplanter le
  // périmètre (écrite en second, elle gagnait). Avec cette clé précisément
  // choisie pour coïncider avec le nom de la clé de périmètre, l'ancien code
  // aurait rendu la fiche de Karim à une requête scopée sur awa. La
  // combinaison par `AND` rend cette clé sans effet : elle ne peut que
  // restreindre, jamais remplacer.
  it("une clé fournie par l'appelant ne peut pas lever le périmètre", async () => {
    const résultat = await repo.persons(awa).findMany({ userId: karim });
    expect(résultat).toEqual([]);
  });

  // Revue tour 1, point 2 : `where` reste bien filtré par le périmètre, mais
  // rien ne regardait ce qu'on écrivait — `updateOrThrow(id, { userId: autre
  // })` réassignait la ressource à un autre tenant. Ici Karim modifie SA
  // PROPRE fiche (le `where` la trouve donc), mais tente d'en changer le
  // propriétaire : ça doit être refusé quand même, la colonne d'appartenance
  // étant hors de portée par construction. `as never` contourne le typage
  // (qui, lui, refuse déjà `{ userId }` à la compilation — voir
  // `Omit<T, F | "id">` dans Scope.updateOrThrow) pour éprouver la garde
  // d'exécution qui reste en dessous.
  it("réassigner la colonne d'appartenance est refusé, même en contournant le typage", async () => {
    await expect(repo.persons(karim).updateOrThrow(fichesDeKarim, { userId: awa } as never))
      .rejects.toMatchObject({ code: "validation_failed" });
    const intacte = await db.prisma.person.findUniqueOrThrow({ where: { id: fichesDeKarim } });
    expect(intacte.userId).toBe(karim);
  });

  // Revue tour 1, point 5 : events(), notes() et wishes() filtrent par un
  // PARENT (Event et Note via Person, un souhait via son occurrence) plutôt
  // que par une colonne userId directe — précisément là que les erreurs de
  // cloisonnement se cachent. Aucun test ne les exerçait.
  it("les événements passent par le même filtre que les fiches", async () => {
    const e = await db.prisma.event.create({
      data: { personId: fichesDeKarim, referenceDate: new Date("1990-01-01") },
    });
    await expect(repo.events(awa).findOrThrow(e.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(repo.events(karim).findOrThrow(e.id)).resolves.toMatchObject({ id: e.id });
  });

  it("les notes passent par le même filtre que les fiches", async () => {
    const n = await db.prisma.note.create({
      data: { personId: fichesDeKarim, content: "note privée" },
    });
    await expect(repo.notes(awa).findOrThrow(n.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(repo.notes(karim).findOrThrow(n.id)).resolves.toMatchObject({ id: n.id });
  });

  it("les souhaits passent par le même filtre que l'échéance qui les porte", async () => {
    const e = await db.prisma.event.create({
      data: { personId: fichesDeKarim, referenceDate: new Date("1990-01-01") },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId: karim, occurrenceDate: new Date("2026-01-01"), occurrenceYear: 2026 },
    });
    const w = await db.prisma.wishlistItem.create({
      data: { eventOccurrenceId: o.id, label: "un cadeau", origin: "owner" },
    });
    await expect(repo.wishes(awa).findOrThrow(w.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(repo.wishes(karim).findOrThrow(w.id)).resolves.toMatchObject({ id: w.id });
  });

  // `create` n'existait pas : aucune ressource n'avait encore été créée par un
  // service cloisonné. Elle porte le même risque que `updateOrThrow` — laisser
  // l'appelant choisir à qui la ressource appartient — et la même garde.
  it("attache la ressource créée au demandeur, sans qu'il ait à le dire", async () => {
    const cree = await repo.persons(awa).create({ displayName: "Valery" });

    const relu = await db.prisma.person.findUniqueOrThrow({ where: { id: cree.id } });
    expect(relu.userId, "le périmètre pose l'appartenance").toBe(awa);
  });

  // Le danger : un appelant qui glisse userId dans les données créerait une
  // fiche au nom d'un autre compte. Le périmètre doit l'emporter.
  it("ne laisse pas créer une ressource au nom d'un autre", async () => {
    const cree = await repo.persons(awa).create({ displayName: "Valery", userId: karim } as never);

    const relu = await db.prisma.person.findUniqueOrThrow({ where: { id: cree.id } });
    expect(relu.userId, "le userId fourni ne doit jamais gagner").toBe(awa);
  });

  // Une ressource créée dans un périmètre doit s'y retrouver : sans quoi la
  // création et la lecture emploieraient deux notions d'appartenance.
  it("rend la ressource créée dans la liste du demandeur, et pas dans l'autre", async () => {
    await repo.persons(awa).create({ displayName: "Valery" });

    expect(await repo.persons(awa).findMany()).toHaveLength(1);
    expect((await repo.persons(karim).findMany()).map((p) => p.displayName)).toEqual(["Maman de Karim"]);
  });

  // Les portées de `events`, `notes` et `wishes` ne filtrent pas par colonne
  // mais par relation — `{ person: { userId } }`. Étalée dans les données,
  // cette forme deviendrait une écriture imbriquée : Prisma tenterait de créer
  // une personne, ou échouerait obscurément. Pire, elle pourrait réussir en
  // écrivant n'importe quoi.
  //
  // `create` doit donc refuser ces portées, franchement, plutôt que d'écrire
  // quelque chose que personne n'a voulu.
  it("refuse de créer sur une portée qui filtre par relation", async () => {
    await expect(
      repo.notes(awa).create({ content: "essai" } as never),
    ).rejects.toThrow(/portée/i);

    expect(await db.prisma.note.count(), "rien ne doit s'écrire").toBe(0);
  });
});
