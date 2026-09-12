import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { personSchema } from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/* LA FICHE DE SOI, par l'application.
 *
 * PAR HTTP ET NON PAR LE SERVICE : ces cas éprouvent des routes qui n'existaient
 * pas, et une route ne se prouve qu'en montant l'application. Un test qui
 * construirait `PersonService` à la main serait vert avec un contrôleur non
 * déclaré au module — c'est déjà arrivé ici, sur un jeton d'injection.
 *
 * Ce qu'ils gardent : qu'on puisse l'écrire (elle ne s'écrivait nulle part),
 * qu'il n'y en ait qu'une, et qu'elle débloque ce qu'elle commande. */
describe("la fiche de soi", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let jeton: string;
  let userId: string;

  const compte = async (): Promise<{ id: string; jeton: string }> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    return { id: u.id, jeton: jwt.sign({ sub: u.id }, SECRET, { algorithm: "HS256", expiresIn: 900 }) };
  };

  beforeAll(async () => {
    db = await withDatabase();
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    process.env.LEHNO_MAIL_CONSOLE = "1";
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 180_000);

  afterAll(async () => { await app?.close(); await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await compte();
    userId = u.id;
    jeton = u.jeton;
  });

  const lire = (t = jeton) =>
    fetch(`${baseUrl}/v1/me/self`, { headers: { authorization: `Bearer ${t}` } });

  const ecrire = (corps: unknown, t = jeton) =>
    fetch(`${baseUrl}/v1/me/self`, {
      method: "PUT",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });

  const corriger = (corps: unknown, t = jeton) =>
    fetch(`${baseUrl}/v1/me/self`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${t}`, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });

  const carnet = (requete = "", t = jeton) =>
    fetch(`${baseUrl}/v1/me/persons${requete}`, { headers: { authorization: `Bearer ${t}` } });

  const MOI = { displayName: "Awa", gender: "female", birthDate: "1994-03-12" } as const;

  it("n'existe pas avant qu'on l'écrive", async () => {
    expect((await lire()).status).toBe(404);
  });

  it("s'écrit, et se relit marquée comme la sienne", async () => {
    const res = await ecrire(MOI);
    expect(res.status).toBe(200);
    const fiche = personSchema.parse(await res.json());
    expect(fiche.isSelf).toBe(true);
    expect(fiche.birthDate).toBe("1994-03-12");

    const relue = personSchema.parse(await (await lire()).json());
    expect(relue.id).toBe(fiche.id);
  });

  /* CE QUI JUSTIFIE LE `PUT`. Sans l'idempotence, l'application devrait lire
     avant chaque enregistrement pour savoir si elle crée ou corrige — et le
     jour où les deux appels se croisent, elle en poserait deux. */
  it("se réécrit sans en créer une seconde", async () => {
    const premiere = personSchema.parse(await (await ecrire(MOI)).json());
    const seconde = personSchema.parse(
      await (await ecrire({ ...MOI, displayName: "Awa D.", city: "Douala" })).json(),
    );

    expect(seconde.id).toBe(premiere.id);
    expect(seconde.displayName).toBe("Awa D.");
    expect(seconde.city).toBe("Douala");

    const combien = await db.prisma.person.count({ where: { userId, isSelf: true } });
    expect(combien).toBe(1);
  });

  /* DEUX ÉCRITURES SIMULTANÉES, et c'est une double frappe sur un téléphone,
     pas un cas de laboratoire. L'index unique partiel tranche ; le perdant doit
     repasser par la correction plutôt que rendre une erreur interne. */
  it("survit à deux enregistrements partis ensemble", async () => {
    const [a, b] = await Promise.all([ecrire(MOI), ecrire(MOI)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await db.prisma.person.count({ where: { userId, isSelf: true } })).toBe(1);
  });

  /* On n'est pas sa propre relation. Le contrat retire les deux champs, et
     `.strict()` le fait dire — sans quoi « ma sœur » atterrirait sur sa propre
     fiche et la génération écrirait à la troisième personne. */
  it("refuse une relation sur sa propre fiche", async () => {
    const res = await ecrire({ ...MOI, relation: "famille_proche" });
    expect(res.status).toBe(400);
  });

  it("reste cloisonnée : chacun la sienne", async () => {
    await ecrire(MOI);
    const autre = await compte();
    expect((await lire(autre.jeton)).status).toBe(404);

    await ecrire({ displayName: "Bila", gender: "male" }, autre.jeton);
    const sienne = personSchema.parse(await (await lire(autre.jeton)).json());
    expect(sienne.displayName).toBe("Bila");
    // La mienne n'a pas bougé : l'index n'est unique QUE par compte.
    expect(personSchema.parse(await (await lire()).json()).displayName).toBe("Awa");
  });

  /* LA PREUVE PAR CE QU'ELLE DÉBLOQUE, et c'est le motif du signalement : une
     liste de souhaits n'accepte de viser une occasion que si celle-ci pend à la
     fiche de soi. Sans fiche, aucune liste ne pouvait en viser une. */
  it("rend une occasion de soi visable par une liste de souhaits", async () => {
    // La surface est derrière son drapeau : ligne absente vaut éteint, et la
    // route répondrait 404 avant d'avoir regardé la moindre occasion.
    await db.prisma.featureFlag.upsert({
      where: { key: "wishlist.own" },
      create: { key: "wishlist.own", enabled: true },
      update: { enabled: true },
    });
    const moi = personSchema.parse(await (await ecrire(MOI)).json());

    const evenement = await db.prisma.event.create({
      data: { personId: moi.id, kind: "birthday", referenceDate: new Date("2027-03-12") },
    });
    const occurrence = await db.prisma.eventOccurrence.create({
      data: {
        eventId: evenement.id, userId,
        occurrenceDate: new Date("2027-03-12"), status: "upcoming",
      },
    });

    const liste = (occurrenceId: string) => fetch(`${baseUrl}/v1/me/wishlists`, {
      method: "POST",
      headers: { authorization: `Bearer ${jeton}`, "content-type": "application/json" },
      body: JSON.stringify({ name: "Mes trente-trois ans", occurrenceId }),
    });
    expect((await liste(occurrence.id)).status).toBeLessThan(300);

    /* ET LA MOITIÉ QUI PROUVE que c'est bien `isSelf` qui ouvre, et non le
       simple fait d'avoir une occasion : la même écriture sur l'anniversaire
       d'un PROCHE doit être refusée. Sans ce second appel, le cas resterait
       vert le jour où la garde disparaîtrait. */
    const proche = await db.prisma.person.create({
      data: { userId, displayName: "Karim", isSelf: false },
    });
    const sien = await db.prisma.event.create({
      data: { personId: proche.id, kind: "birthday", referenceDate: new Date("2027-06-01") },
    });
    const sienne = await db.prisma.eventOccurrence.create({
      data: {
        eventId: sien.id, userId,
        occurrenceDate: new Date("2027-06-01"), status: "upcoming",
      },
    });
    expect((await liste(sienne.id)).status).toBeGreaterThanOrEqual(400);
  });
  /* ─── §13.4 — LA CORRECTION D'UN SEUL CHAMP ─────────────────────────────────
   *
   * `PUT` est un remplacement : il exige `displayName`, donc un écran qui ne
   * veut changer que la langue devait lire la fiche entière pour la renvoyer.
   * Ce n'est pas théorique — c'est ce qui a fait RETIRER l'écriture de
   * `language` depuis le mobile plutôt que de risquer d'écraser le reste. */
  describe("se corrige champ par champ", () => {
    it("écrit un seul champ sans toucher aux autres", async () => {
      await ecrire(MOI);
      const res = await corriger({ language: "fr" });
      expect(res.status).toBe(200);

      const fiche = personSchema.parse(await res.json());
      expect(fiche.language).toBe("fr");
      // Ce que le PUT aurait exigé de renvoyer, et qu'on n'a pas renvoyé.
      expect(fiche.displayName).toBe("Awa");
      expect(fiche.birthDate).toBe("1994-03-12");
    });

    /* ELLE NE CRÉE PAS. Créer ici obligerait à inventer un `displayName` pour
       quelqu'un qui n'a envoyé qu'une langue — et l'écran ne saurait pas qu'il
       vient de nommer sa propre fiche « undefined ». */
    it("rend 404 quand la fiche n'existe pas encore", async () => {
      expect((await corriger({ language: "fr" })).status).toBe(404);
    });

    /* UN CORPS VIDE EST REFUSÉ. Un 200 sur un PATCH qui n'envoie rien
       apprendrait à l'écran que son enregistrement a marché. */
    it("refuse un corps vide", async () => {
      await ecrire(MOI);
      expect((await corriger({})).status).toBe(400);
    });

    it("refuse un champ que la fiche de soi n'a pas", async () => {
      await ecrire(MOI);
      // `relation` : on n'est pas sa propre relation, et le contrat le retire.
      expect((await corriger({ relation: "sister" })).status).toBe(400);
    });

    /* LE RECALAGE DE L'ANNIVERSAIRE PASSE PAR LÀ AUSSI. Corriger sa naissance
       sans lui laisserait l'échéance sur l'ancienne date jusqu'au jour dit — et
       c'est sa propre date, celle qu'on remarque le moins vite parce qu'on ne
       se la souhaite pas. */
    it("recale l'anniversaire quand la naissance change", async () => {
      await ecrire(MOI);
      const soi = await db.prisma.person.findFirstOrThrow({ where: { userId, isSelf: true } });
      await db.prisma.event.create({
        data: { personId: soi.id, kind: "birthday", referenceDate: new Date("2027-03-12") },
      });

      await corriger({ birthDate: "1994-07-20" });

      const anniversaire = await db.prisma.event.findFirstOrThrow({
        where: { personId: soi.id, kind: "birthday" },
      });
      expect(anniversaire.referenceDate.toISOString().slice(5, 10)).toBe("07-20");
    });
  });

  /* ─── §13.3 — DEDANS OU DEHORS DU CARNET ────────────────────────────────────
   *
   * Elle reste INCLUSE par défaut, et ce n'est pas de la timidité : « Pour qui »
   * ne listait que les proches, on ne pouvait donc pas inscrire sa propre date.
   * L'exclure d'office réinstallerait le blocage que la fiche a levé. */
  describe("dans le carnet", () => {
    const lu = async (requete: string): Promise<{ persons: { displayName: string }[]; total: number }> =>
      (await (await carnet(requete)).json()) as { persons: { displayName: string }[]; total: number };
    const noms = async (requete = ""): Promise<string[]> =>
      (await lu(requete)).persons.map((p) => p.displayName);
    const total = async (requete = ""): Promise<number> => (await lu(requete)).total;

    beforeEach(async () => {
      await ecrire(MOI);
      await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    });

    it("y paraît par défaut", async () => {
      expect(await noms()).toContain("Awa");
      expect(await total()).toBe(2);
    });

    it("en sort sur demande", async () => {
      expect(await noms("?includeSelf=false")).toEqual(["Karim"]);
    });

    /* LE TOTAL SUIT LE FILTRE. Un total qui compterait une fiche absente de la
       liste ferait afficher « Voir plus · 1 restant » sur une page complète, et
       personne ne comprendrait ce qui manque. */
    it("ne se compte plus dans le total quand elle en sort", async () => {
      expect(await total("?includeSelf=false")).toBe(1);
    });

    /* SEUL « false » EXCLUT, et le reste est REFUSÉ plutôt qu'interprété :
       `Boolean("false")` vaut vrai, et s'y fier aurait rendu le paramètre
       décoratif. Un `includeSelf=0` silencieusement ignoré est pire qu'un 400. */
    it("refuse une valeur qui n'est pas un booléen", async () => {
      expect((await carnet("?includeSelf=0")).status).toBe(400);
    });

    it("l'inclut quand on le demande explicitement", async () => {
      expect(await noms("?includeSelf=true")).toContain("Awa");
    });
  });
});
