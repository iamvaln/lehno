import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { EventService } from "../src/me/event.service.js";
import { PersonService } from "../src/me/person.service.js";
import { OccurrenceService } from "../src/me/occurrence.service.js";
import { HomeService } from "../src/me/home.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { ajouterJours } from "../src/me/calendrier.js";

describe("l'accueil en un appel", () => {
  let db: TestDb;
  let events: EventService;
  let persons: PersonService;
  let occurrences: OccurrenceService;
  let home: HomeService;
  let awa: string;
  let bila: string;

  const compte = async (extra: { displayName?: string } = {}): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
        ...extra,
      },
    });
    return u.id;
  };

  const aujourdhui = (): string => new Date().toISOString().slice(0, 10);

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const depot = new TenantRepository(db.prisma as never);
    events = new EventService(depot, db.prisma as never);
    persons = new PersonService(depot, events, db.prisma as never);
    occurrences = new OccurrenceService(depot, db.prisma as never);
    home = new HomeService(db.prisma as never, occurrences);
    awa = await compte({ displayName: "Awa" });
    bila = await compte();
  });

  // LE piège : la liste rendue est plafonnée à trois cartes, mais le décompte
  // doit porter sur TOUTE la table, pas sur cet extrait. Cinq échéances
  // aujourd'hui doivent donner `counts.today = 5`, jamais 3.
  it("compte séparément de la liste plafonnée à trois cartes", async () => {
    const jour = aujourdhui();
    for (let i = 0; i < 5; i++) {
      const p = await persons.create(awa, { displayName: `Proche ${i}` });
      await events.create(awa, { personId: p.id, kind: "other", label: `Occasion ${i}`, referenceDate: jour });
    }

    const rendu = await home.get(awa);
    expect(rendu.occurrences).toHaveLength(3);
    expect(rendu.counts.today).toBe(5);
    expect(rendu.counts.thisWeek).toBe(5);
  });

  it("distingue aujourd'hui de cette semaine, et exclut ce qui dépasse la semaine", async () => {
    const jour = aujourdhui();
    const pAujourdhui = await persons.create(awa, { displayName: "Aujourd'hui" });
    await events.create(awa, { personId: pAujourdhui.id, kind: "other", label: "Aujourd'hui", referenceDate: jour });

    const pSemaine = await persons.create(awa, { displayName: "Dans la semaine" });
    await events.create(awa, {
      personId: pSemaine.id, kind: "other", label: "Dans la semaine", referenceDate: ajouterJours(jour, 5),
    });

    const pApresSemaine = await persons.create(awa, { displayName: "Après la semaine" });
    await events.create(awa, {
      personId: pApresSemaine.id, kind: "other", label: "Après la semaine", referenceDate: ajouterJours(jour, 10),
    });

    const rendu = await home.get(awa);
    expect(rendu.counts.today).toBe(1);
    expect(rendu.counts.thisWeek).toBe(2);
  });

  it("ne compte pas les échéances d'un autre compte", async () => {
    const jour = aujourdhui();
    const p = await persons.create(bila, { displayName: "Celarine" });
    await events.create(bila, { personId: p.id, kind: "other", label: "Autre compte", referenceDate: jour });

    const rendu = await home.get(awa);
    expect(rendu.counts.today).toBe(0);
    expect(rendu.counts.thisWeek).toBe(0);
    expect(rendu.occurrences).toHaveLength(0);
  });

  it("porte le prénom depuis le nom d'affichage", async () => {
    const rendu = await home.get(awa);
    expect(rendu.firstName).toBe("Awa");
  });

  // `display_name` est facultatif — voir SignupService, qui retombe déjà sur
  // `username` pour désigner un compte sans nom d'affichage.
  it("retombe sur le nom d'utilisateur sans nom d'affichage", async () => {
    const rendu = await home.get(bila);
    const u = await db.prisma.user.findUniqueOrThrow({ where: { id: bila } });
    expect(rendu.firstName).toBe(u.username);
  });

  it("distingue le carnet neuf du carnet rempli sans échéance", async () => {
    const vide = await home.get(awa);
    expect(vide.hasPersons).toBe(false);

    await persons.create(awa, { displayName: "Valery" });
    const rempli = await home.get(awa);
    expect(rempli.hasPersons).toBe(true);
    expect(rempli.occurrences).toHaveLength(0);
  });

  it("compte les notifications non lues, propres au compte", async () => {
    await db.prisma.notification.create({
      data: { userId: awa, type: "digest", channel: "in_app", titleKey: "digest.ready", readAt: null },
    });
    await db.prisma.notification.create({
      data: { userId: awa, type: "digest", channel: "in_app", titleKey: "digest.ready", readAt: new Date() },
    });
    await db.prisma.notification.create({
      data: { userId: bila, type: "digest", channel: "in_app", titleKey: "digest.ready", readAt: null },
    });

    const rendu = await home.get(awa);
    expect(rendu.unreadNotifications).toBe(1);
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
      const r = await fetch(`${baseUrl}/v1/me/home`);
      expect(r.status).toBe(401);
    });

    it("rend l'accueil via HTTP", async () => {
      const p = await persons.create(awa, { displayName: "Valery" });
      await events.create(awa, {
        personId: p.id, kind: "other", label: "Occasion", referenceDate: aujourdhui(),
      });

      const r = await fetch(`${baseUrl}/v1/me/home`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(200);
      const corps = (await r.json()) as {
        firstName: string; occurrences: unknown[]; counts: { today: number; thisWeek: number };
        unreadNotifications: number; hasPersons: boolean;
      };
      expect(corps.firstName).toBe("Awa");
      expect(corps.occurrences).toHaveLength(1);
      expect(corps.counts).toEqual({ today: 1, thisWeek: 1 });
      expect(corps.unreadNotifications).toBe(0);
      expect(corps.hasPersons).toBe(true);
    });
  });
});
