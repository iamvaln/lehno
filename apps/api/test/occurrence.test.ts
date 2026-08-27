import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { EventService } from "../src/me/event.service.js";
import { PersonService } from "../src/me/person.service.js";
import { OccurrenceService } from "../src/me/occurrence.service.js";
import { NoteService } from "../src/me/note.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { FlagsService } from "../src/flags/flags.service.js";

describe("les échéances", () => {
  let db: TestDb;
  let events: EventService;
  let persons: PersonService;
  let occurrences: OccurrenceService;
  let notes: NoteService;
  let awa: string;
  let bila: string;

  const compte = async (): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    return u.id;
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    // `events.other` allumé : ces cas éprouvent les événements libres, pas le
    // lancement resserré. Un drapeau naît ÉTEINT — c'est voulu, et c'est
    // précisément l'état d'un déploiement neuf.
    const drapeaux = new FlagsService(db.prisma as never);
    await drapeaux.reconcilier();
    await db.prisma.featureFlag.update({ where: { key: "events.other" }, data: { enabled: true } });
    const depot = new TenantRepository(db.prisma as never);
    events = new EventService(depot, db.prisma as never, new FlagsService(db.prisma as never));
    persons = new PersonService(depot, events, db.prisma as never);
    occurrences = new OccurrenceService(depot, db.prisma as never);
    notes = new NoteService(depot, db.prisma as never);
    awa = await compte();
    bila = await compte();
  });

  it("rend les échéances avec le nom du proche", async () => {
    const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    await events.create(awa, { personId: p.id, kind: "birthday" });

    const [e] = await occurrences.list(awa, {});
    // Le nom voyage AVEC l'échéance : sans lui, chaque carte d'une liste
    // demanderait sa fiche, et l'accueil ferait quatre appels au lieu d'un.
    expect(e?.personDisplayName).toBe("Valery");
    expect(e?.kind).toBe("birthday");
  });

  it("ne rend pas les échéances d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine", birthDate: "1990-03-14" });
    await events.create(bila, { personId: p.id, kind: "birthday" });
    expect(await occurrences.list(awa, {})).toEqual([]);
  });

  // La fiche d'un proche (maquette §3.4) montre SES échéances. Sans ce filtre,
  // le mobile tire tout et trie chez lui — et le plafond couperait AVANT le
  // tri, donc un proche discret disparaîtrait de sa propre fiche.
  it("filtre les échéances sur un proche", async () => {
    const valery = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    const quentin = await persons.create(awa, { displayName: "Quentin", birthDate: "1988-07-02" });
    await events.create(awa, { personId: valery.id, kind: "birthday" });
    await events.create(awa, { personId: quentin.id, kind: "birthday" });

    const siennes = await occurrences.list(awa, { personId: valery.id });
    expect(siennes).toHaveLength(1);
    expect(siennes[0]?.personDisplayName).toBe("Valery");
  });

  // Le filtre ne doit pas devenir un oracle : une liste vide dirait « ce proche
  // existe et n'a rien », alors qu'il est à quelqu'un d'autre.
  it("rend 404 quand le proche filtré n'est pas au demandeur", async () => {
    const celarine = await persons.create(bila, { displayName: "Celarine", birthDate: "1990-03-14" });
    await expect(occurrences.list(awa, { personId: celarine.id })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  /* Des dates À VENIR, et non plus 2020. Ce cas éprouve la fenêtre et le
     plafond, pas la récurrence : il comptait jusqu'ici sur un défaut pour
     avoir des échéances. `ouvrirProchaine` appliquait une récurrence annuelle
     EN DUR à tout événement, donc un jalon de 2020 se voyait attribuer une
     échéance cette année. Depuis qu'il respecte les règles enregistrées, un
     événement libre SANS règle n'a qu'une occurrence — à sa date, et une date
     passée n'en ouvre aucune à venir. C'est le comportement juste : un mariage
     ne se répète pas tous les ans.

     Au passage, la date d'origine n'était pas réaliste : `dateAVenirSchema`
     refuse une date passée à la création. Seul un appel direct au service,
     comme ici, pouvait la produire. */
  it("respecte la fenêtre et le plafond", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    for (const dans of [30, 60, 90]) {
      const jour = new Date(Date.now() + dans * 86_400_000).toISOString().slice(0, 10);
      await events.create(awa, {
        personId: p.id, kind: "other", label: `Jalon ${jour}`, referenceDate: jour,
      });
    }
    const deux = await occurrences.list(awa, { limit: 2 });
    expect(deux).toHaveLength(2);
  });

  // Négatif pour une échéance passée. Ce n'est PAS pour la vue Dates, qui se
  // concentre sur ce qui vient (§3.14) : c'est le détail d'une occasion, qui
  // s'ouvre aussi sur une occasion passée et affiche « passée » (§3.21). Un
  // décompte non signé y rendrait « J−3 » trois jours APRÈS la date.
  it("compte les jours, en signé", async () => {
    // Une naissance quelconque : ce test porte sur le décompte, pas sur l'âge —
    // mais un anniversaire ne s'ouvre qu'à condition que le proche en porte une
    // (tâche 2).
    const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    const e = await events.create(awa, { personId: p.id, kind: "birthday" });
    const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await db.prisma.eventOccurrence.updateMany({
      where: { eventId: e.id }, data: { occurrenceDate: new Date(`${hier}T00:00:00Z`) },
    });

    const [passee] = await occurrences.list(awa, { from: hier });
    expect(passee?.daysUntil).toBe(-1);
  });

  // L'âge se déduit de l'année de naissance — et vaut null quand elle n'est
  // pas connue. Nullable plutôt qu'absent : l'écran est OBLIGÉ de traiter le
  // cas au lieu de l'oublier et d'afficher « NaN ans ».
  it("rend l'âge, et null quand l'année n'est pas connue", async () => {
    const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    await events.create(awa, { personId: p.id, kind: "birthday" });
    const [avec] = await occurrences.list(awa, {});
    expect(avec?.age).toBe(Number(avec?.occurrenceDate.slice(0, 4)) - 1990);

    // L'année de naissance peut être inconnue, mais la naissance elle-même
    // reste requise pour ouvrir un anniversaire (tâche 2) : un jour et un mois
    // portés par une année de convention, signalée non fiable.
    const q = await persons.create(awa, {
      displayName: "Inconnu", birthDate: "1900-03-14", birthYearKnown: false,
    });
    await events.create(awa, {
      personId: q.id, kind: "birthday",
    });
    const sans = (await occurrences.list(awa, {})).find((o) => o.personId === q.id);
    expect(sans?.age).toBeNull();
  });

  describe("le statut se dérive de la date", () => {
    const poser = async (dans: number): Promise<string> => {
      const p = await persons.create(awa, { displayName: `P${dans}`, birthDate: "1990-03-14" });
      const e = await events.create(awa, { personId: p.id, kind: "birthday" });
      const jour = new Date(Date.now() + dans * 86_400_000).toISOString().slice(0, 10);
      await db.prisma.eventOccurrence.updateMany({
        where: { eventId: e.id }, data: { occurrenceDate: new Date(`${jour}T00:00:00Z`) },
      });
      return e.id;
    };

    it("avant la fenêtre : upcoming", async () => {
      await poser(60);
      const [o] = await occurrences.list(awa, { limit: 1 });
      expect(o?.status).toBe("upcoming");
    });

    it("dans la fenêtre : collecting", async () => {
      await poser(3);
      const [o] = await occurrences.list(awa, { limit: 1 });
      expect(o?.status).toBe("collecting");
    });

    it("après la fenêtre : closed", async () => {
      const hier = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10);
      await poser(-40);
      const [o] = await occurrences.list(awa, { from: hier, limit: 1 });
      expect(o?.status).toBe("closed");
    });
  });

  it("ne rend pas le détail d'une échéance d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine", birthDate: "1990-03-14" });
    const e = await events.create(bila, { personId: p.id, kind: "birthday" });
    const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });
    await expect(occurrences.get(awa, o.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("rend le détail d'une échéance avec le nom du proche", async () => {
    const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    const e = await events.create(awa, { personId: p.id, kind: "birthday" });
    const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });
    const detail = await occurrences.get(awa, o.id);
    expect(detail.personDisplayName).toBe("Valery");
    expect(detail.id).toBe(o.id);
  });

  describe("les notes de circonstance", () => {
    it("écrit une note de circonstance rattachée à l'occasion", async () => {
      const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
      const e = await events.create(awa, { personId: p.id, kind: "birthday" });
      const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });

      const n = await notes.createForOccurrence(awa, o.id, { content: "Il a parlé d'un cadeau" });
      expect(n.eventOccurrenceId).toBe(o.id);
      expect(n.personId).toBe(p.id);
    });

    // Les deux natures ne se mélangent pas : la fiche montre les durables, la
    // page de l'occasion montre les siennes. Une note de circonstance qui
    // remonterait dans les durables ferait ressurgir « il a parlé d'un moulin »
    // trois ans plus tard, hors de son contexte.
    it("ne mêle pas les durables et les notes de circonstance", async () => {
      const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
      const e = await events.create(awa, { personId: p.id, kind: "birthday" });
      const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });

      await notes.createForPerson(awa, p.id, { content: "aime le café" });
      await notes.createForOccurrence(awa, o.id, { content: "lui offrir un moulin" });

      const durables = await notes.listForPerson(awa, p.id);
      expect(durables.map((n) => n.content)).toEqual(["aime le café"]);

      const circonstance = await notes.listForOccurrence(awa, o.id);
      expect(circonstance.map((n) => n.content)).toEqual(["lui offrir un moulin"]);
    });

    it("n'écrit pas sur l'occasion d'un autre compte", async () => {
      const p = await persons.create(bila, { displayName: "Celarine", birthDate: "1990-03-14" });
      const e = await events.create(bila, { personId: p.id, kind: "birthday" });
      const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });

      await expect(
        notes.createForOccurrence(awa, o.id, { content: "essai" }),
      ).rejects.toMatchObject({ code: "not_found" });
      expect(await db.prisma.note.count()).toBe(0);
    });
  });

  describe("HTTP de bout en bout", () => {
    const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
    const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
    const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

    let app: INestApplication;
    let baseUrl: string;
    let precedent: Record<string, string | undefined>;

    beforeAll(async () => {
      precedent = {
        DATABASE_URL: process.env.DATABASE_URL,
        OTP_PEPPER: process.env.OTP_PEPPER,
        JWT_SECRET: process.env.JWT_SECRET,
        ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
        LEHNO_MAIL_CONSOLE: process.env.LEHNO_MAIL_CONSOLE,
      };
      process.env.DATABASE_URL = db.url;
      process.env.OTP_PEPPER = PEPPER;
      process.env.JWT_SECRET = SECRET;
      process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
      process.env.LEHNO_MAIL_CONSOLE = "1";

      app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
      app.setGlobalPrefix("v1");
      app.useGlobalFilters(new AppExceptionFilter());
      await app.listen(0);
      baseUrl = await app.getUrl();
    }, 120_000);

    afterAll(async () => {
      await app.close();
      for (const [cle, valeur] of Object.entries(precedent)) {
        if (valeur === undefined) delete process.env[cle];
        else process.env[cle] = valeur;
      }
    });

    const jeton = (userId: string): string =>
      jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });

    it("refuse un appel sans jeton", async () => {
      const r = await fetch(`${baseUrl}/v1/me/occurrences`);
      expect(r.status).toBe(401);
    });

    it("liste ses échéances via HTTP, avec limit en chaîne", async () => {
      const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
      await events.create(awa, { personId: p.id, kind: "birthday" });
      const r = await fetch(`${baseUrl}/v1/me/occurrences?limit=1`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { personDisplayName: string }[];
      expect(corps).toHaveLength(1);
      expect(corps[0]?.personDisplayName).toBe("Valery");
    });

    it("lit le détail d'une échéance via HTTP", async () => {
      const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
      const e = await events.create(awa, { personId: p.id, kind: "birthday" });
      const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });
      const r = await fetch(`${baseUrl}/v1/me/occurrences/${o.id}`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { id: string };
      expect(corps.id).toBe(o.id);
    });

    it("rend 404 sur le détail d'une échéance d'un autre compte", async () => {
      const p = await persons.create(bila, { displayName: "Celarine", birthDate: "1990-03-14" });
      const e = await events.create(bila, { personId: p.id, kind: "birthday" });
      const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });
      const r = await fetch(`${baseUrl}/v1/me/occurrences/${o.id}`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(404);
    });

    it("refuse un identifiant malformé avec 400", async () => {
      const r = await fetch(`${baseUrl}/v1/me/occurrences/pas-un-uuid`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(400);
    });

    it("refuse une requête mal formée avec 400", async () => {
      const r = await fetch(`${baseUrl}/v1/me/occurrences?limit=abc`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(400);
    });

    it("écrit une note de circonstance via HTTP et rend 201", async () => {
      const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
      const e = await events.create(awa, { personId: p.id, kind: "birthday" });
      const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });

      const r = await fetch(`${baseUrl}/v1/me/occurrences/${o.id}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ content: "Il a parlé d'un cadeau" }),
      });
      expect(r.status).toBe(201);
      const corps = (await r.json()) as { eventOccurrenceId: string };
      expect(corps.eventOccurrenceId).toBe(o.id);
    });

    it("liste les notes d'une occasion via HTTP", async () => {
      const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
      const e = await events.create(awa, { personId: p.id, kind: "birthday" });
      const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });
      await notes.createForOccurrence(awa, o.id, { content: "lui offrir un moulin" });

      const r = await fetch(`${baseUrl}/v1/me/occurrences/${o.id}/notes`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { content: string }[];
      expect(corps.map((n) => n.content)).toEqual(["lui offrir un moulin"]);
    });

    it("rend 404 sur les notes de l'occasion d'un autre compte", async () => {
      const p = await persons.create(bila, { displayName: "Celarine", birthDate: "1990-03-14" });
      const e = await events.create(bila, { personId: p.id, kind: "birthday" });
      const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });

      const r = await fetch(`${baseUrl}/v1/me/occurrences/${o.id}/notes`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(404);
    });
  });
});
