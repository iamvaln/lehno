import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { EventService } from "../src/me/event.service.js";
import { PersonService } from "../src/me/person.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

// Trente jours devant nous : une date d'événement libre valable, sans dépendre
// de la date du jour où le test tourne.
const dansTrenteJours = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

describe("les événements et leur première échéance", () => {
  let db: TestDb;
  let events: EventService;
  let persons: PersonService;
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
    const depot = new TenantRepository(db.prisma as never);
    events = new EventService(depot, db.prisma as never);
    persons = new PersonService(depot, events);
    awa = await compte();
    bila = await compte();
  });

  it("crée un anniversaire depuis la naissance du proche", async () => {
    const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    // AUCUNE date n'est donnée : le proche porte la sienne, et l'anniversaire
    // s'en déduit. La demander ici ouvrirait la porte à deux dates de
    // naissance divergentes pour la même personne.
    const e = await events.create(awa, { personId: p.id, kind: "birthday" });

    expect(e.kind).toBe("birthday");
    // La PROCHAINE échéance, jamais la naissance : un événement dit quand la
    // chose sera.
    expect(e.referenceDate.slice(5)).toBe("03-14");
    expect(e.referenceDate >= new Date().toISOString().slice(0, 10)).toBe(true);

    // L'occurrence naît AVEC l'événement : sans elle, un anniversaire saisi
    // n'apparaîtrait nulle part avant qu'un traitement programmé ne passe, et
    // l'utilisateur croirait sa saisie perdue.
    const ouvertes = await db.prisma.eventOccurrence.findMany({ where: { eventId: e.id } });
    expect(ouvertes).toHaveLength(1);
    expect(ouvertes[0]?.userId).toBe(awa);
  });

  it("un événement libre porte son libellé", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await events.create(awa, {
      personId: p.id, kind: "other", label: "Notre rencontre",
      referenceDate: dansTrenteJours,
    });
    expect(e.label).toBe("Notre rencontre");
  });

  it("n'attache pas un événement au proche d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    await expect(
      events.create(awa, { personId: p.id, kind: "birthday" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.event.count()).toBe(0);
  });

  // « La liste des événements du proche » (maquette §3.4) : la fiche montre les
  // siens, l'annuaire nu les montre tous. Deux vues, un seul chemin.
  it("filtre les événements sur un proche", async () => {
    const valery = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    const quentin = await persons.create(awa, { displayName: "Quentin", birthDate: "1988-07-02" });
    await events.create(awa, { personId: valery.id, kind: "birthday" });
    await events.create(awa, { personId: quentin.id, kind: "birthday" });

    expect(await events.list(awa, {})).toHaveLength(2);
    const siens = await events.list(awa, { personId: valery.id });
    expect(siens).toHaveLength(1);
    expect(siens[0]?.personId).toBe(valery.id);
  });

  // Sans cette garde, le filtre deviendrait un oracle : une liste vide dirait
  // « ce proche existe et n'a pas d'événement », d'un proche qui est à un autre.
  it("rend 404 quand le proche filtré n'est pas au demandeur", async () => {
    const celarine = await persons.create(bila, { displayName: "Celarine" });
    await expect(events.list(awa, { personId: celarine.id })).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("ne rend pas l'événement d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine", birthDate: "1990-03-14" });
    const e = await events.create(bila, { personId: p.id, kind: "birthday" });
    await expect(events.get(awa, e.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("ne supprime pas l'événement d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine", birthDate: "1990-03-14" });
    const e = await events.create(bila, { personId: p.id, kind: "birthday" });
    await expect(events.remove(awa, e.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.event.count({ where: { id: e.id } })).toBe(1);
  });

  // Supprimer un événement emporte ses occurrences : la cascade est déclarée
  // au schéma, ce cas la constate plutôt que de la supposer.
  it("supprimer l'événement emporte ses échéances", async () => {
    const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    const e = await events.create(awa, { personId: p.id, kind: "birthday" });
    await events.remove(awa, e.id);
    expect(await db.prisma.eventOccurrence.count({ where: { eventId: e.id } })).toBe(0);
  });

  // « Proche déjà porteur d'un anniversaire : l'application le signale plutôt
  // que d'en créer un second » (§3.6). La règle vit au SERVEUR : un client qui
  // l'oublie ne doit pas pouvoir en créer deux, sinon la fiche affiche deux
  // anniversaires pour la même personne et les rappels partent en double.
  it("refuse un second anniversaire pour le même proche", async () => {
    const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    await events.create(awa, { personId: p.id, kind: "birthday" });

    await expect(
      events.create(awa, { personId: p.id, kind: "birthday" }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(await db.prisma.event.count({ where: { personId: p.id } })).toBe(1);
  });

  // En revanche plusieurs événements LIBRES coexistent : une même personne a
  // un mariage et une crémaillère.
  it("accepte plusieurs événements libres pour le même proche", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    await events.create(awa, { personId: p.id, kind: "other", label: "Mariage", referenceDate: "2999-07-02" });
    await events.create(awa, { personId: p.id, kind: "other", label: "Crémaillère", referenceDate: "2999-09-11" });
    expect(await db.prisma.event.count({ where: { personId: p.id } })).toBe(2);
  });

  // « Date déjà passée cette année : l'occasion créée vise l'année suivante »
  // (§3.6). Le noyau de calendrier le fait en sautant les échéances passées ;
  // ce cas l'épingle pour que personne ne « corrige » ce comportement — pour
  // un anniversaire, dont l'ancrage vient de la naissance du proche, jamais
  // d'une date donnée à la création.
  it("une date déjà passée cette année ouvre l'échéance de l'an prochain", async () => {
    // Hier, l'an dernier : l'échéance de cette année est derrière nous.
    const hier = new Date(Date.now() - 86_400_000);
    const jourMois = hier.toISOString().slice(5, 10);
    const p = await persons.create(awa, { displayName: "Valery", birthDate: `1990-${jourMois}` });
    const e = await events.create(awa, { personId: p.id, kind: "birthday" });

    const [o] = await db.prisma.eventOccurrence.findMany({ where: { eventId: e.id } });
    const annee = Number(o?.occurrenceDate.toISOString().slice(0, 4));
    expect(annee).toBe(hier.getUTCFullYear() + 1);
  });

  // Un événement porte UNE OU PLUSIEURS règles : « à échéances multiples pour
  // un événement qui en compte plusieurs — par exemple un mois puis trois mois
  // après une date » (§3.6). Une relation unique aurait rendu ce cas
  // inexprimable.
  it("garde plusieurs règles pour un même événement", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await events.create(awa, {
      personId: p.id, kind: "other", label: "Suivi", referenceDate: "2999-01-15",
      schedules: [
        { type: "offset", offsetUnit: "month", offsetAmount: 1, leadTimeDays: 3 },
        { type: "offset", offsetUnit: "month", offsetAmount: 3 },
      ],
    });

    const regles = await db.prisma.schedule.findMany({ where: { eventId: e.id } });
    expect(regles).toHaveLength(2);
    expect(regles.map((r) => r.offsetAmount).sort()).toEqual([1, 3]);
    expect(regles.find((r) => r.offsetAmount === 1)?.leadTimeDays).toBe(3);
  });

  // Un anniversaire sans règle explicite se répète chaque année : c'est ce que
  // le formulaire annonce, et l'utilisateur n'a rien à composer pour cela.
  it("un anniversaire reçoit sa règle annuelle sans qu'on la demande", async () => {
    const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    const e = await events.create(awa, { personId: p.id, kind: "birthday" });
    const [regle] = await db.prisma.schedule.findMany({ where: { eventId: e.id } });
    expect(regle).toMatchObject({ type: "recurrent", unit: "year", interval: 1 });
  });

  // Un proche SANS date de naissance ne peut pas avoir d'anniversaire. Créer
  // un événement vide en attendant donnerait une échéance qui ne tombe jamais,
  // et une fiche qui annonce une date qu'elle ne connaît pas.
  it("refuse un anniversaire pour un proche sans date de naissance", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    await expect(events.create(awa, { personId: p.id, kind: "birthday" }))
      .rejects.toMatchObject({ code: "validation_failed" });
    expect(await db.prisma.event.count()).toBe(0);
  });

  // L'année de naissance peut être inconnue : on suit l'anniversaire sans
  // pouvoir annoncer d'âge. L'échéance, elle, a toujours une année — celle
  // qui vient.
  it("ouvre l'échéance même sans l'année de naissance", async () => {
    const p = await persons.create(awa, {
      displayName: "Valery", birthDate: "1900-03-14", birthYearKnown: false,
    });
    const e = await events.create(awa, { personId: p.id, kind: "birthday" });
    expect(e.referenceDate.slice(5)).toBe("03-14");
    expect(e.referenceDate >= new Date().toISOString().slice(0, 10)).toBe(true);
  });

  // Corriger la NAISSANCE du proche doit recaler son anniversaire. Sans cela,
  // la fiche annoncerait l'ancienne date jusqu'à ce que quelqu'un s'en
  // aperçoive — et personne ne s'en aperçoit avant le jour dit.
  it("corriger la naissance recale l'anniversaire", async () => {
    const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
    const e = await events.create(awa, { personId: p.id, kind: "birthday" });
    await persons.update(awa, p.id, { birthDate: "1990-08-02" });

    const relu = await events.get(awa, e.id);
    expect(relu.referenceDate.slice(5)).toBe("08-02");

    const ouvertes = await db.prisma.eventOccurrence.findMany({ where: { eventId: e.id } });
    // Une seule, et au nouveau jour : laisser l'ancienne afficherait deux
    // anniversaires pour la même personne.
    expect(ouvertes).toHaveLength(1);
    expect(ouvertes[0]?.occurrenceDate.toISOString().slice(0, 10)).toMatch(/-08-02$/);
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
      const r = await fetch(`${baseUrl}/v1/me/events`);
      expect(r.status).toBe(401);
    });

    it("crée un anniversaire via HTTP et rend 201", async () => {
      const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
      const r = await fetch(`${baseUrl}/v1/me/events`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ personId: p.id, kind: "birthday" }),
      });
      expect(r.status).toBe(201);
      const corps = (await r.json()) as { id: string; kind: string; referenceDate: string };
      expect(corps.kind).toBe("birthday");
      expect(corps.referenceDate.slice(5)).toBe("03-14");
    });

    it("liste ses événements via HTTP", async () => {
      const p = await persons.create(awa, { displayName: "Valery" });
      await events.create(awa, { personId: p.id, kind: "other", label: "Mariage", referenceDate: dansTrenteJours });
      const r = await fetch(`${baseUrl}/v1/me/events`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(200);
      const corps = (await r.json()) as unknown[];
      expect(corps).toHaveLength(1);
    });

    it("lit un événement via HTTP", async () => {
      const p = await persons.create(awa, { displayName: "Valery" });
      const e = await events.create(awa, { personId: p.id, kind: "other", label: "Mariage", referenceDate: dansTrenteJours });
      const r = await fetch(`${baseUrl}/v1/me/events/${e.id}`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { label: string };
      expect(corps.label).toBe("Mariage");
    });

    it("corrige un événement via HTTP et rend 200", async () => {
      const p = await persons.create(awa, { displayName: "Valery" });
      const e = await events.create(awa, { personId: p.id, kind: "other", label: "Mariage", referenceDate: dansTrenteJours });
      const r = await fetch(`${baseUrl}/v1/me/events/${e.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ label: "Mariage de Sarah" }),
      });
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { label: string };
      expect(corps.label).toBe("Mariage de Sarah");
    });

    it("supprime un événement via HTTP et rend 204", async () => {
      const p = await persons.create(awa, { displayName: "Valery" });
      const e = await events.create(awa, { personId: p.id, kind: "other", label: "Mariage", referenceDate: dansTrenteJours });
      const r = await fetch(`${baseUrl}/v1/me/events/${e.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(204);
      const corps = await r.text();
      expect(corps).toBe("");
      expect(await db.prisma.event.count({ where: { id: e.id } })).toBe(0);
    });

    it("rend 404 sur GET/PATCH/DELETE pour l'événement d'un autre compte", async () => {
      const p = await persons.create(bila, { displayName: "Celarine", birthDate: "1990-03-14" });
      const e = await events.create(bila, { personId: p.id, kind: "birthday" });

      const get = await fetch(`${baseUrl}/v1/me/events/${e.id}`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(get.status).toBe(404);

      const patch = await fetch(`${baseUrl}/v1/me/events/${e.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ label: "Otage" }),
      });
      expect(patch.status).toBe(404);

      const del = await fetch(`${baseUrl}/v1/me/events/${e.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(del.status).toBe(404);
    });

    it("rend 409 sur un second anniversaire pour le même proche", async () => {
      const p = await persons.create(awa, { displayName: "Valery", birthDate: "1990-03-14" });
      await events.create(awa, { personId: p.id, kind: "birthday" });
      const r = await fetch(`${baseUrl}/v1/me/events`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ personId: p.id, kind: "birthday" }),
      });
      expect(r.status).toBe(409);
    });

    it("rend 400 sur un corps mal formé", async () => {
      const p = await persons.create(awa, { displayName: "Valery" });
      const r = await fetch(`${baseUrl}/v1/me/events`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        // « other » sans libellé : le schéma le refuse.
        body: JSON.stringify({ personId: p.id, kind: "other", referenceDate: dansTrenteJours }),
      });
      expect(r.status).toBe(400);
    });

    it("refuse un identifiant malformé avec 400", async () => {
      const r = await fetch(`${baseUrl}/v1/me/events/pas-un-uuid`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(400);
    });
  });
});
