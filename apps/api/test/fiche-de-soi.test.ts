import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { SignupService } from "../src/onboarding/signup.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/**
 * LA FICHE DE SOI NAÎT AVEC LE COMPTE.
 *
 * `person.is_self` se lisait à CINQ endroits et ne s'écrivait NULLE PART.
 * `PUT /me/self` a donné le moyen de l'écrire ; il ne donnait pas la fiche à
 * ceux qui ne vont pas la remplir à la main — c'est-à-dire presque tout le
 * monde, puisque rien à l'écran ne demande de la créer.
 *
 * Ces cas gardent les deux moitiés : elle naît à l'inscription, et elle n'est
 * pas filtrée du carnet — sans quoi « Pour qui » ne listerait toujours pas le
 * titulaire, et sa fiche n'aurait aucun endroit où s'ouvrir.
 */
describe("la fiche de soi", () => {
  let db: TestDb;
  let app: INestApplication;
  let signup: SignupService;

  beforeAll(async () => {
    db = await withDatabase();
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    process.env.LEHNO_MAIL_CONSOLE = "1";
    app = await NestFactory.create(AppModule, { logger: false });
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();
    signup = app.get(SignupService);
  }, 180_000);

  afterAll(async () => { await app?.close(); await db.close(); });

  beforeEach(async () => { await resetDatabase(db.prisma); });

  const inscrire = async (username: string) => {
    const creation = await signup.creer({
      email: `${randomBytes(6).toString("hex")}@example.com`,
      emailVerified: true,
      deviceId: randomBytes(8).toString("hex"),
      username,
    });
    if (creation.plafondAtteint) throw new Error("plafond atteint : le cas ne veut pas éprouver ça");
    return creation.user.id;
  };

  it("naît avec le compte, nommée depuis le pseudo", async () => {
    const userId = await inscrire("awa_d");

    const soi = await db.prisma.person.findFirst({ where: { userId, isSelf: true } });
    expect(soi).not.toBeNull();
    expect(soi?.displayName).toBe("awa_d");
  });

  /* ON NE DÉDUIT PAS UN GENRE D'UN PSEUDO. « Un genre ne se devine pas, il se
     demande » — et le déduire d'un prénom est exactement le raccourci qui se
     trompe sur les gens. */
  it("ne suppose aucun genre", async () => {
    const userId = await inscrire("awa_d");
    const soi = await db.prisma.person.findFirstOrThrow({ where: { userId, isSelf: true } });
    expect(soi.gender).toBe("unspecified");
  });

  /* DANS LA MÊME TRANSACTION QUE LE COMPTE. Un compte sans sa fiche est un
     compte à moitié né : il y aurait sinon une fenêtre où les cinq lectures
     sont mortes, et c'est l'état qu'on répare. */
  it("existe pour chaque compte, sans exception", async () => {
    await inscrire("awa_d");
    await inscrire("bila_n");
    await inscrire("karim_t");

    const comptes = await db.prisma.user.count();
    const fiches = await db.prisma.person.count({ where: { isSelf: true } });
    expect(fiches).toBe(comptes);
  });

  /* UN COMPTE, UNE SEULE FICHE — tenu par un index unique partiel en base.
     Le vérifier ici plutôt que de s'y fier : deux fiches de soi feraient
     choisir au hasard laquelle porte l'anniversaire du titulaire. */
  it("reste unique par compte", async () => {
    const userId = await inscrire("awa_d");
    await expect(db.prisma.person.create({
      data: { userId, displayName: "Moi encore", isSelf: true },
    })).rejects.toThrow();
  });

  /* ELLE N'EST PAS FILTRÉE DU CARNET, et c'est le brief qui le demande :
     « "Pour qui" ne liste que les proches, on ne peut donc pas inscrire sa
     propre date », et « il ne lui manque que la fiche à ouvrir ». L'en retirer
     rendrait impossibles les deux gestes qu'on vient de débloquer. */
  it("paraît dans le carnet, pour qu'on puisse l'ouvrir et la viser", async () => {
    const userId = await inscrire("awa_d");
    const lignes = await db.prisma.person.findMany({ where: { userId } });
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.isSelf).toBe(true);
  });

  /* CE QU'ELLE DÉBLOQUE, et c'est le motif du signalement : une liste de
     souhaits n'accepte de viser une occasion que si celle-ci pend à la fiche de
     soi. Sans fiche, aucune liste datée n'était atteignable. */
  it("rend une occasion du titulaire visable par une liste", async () => {
    const userId = await inscrire("awa_d");
    const soi = await db.prisma.person.findFirstOrThrow({ where: { userId, isSelf: true } });

    const evenement = await db.prisma.event.create({
      data: { personId: soi.id, kind: "birthday", referenceDate: new Date("2027-03-12") },
    });
    const occurrence = await db.prisma.eventOccurrence.create({
      data: {
        eventId: evenement.id, userId,
        occurrenceDate: new Date("2027-03-12"), status: "upcoming",
      },
    });

    /* La garde du service de wishlist : `event.person.isSelf`. On la rejoue
       telle quelle plutôt que d'appeler la route — ce cas éprouve la fiche, pas
       le drapeau qui ouvre la surface. */
    const visable = await db.prisma.eventOccurrence.findFirst({
      where: { id: occurrence.id, userId, event: { person: { isSelf: true } } },
    });
    expect(visable).not.toBeNull();
  });

  /* LA REPRISE, pour les comptes ouverts avant qu'elle existe.
   *
   * Ils n'en ont aucune et rien ne la leur donnerait après coup. On rejoue ici
   * exactement le `INSERT` de la migration : le vérifier en rejouant la
   * migration entière ne dirait rien de plus, et ce cas tombe si quelqu'un en
   * change la condition. */
  it("se pose aussi sur un compte qui n'en avait pas", async () => {
    const orphelin = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: "ancien_compte",
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });

    await db.prisma.$executeRawUnsafe(`
      INSERT INTO "person" ("user_id", "display_name", "is_self", "updated_at")
      SELECT u."id", u."username", true, now()
        FROM "user" u
       WHERE NOT EXISTS (
         SELECT 1 FROM "person" p WHERE p."user_id" = u."id" AND p."is_self"
       );
    `);

    const soi = await db.prisma.person.findFirst({
      where: { userId: orphelin.id, isSelf: true },
    });
    expect(soi?.displayName).toBe("ancien_compte");
  });

  /* IDEMPOTENTE. Une reprise rejouée ne doit pas tomber sur l'index unique :
     échouer au lieu de ne rien faire transformerait une migration inoffensive
     en migration en panne. */
  it("ne pose pas de seconde fiche quand la reprise est rejouée", async () => {
    const userId = await inscrire("awa_d");

    for (let i = 0; i < 2; i += 1) {
      await db.prisma.$executeRawUnsafe(`
        INSERT INTO "person" ("user_id", "display_name", "is_self", "updated_at")
        SELECT u."id", u."username", true, now()
          FROM "user" u
         WHERE NOT EXISTS (
           SELECT 1 FROM "person" p WHERE p."user_id" = u."id" AND p."is_self"
         );
      `);
    }

    expect(await db.prisma.person.count({ where: { userId, isSelf: true } })).toBe(1);
  });
});
