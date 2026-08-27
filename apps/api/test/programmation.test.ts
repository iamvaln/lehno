import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { ProgrammationService } from "../src/me/programmation.service.js";

/* La mise en file des rappels.
 *
 * Programmer et envoyer sont deux gestes distincts : la programmation se
 * relance sans risque, l'envoi ne se rejoue pas. Ces cas n'éprouvent que la
 * première — ce qui entre dans la file, et ce qui n'y entre pas. */
describe("la programmation des rappels", () => {
  let db: TestDb;
  let prog: ProgrammationService;
  let awa: string;
  let personne: string;

  const jour = (dans: number): string =>
    new Date(Date.now() + dans * 86_400_000).toISOString().slice(0, 10);
  const dateDe = (d: string): Date => new Date(`${d}T00:00:00Z`);

  // Une échéance nue, sans passer par EventService : ces cas éprouvent la
  // programmation, pas la création.
  const echeance = async (dans: number, leadTimeDays?: number): Promise<string> => {
    const e = await db.prisma.event.create({
      data: {
        personId: personne, authorUserId: awa, kind: "other", label: "Jalon",
        referenceDate: dateDe(jour(dans)),
        ...(leadTimeDays !== undefined
          ? { schedules: { create: [{ type: "recurrent", unit: "year", interval: 1, leadTimeDays }] } }
          : {}),
      },
      select: { id: true },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: {
        eventId: e.id, userId: awa,
        occurrenceDate: dateDe(jour(dans)), occurrenceYear: Number(jour(dans).slice(0, 4)),
      },
      select: { id: true },
    });
    return o.id;
  };

  const filesDe = async (type?: string): Promise<{ channel: string; scheduledFor: Date | null; dedupeKey: string | null }[]> =>
    db.prisma.notification.findMany({
      where: type ? { type: type as never } : {},
      orderBy: { dedupeKey: "asc" },
      select: { channel: true, scheduledFor: true, dedupeKey: true },
    });

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    prog = new ProgrammationService(db.prisma as never);
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    awa = u.id;
    const p = await db.prisma.person.create({
      data: { userId: awa, displayName: "Valery" }, select: { id: true },
    });
    personne = p.id;
  });

  it("programme un rappel au délai réglé, et un le jour même", async () => {
    await echeance(10, 3);
    await prog.programmerRappels();

    const rappels = await filesDe("event_reminder");
    const jourJ = await filesDe("event_day_of");
    expect(rappels.length).toBeGreaterThan(0);
    expect(jourJ.length).toBeGreaterThan(0);
    // Le rappel tombe trois jours avant, le jour J le jour même.
    expect(rappels[0]!.scheduledFor!.toISOString().slice(0, 10)).toBe(jour(7));
    expect(jourJ[0]!.scheduledFor!.toISOString().slice(0, 10)).toBe(jour(10));
  });

  /* Une règle sans délai ne vaut pas « zéro » : elle vaut « comme tout le
     monde ». Sinon composer une répétition ferait taire le rappel — l'inverse
     de ce que l'utilisateur demandait en la composant. */
  it("retombe sur le délai global quand la règle n'en porte pas", async () => {
    await echeance(10);
    await prog.programmerRappels();
    const r = await filesDe("event_reminder");
    // Sept jours par défaut : dix moins sept.
    expect(r[0]!.scheduledFor!.toISOString().slice(0, 10)).toBe(jour(3));
  });

  /* §3.13 : les signalements « se retrouvent TOUJOURS dans ce centre ». Le
     canal in_app ne dépend d'aucune préférence — ce sont le téléphone et le
     courrier qui se règlent. */
  it("pose toujours le canal du centre, quelles que soient les préférences", async () => {
    await db.prisma.notificationPreference.create({
      data: { userId: awa, type: "event_reminder", pushEnabled: false, emailEnabled: false },
    });
    await echeance(10, 3);
    await prog.programmerRappels();

    const canaux = (await filesDe("event_reminder")).map((n) => n.channel);
    expect(canaux).toEqual(["in_app"]);
  });

  it("ajoute le courrier quand rien n'est réglé — le défaut est activé", async () => {
    await echeance(10, 3);
    await prog.programmerRappels();
    const canaux = (await filesDe("event_reminder")).map((n) => n.channel).sort();
    expect(canaux).toContain("in_app");
    expect(canaux).toContain("email");
  });

  /* Poser une ligne `push` pour quelqu'un sans appareil créerait une
     notification qui ne partira jamais et restera « en attente » pour toujours
     — une file qui ment sur ce qu'elle contient. */
  it("n'ouvre pas le canal du téléphone sans appareil pour le recevoir", async () => {
    await echeance(10, 3);
    await prog.programmerRappels();
    expect((await filesDe("event_reminder")).map((n) => n.channel)).not.toContain("push");
  });

  it("ouvre le canal du téléphone dès qu'un appareil existe", async () => {
    await db.prisma.device.create({
      data: { userId: awa, pushToken: "jeton-de-test", platform: "android" },
    });
    await echeance(10, 3);
    await prog.programmerRappels();
    expect((await filesDe("event_reminder")).map((n) => n.channel)).toContain("push");
  });

  /* LA propriété : un ordonnanceur tourne tous les jours. Sans elle, chaque
     passage rajouterait une copie de chaque rappel. */
  it("est idempotente : deux passages ne doublent rien", async () => {
    await echeance(10, 3);
    await prog.programmerRappels();
    const un = await filesDe();
    await prog.programmerRappels();
    expect(await filesDe()).toHaveLength(un.length);
  });

  // Deux délais sur un même événement sont deux faits distincts — J-7 et J-1
  // ne sont pas un doublon.
  it("distingue deux délais d'anticipation du même événement", async () => {
    const e = await db.prisma.event.create({
      data: {
        personId: personne, authorUserId: awa, kind: "other", label: "Jalon",
        referenceDate: dateDe(jour(10)),
        schedules: {
          create: [
            { type: "recurrent", unit: "year", interval: 1, leadTimeDays: 7 },
            { type: "recurrent", unit: "year", interval: 1, leadTimeDays: 1 },
          ],
        },
      },
      select: { id: true },
    });
    await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId: awa, occurrenceDate: dateDe(jour(10)), occurrenceYear: 2026 },
    });
    await prog.programmerRappels();

    const quand = (await filesDe("event_reminder"))
      .filter((n) => n.channel === "in_app")
      .map((n) => n.scheduledFor!.toISOString().slice(0, 10))
      .sort();
    expect(quand).toEqual([jour(3), jour(9)]);
  });

  /* On ne rattrape pas un rappel manqué. Programmer dans le passé le ferait
     partir immédiatement à l'envoi suivant — un « J-7 » reçu le jour même. */
  it("ne programme rien dans le passé", async () => {
    await echeance(2, 7);
    await prog.programmerRappels();
    const r = await filesDe("event_reminder");
    expect(r).toHaveLength(0);
    // Le jour même, lui, reste programmé : il n'est pas en retard.
    expect((await filesDe("event_day_of")).length).toBeGreaterThan(0);
  });

  // Le contrat commun : jamais une phrase composée, toujours une clé et des
  // paramètres. La langue d'interface peut changer après l'envoi.
  it("transporte une clé et des paramètres, jamais une phrase", async () => {
    await echeance(10, 3);
    await prog.programmerRappels();
    const n = await db.prisma.notification.findFirst({
      where: { type: "event_reminder" },
      select: { titleKey: true, bodyParams: true },
    });
    expect(n!.titleKey).toBe("notification.event_reminder");
    expect(n!.bodyParams).toMatchObject({ days: 3 });
    /* Le nom voyage AVEC la notification. Sans lui, la ligne dirait « une date
       approche » sans dire de qui — et on la lit souvent hors connexion, donc
       la résoudre côté client depuis personId ne suffirait pas. */
    expect(n!.bodyParams).toMatchObject({ person: "Valery" });
    // La nature suit : un « bonne fête » sur un anniversaire de décès est
    // impardonnable, et le client ne doit pas avoir à aller la chercher.
    expect(n!.bodyParams).toMatchObject({ nature: "happy" });
  });
});
