import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { noteSchema } from "@lehno/contracts";
import { NoteService } from "../src/me/note.service.js";
import { PersonService } from "../src/me/person.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

describe("les notes d'un proche", () => {
  let db: TestDb;
  let notes: NoteService;
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
    persons = new PersonService(depot);
    notes = new NoteService(depot, db.prisma as never);
    awa = await compte();
    bila = await compte();
  });

  it("crée une note déjà rangée", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const n = await notes.createForPerson(awa, p.id, { content: "Il a parlé d'un cadeau" });

    expect(noteSchema.safeParse(n).success).toBe(true);
    expect(n.categories).toContain("gift_ideas");
    expect(n.eventOccurrenceId).toBeNull();
  });

  // Le classement est une décision du serveur : il est rendu AVEC la note,
  // sans second appel (spec technique §5.2).
  it("range en base, pas seulement dans la réponse", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const n = await notes.createForPerson(awa, p.id, { content: "Elle adore le cinéma" });

    const liens = await db.prisma.noteCategory.findMany({ where: { noteId: n.id } });
    expect(liens).toHaveLength(n.categories.length);
    expect(liens.every((l) => l.assignedBy === "auto")).toBe(true);
  });

  // L'INVARIANT que le classement ne doit jamais mettre en cause : une note
  // sans aucune catégorie reste dans la liste du proche, telle qu'elle a été
  // saisie. Le classement décore, il ne conditionne pas la visibilité.
  //
  // Sans ce cas, une jointure interne sur les catégories — écrite un jour pour
  // « simplifier » la requête — ferait disparaître silencieusement les notes
  // non classées. C'est précisément la perte que l'ancien repli sur « facts »
  // prétendait éviter, en la payant d'un mensonge.
  it("rend les notes sans aucune catégorie", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const n = await notes.createForPerson(awa, p.id, { content: "azerty qwerty" });
    expect(n.categories).toEqual([]);

    const listees = await notes.listForPerson(awa, p.id);
    expect(listees.map((x) => x.id)).toContain(n.id);
    expect(listees.find((x) => x.id === n.id)?.content).toBe("azerty qwerty");
  });

  it("n'écrit pas de note sur le proche d'un autre", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    await expect(
      notes.createForPerson(awa, p.id, { content: "essai" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.note.count()).toBe(0);
  });

  // 404 avant même de lire : une liste vide laisserait croire que le proche
  // existe et n'a rien, et l'identifiant deviendrait un oracle.
  it("ne lit pas les notes du proche d'un autre", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    await notes.createForPerson(bila, p.id, { content: "secret" });
    await expect(notes.listForPerson(awa, p.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("ne lit que les notes du proche demandé", async () => {
    const a = await persons.create(awa, { displayName: "Valery" });
    const b = await persons.create(awa, { displayName: "Celarine" });
    await notes.createForPerson(awa, a.id, { content: "aime le café" });
    await notes.createForPerson(awa, b.id, { content: "aime le thé" });

    const vues = await notes.listForPerson(awa, a.id);
    expect(vues.map((n) => n.content)).toEqual(["aime le café"]);
  });

  // Les plus récentes d'abord : la fiche se lit du haut, et une note fraîche
  // vaut mieux qu'une note d'il y a deux ans (doc fonctionnelle §7).
  it("rend les notes de la plus récente à la plus ancienne", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    await notes.createForPerson(awa, p.id, { content: "premiere" });
    await new Promise((r) => setTimeout(r, 5));
    await notes.createForPerson(awa, p.id, { content: "seconde" });

    const vues = await notes.listForPerson(awa, p.id);
    expect(vues[0]?.content).toBe("seconde");
  });

  // Le double rattachement est VOULU, pas toléré : une difficulté relève de ce
  // qu'il traverse ET de ce qu'il a besoin d'entendre (doc fonctionnelle §7).
  it("garde les deux catégories d'une note à double rattachement", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const n = await notes.createForPerson(awa, p.id, {
      content: "Il traverse une période difficile, il a besoin qu'on le soutienne",
    });
    expect(n.categories).toContain("challenges");
    expect(n.categories).toContain("encouragements");
  });

  // Supprimer un proche emporte ses notes : la cascade est déclarée au schéma,
  // ce cas la constate plutôt que de la supposer.
  it("les notes disparaissent avec le proche", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    await notes.createForPerson(awa, p.id, { content: "aime le café" });
    await persons.remove(awa, p.id);
    expect(await db.prisma.note.count({ where: { personId: p.id } })).toBe(0);
  });

  describe("une note pour plusieurs proches", () => {
    it("crée une note par proche, indépendantes", async () => {
      const a = await persons.create(awa, { displayName: "Valery" });
      const b = await persons.create(awa, { displayName: "Celarine" });

      const creees = await notes.createForMany(awa, {
        content: "Ils adorent le cinéma", personIds: [a.id, b.id],
      });

      expect(creees).toHaveLength(2);
      expect(new Set(creees.map((n) => n.id)).size).toBe(2);
      expect(creees.map((n) => n.personId).sort()).toEqual([a.id, b.id].sort());
      // Indépendantes : chacune porte son propre classement, et corriger l'une
      // plus tard ne touchera pas l'autre.
      expect(creees.every((n) => n.categories.includes("interests"))).toBe(true);
    });

    // TOUT OU RIEN. Sans vérification préalable, la première note partirait
    // avant qu'on découvre que la seconde n'est pas permise : l'appelant
    // recevrait une erreur en croyant que rien n'a été écrit, alors qu'une
    // note serait déjà sur une fiche.
    it("n'écrit rien si un seul identifiant n'est pas au demandeur", async () => {
      const mien = await persons.create(awa, { displayName: "Valery" });
      const autre = await persons.create(bila, { displayName: "Celarine" });

      await expect(
        notes.createForMany(awa, { content: "essai", personIds: [mien.id, autre.id] }),
      ).rejects.toMatchObject({ code: "not_found" });

      expect(await db.prisma.note.count(), "aucune note ne doit exister").toBe(0);
    });

    // Un identifiant qui ne désigne personne échoue comme celui d'un autre :
    // les deux rendent 404, et rien ne les distingue de l'extérieur.
    it("n'écrit rien si un identifiant ne désigne personne", async () => {
      const mien = await persons.create(awa, { displayName: "Valery" });
      await expect(
        notes.createForMany(awa, {
          content: "essai",
          personIds: [mien.id, "00000000-0000-4000-8000-000000000000"],
        }),
      ).rejects.toMatchObject({ code: "not_found" });
      expect(await db.prisma.note.count()).toBe(0);
    });

    // Le même proche cité deux fois ne mérite pas deux notes identiques — et
    // sans dédoublonnage, le décompte de vérification serait faussé.
    it("un proche cité deux fois ne reçoit qu'une note", async () => {
      const a = await persons.create(awa, { displayName: "Valery" });
      const creees = await notes.createForMany(awa, {
        content: "aime le café", personIds: [a.id, a.id],
      });
      expect(creees).toHaveLength(1);
      expect(await db.prisma.note.count({ where: { personId: a.id } })).toBe(1);
    });

    it("attache l'occasion à toutes les notes quand elle est donnée", async () => {
      // Monter l'événement et son occurrence directement en base : cette tâche
      // ne construit pas les chemins des dates, elle s'appuie sur le schéma.
      const a = await persons.create(awa, { displayName: "Valery" });
      const b = await persons.create(awa, { displayName: "Celarine" });
      const e = await db.prisma.event.create({
        data: {
          personId: a.id, authorUserId: awa, kind: "birthday",
          eventNature: "happy", label: "Anniversaire",
          referenceDate: new Date("1990-03-14"),
        },
      });
      const o = await db.prisma.eventOccurrence.create({
        data: { eventId: e.id, userId: awa, occurrenceDate: new Date("2026-03-14") },
      });

      const creees = await notes.createForMany(awa, {
        content: "Ils adorent le cinéma", personIds: [a.id, b.id], eventOccurrenceId: o.id,
      });
      expect(creees.every((n) => n.eventOccurrenceId === o.id)).toBe(true);
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
      const p = await persons.create(awa, { displayName: "Valery" });
      const r = await fetch(`${baseUrl}/v1/me/persons/${p.id}/notes`);
      expect(r.status).toBe(401);
    });

    // Le seul pont entre le contrat calculé et ce que le serveur rend
    // réellement : le test de péremption compare le fichier au calcul, jamais
    // le calcul à la réponse HTTP.
    it("écrit une note via HTTP et rend 201", async () => {
      const p = await persons.create(awa, { displayName: "Valery" });
      const r = await fetch(`${baseUrl}/v1/me/persons/${p.id}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ content: "Elle adore le cinéma" }),
      });
      expect(r.status).toBe(201);
      const corps = (await r.json()) as { id: string; categories: string[] };
      expect(corps.categories).toContain("interests");
    });

    it("rend 404 sur le proche d'un autre compte", async () => {
      const p = await persons.create(bila, { displayName: "Celarine" });
      const r = await fetch(`${baseUrl}/v1/me/persons/${p.id}/notes`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(404);
    });

    it("rend 400 sur un identifiant de proche malformé", async () => {
      const r = await fetch(`${baseUrl}/v1/me/persons/pas-un-uuid/notes`, {
        headers: { authorization: `Bearer ${jeton(awa)}` },
      });
      expect(r.status).toBe(400);
    });
  });
});
