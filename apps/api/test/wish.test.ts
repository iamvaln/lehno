import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { wishSchema } from "@lehno/contracts";
import { WishService } from "../src/me/wish.service.js";
import { PersonService } from "../src/me/person.service.js";
import { EventService } from "../src/me/event.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { FlagsService } from "../src/flags/flags.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("les souhaits notés sur la fiche d'un proche", () => {
  let db: TestDb;
  let souhaits: WishService;
  let persons: PersonService;
  let drapeaux: FlagsService;
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

  // Une occasion appartenant à `userId` : un proche, son anniversaire, une
  // échéance. C'est la chaîne entière que le cloisonnement doit remonter —
  // souhait → occurrence → compte —, et l'écrire en entier ici évite d'en
  // éprouver un maillon en croyant les éprouver tous.
  const occasion = async (userId: string): Promise<string> => {
    const p = await persons.create(userId, { displayName: "Valery", gender: "male" });
    const e = await db.prisma.event.create({
      data: { personId: p.id, kind: "birthday", referenceDate: new Date("1990-08-24") },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId, occurrenceDate: new Date("2026-08-24"), occurrenceYear: 2026 },
    });
    return o.id;
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    drapeaux = new FlagsService(db.prisma as never);
    await drapeaux.reconcilier();
    // `wishlist` allumé : ces cas éprouvent la surface, pas son extinction.
    // Un drapeau naît ÉTEINT — c'est voulu, et c'est l'état d'un déploiement
    // neuf ; le cas HTTP plus bas éprouve précisément l'autre position.
    await db.prisma.featureFlag.update({ where: { key: "wishlist" }, data: { enabled: true } });
    const depot = new TenantRepository(db.prisma as never);
    persons = new PersonService(
      depot,
      new EventService(depot, db.prisma as never, new FlagsService(db.prisma as never)),
      db.prisma as never,
    );
    souhaits = new WishService(depot, db.prisma as never);
    awa = await compte();
    bila = await compte();
  });

  it("note un souhait sur une occasion et le rend dans sa liste", async () => {
    const o = await occasion(awa);
    const s = await souhaits.createForOccurrence(awa, o, { label: "Un moulin à café manuel" });

    expect(wishSchema.safeParse(s).success).toBe(true);
    expect(s.occurrenceId).toBe(o);
    expect((await souhaits.listForOccurrence(awa, o)).map((x) => x.id)).toEqual([s.id]);
  });

  /* La PROVENANCE est posée par le serveur, jamais lue du corps. Sans cette
     garde, un ajout personnel pourrait se déclarer `collected` et se faire
     passer pour une confidence du proche lui-même — l'écran affiche cette
     distinction, et la génération d'idées s'en sert. */
  it("pose la provenance « owner » sur ce que le propriétaire note lui-même", async () => {
    const o = await occasion(awa);
    const s = await souhaits.createForOccurrence(awa, o, { label: "Un livre" });
    expect(s.origin).toBe("owner");
    expect(s.status).toBe("available");
    // L'auteur est tracé : la contribution anonyme laisse la colonne nulle,
    // mais ce chemin-ci est celui du propriétaire et doit la remplir.
    const ligne = await db.prisma.wishlistItem.findUniqueOrThrow({ where: { id: s.id } });
    expect(ligne.authorUserId).toBe(awa);
  });

  /* Le REPÈRE PERSONNEL, pas une exposition. La colonne s'appelait
     `is_public` : sur une table dont chaque ligne est privée, un booléen nommé
     « public » finit par être exposé un jour sur la foi de son seul nom. */
  it("marque un souhait sans le rendre public ni le rendre indisponible", async () => {
    const o = await occasion(awa);
    const s = await souhaits.createForOccurrence(awa, o, { label: "Un châle" });
    expect(s.isShortlisted).toBe(false);

    const marque = await souhaits.update(awa, s.id, { isShortlisted: true });
    expect(marque.isShortlisted).toBe(true);
    // Marquer n'engage à rien : la disponibilité ne bouge pas.
    expect(marque.status).toBe("available");
    const ligne = await db.prisma.wishlistItem.findUniqueOrThrow({ where: { id: s.id } });
    expect(ligne.isShortlisted).toBe(true);
  });

  it("déclare un souhait offert", async () => {
    const o = await occasion(awa);
    const s = await souhaits.createForOccurrence(awa, o, { label: "Un carnet relié" });
    expect((await souhaits.update(awa, s.id, { status: "fulfilled" })).status).toBe("fulfilled");
  });

  it("retire un souhait", async () => {
    const o = await occasion(awa);
    const s = await souhaits.createForOccurrence(awa, o, { label: "Un carnet" });
    await souhaits.remove(awa, s.id);
    expect(await souhaits.listForOccurrence(awa, o)).toEqual([]);
  });

  // ── Le cloisonnement, sur toute la chaîne ────────────────────────────────

  /* 404 AVANT de lire, pas une liste vide. Une liste vide serait
     indiscernable d'une occasion à soi sans souhait, et l'identifiant
     deviendrait un oracle : on apprendrait qu'une occasion existe ailleurs en
     l'essayant. C'est la même règle que `personId` sur /me/occurrences. */
  it("ne laisse pas deviner l'occasion d'un autre compte par une liste vide", async () => {
    const o = await occasion(bila);
    await expect(souhaits.listForOccurrence(awa, o)).rejects.toMatchObject({ code: "not_found" });
  });

  it("n'écrit pas de souhait sur l'occasion d'un autre compte", async () => {
    const o = await occasion(bila);
    await expect(
      souhaits.createForOccurrence(awa, o, { label: "essai" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.wishlistItem.count()).toBe(0);
  });

  /* La chaîne entière : le souhait n'a pas de colonne de compte, son
     appartenance passe par l'occurrence. `not_found`, jamais `forbidden` —
     distinguer les deux ferait de l'identifiant un oracle. */
  it("ne corrige pas le souhait d'un autre compte, et ne dit pas qu'il existe", async () => {
    const o = await occasion(bila);
    const s = await souhaits.createForOccurrence(bila, o, { label: "secret" });

    await expect(souhaits.update(awa, s.id, { label: "détourné" }))
      .rejects.toMatchObject({ code: "not_found" });
    await expect(souhaits.remove(awa, s.id)).rejects.toMatchObject({ code: "not_found" });

    const ligne = await db.prisma.wishlistItem.findUniqueOrThrow({ where: { id: s.id } });
    expect(ligne.label).toBe("secret");
  });

  it("ne rend que les souhaits de l'occasion demandée", async () => {
    const a = await occasion(awa);
    const b = await occasion(awa);
    await souhaits.createForOccurrence(awa, a, { label: "pour l'une" });
    await souhaits.createForOccurrence(awa, b, { label: "pour l'autre" });
    expect((await souhaits.listForOccurrence(awa, a)).map((s) => s.label)).toEqual(["pour l'une"]);
  });

  // ── Ce que le serveur refuse ─────────────────────────────────────────────

  /* L'invariant « un prix porte sa devise » appartient à l'ÉTAT FINAL, pas au
     message. Un PATCH { currency: null } traverse le schéma sans encombre — il
     ne porte aucun prix — et laisserait un souhait à 12 000 sans dire de quoi :
     ni des francs CFA, ni des euros. Seul le serveur voit le souhait fusionné. */
  it("refuse de retirer la devise d'un souhait qui garde son prix", async () => {
    const o = await occasion(awa);
    const s = await souhaits.createForOccurrence(awa, o, {
      label: "Un moulin", price: 12000, currency: "XAF",
    });
    await expect(souhaits.update(awa, s.id, { currency: null }))
      .rejects.toMatchObject({ code: "validation_failed" });

    const inchange = await db.prisma.wishlistItem.findUniqueOrThrow({ where: { id: s.id } });
    expect(inchange.currency).toBe("XAF");
  });

  // L'inverse doit passer : retirer le prix ET la devise ensemble est une
  // correction légitime, et une garde trop large l'interdirait.
  it("laisse retirer le prix et sa devise ensemble", async () => {
    const o = await occasion(awa);
    const s = await souhaits.createForOccurrence(awa, o, {
      label: "Un moulin", price: 12000, currency: "XAF",
    });
    const corrige = await souhaits.update(awa, s.id, { price: null, currency: null });
    expect(corrige.price).toBeNull();
  });

  // ── Par HTTP : le drapeau, l'authentification, les statuts ───────────────

  describe("par HTTP", () => {
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

    it("écrit un souhait via HTTP et rend 201", async () => {
      const o = await occasion(awa);
      const r = await fetch(`${baseUrl}/v1/me/occurrences/${o}/wishes`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ label: "Un moulin à café" }),
      });
      expect(r.status).toBe(201);
      expect((await r.json() as { origin: string }).origin).toBe("owner");
    });

    it("rend 204 sur une suppression", async () => {
      const o = await occasion(awa);
      const s = await souhaits.createForOccurrence(awa, o, { label: "Un carnet" });
      const r = await fetch(`${baseUrl}/v1/me/wishes/${s.id}`, {
        method: "DELETE", headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(204);
    });

    it("rend 404 sur le souhait d'un autre compte, jamais 403", async () => {
      const o = await occasion(bila);
      const s = await souhaits.createForOccurrence(bila, o, { label: "secret" });
      const r = await fetch(`${baseUrl}/v1/me/wishes/${s.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ label: "détourné" }),
      });
      expect(r.status).toBe(404);
    });

    /* `reserved` DÉCOULE d'une réservation confirmée : le propriétaire ne le
       pose pas. Le lui laisser écrire permettrait de déclarer pris un cadeau
       que personne n'a réservé. Le refus se joue au serveur, pas à l'écran. */
    it("refuse au serveur de déclarer un souhait réservé", async () => {
      const o = await occasion(awa);
      const s = await souhaits.createForOccurrence(awa, o, { label: "Un livre" });
      const r = await fetch(`${baseUrl}/v1/me/wishes/${s.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ status: "reserved" }),
      });
      expect(r.status).toBe(400);
    });

    it("refuse un PATCH vide et un libellé vide", async () => {
      const o = await occasion(awa);
      const s = await souhaits.createForOccurrence(awa, o, { label: "Un livre" });
      const entete = { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` };
      const vide = await fetch(`${baseUrl}/v1/me/wishes/${s.id}`, {
        method: "PATCH", headers: entete, body: "{}",
      });
      expect(vide.status).toBe(400);
      const sansLibelle = await fetch(`${baseUrl}/v1/me/occurrences/${o}/wishes`, {
        method: "POST", headers: entete, body: JSON.stringify({ label: "   " }),
      });
      expect(sansLibelle.status).toBe(400);
    });

    it("refuse un prix sans devise", async () => {
      const o = await occasion(awa);
      const r = await fetch(`${baseUrl}/v1/me/occurrences/${o}/wishes`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ label: "Un moulin", price: 12000 }),
      });
      expect(r.status).toBe(400);
    });

    it("refuse un appel sans jeton", async () => {
      const o = await occasion(awa);
      const r = await fetch(`${baseUrl}/v1/me/occurrences/${o}/wishes`);
      expect(r.status).toBe(401);
    });

    /* LE cas du drapeau, et il y a deux choses dedans.
     *
     * `404` et non `403` : un `403` distinguerait « éteinte » de « refusée » et
     * révélerait ainsi que la surface existe (§6.2).
     *
     * ET SANS JETON AUSSI : le garde de drapeau passe AVANT celui
     * d'authentification. Dans l'autre ordre, l'appel sans jeton rendrait 401
     * sur une surface éteinte et 401 sur une surface allumée — mais l'appel
     * AVEC jeton rendrait 404 d'un côté et 200 de l'autre, ce qui suffit à
     * savoir. Le sans-jeton est ce qui prouve l'ordre des gardes. */
    it("rend 404 sur tous ces chemins quand le drapeau est éteint, jeton ou pas", async () => {
      const o = await occasion(awa);
      const s = await souhaits.createForOccurrence(awa, o, { label: "Un livre" });
      await db.prisma.featureFlag.update({ where: { key: "wishlist" }, data: { enabled: false } });
      try {
        const avecJeton = { authorization: `Bearer ${jeton(awa)}`, "content-type": "application/json" };
        const appels = [
          fetch(`${baseUrl}/v1/me/occurrences/${o}/wishes`, { headers: avecJeton }),
          fetch(`${baseUrl}/v1/me/occurrences/${o}/wishes`, {
            method: "POST", headers: avecJeton, body: JSON.stringify({ label: "x" }),
          }),
          fetch(`${baseUrl}/v1/me/wishes/${s.id}`, {
            method: "PATCH", headers: avecJeton, body: JSON.stringify({ label: "x" }),
          }),
          fetch(`${baseUrl}/v1/me/wishes/${s.id}`, { method: "DELETE", headers: avecJeton }),
          // Sans jeton : c'est ce cas qui prouve que FeatureGuard passe avant
          // AuthGuard. Un 401 ici dirait que la surface existe.
          fetch(`${baseUrl}/v1/me/occurrences/${o}/wishes`),
        ];
        for (const r of await Promise.all(appels)) expect(r.status).toBe(404);

        // Et rien n'a été écrit : un drapeau éteint ferme la porte, il ne
        // laisse pas passer l'écriture en taisant la réponse.
        expect(await db.prisma.wishlistItem.count()).toBe(1);
      } finally {
        await db.prisma.featureFlag.update({ where: { key: "wishlist" }, data: { enabled: true } });
      }
    });

    it("rend 400 sur un identifiant d'occasion malformé", async () => {
      const r = await fetch(`${baseUrl}/v1/me/occurrences/pas-un-uuid/wishes`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(400);
    });
  });
});
