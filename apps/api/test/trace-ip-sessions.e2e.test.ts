import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { TokenService } from "../src/auth/token.service.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/**
 * L'adresse sur les jetons de session.
 *
 * Le dictionnaire la prévoit pour `RefreshToken` — « Investigation » — et la
 * colonne existe en base depuis la migration d'identité. Elle n'était pas
 * modélisée, donc jamais écrite : même défaut que `login_activity.ip` et
 * `device_signup.ip`, réparés la veille.
 *
 * Ce qu'elle apporte que la lignée n'apporte pas : rejouer un jeton consommé
 * révoque toute la lignée, et c'est le signe qu'une copie circule. Mais ça ne
 * dit pas **d'où** — et sans l'adresse, on ne peut ni dater ni situer le vol.
 */
describe("les jetons de session portent leur adresse", () => {
  let db: TestDb;
  let app: INestApplication;
  let jetons: TokenService;
  let jetonsAdmin: AdminTokenService;

  beforeAll(async () => {
    db = await withDatabase();
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    process.env.LEHNO_MAIL_CONSOLE = "1";
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    jetons = app.get(TokenService);
    jetonsAdmin = app.get(AdminTokenService);
  }, 180_000);

  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await app?.close(); await db.close(); });

  const client = async () => (await db.prisma.user.create({
    data: { email: "awa@exemple.cm", username: "awa", referralCode: "AWA1" },
  })).id;

  const administrateur = async () => (await db.prisma.admin.create({
    data: { email: "sam@lehno.app", role: "admin" },
  })).id;

  it("l'ouverture d'une session note son adresse", async () => {
    const id = await client();

    await jetons.issuePair(id, "Chrome — macOS", "102.244.18.7");

    expect((await db.prisma.refreshToken.findFirstOrThrow()).ip).toBe("102.244.18.7");
  });

  // Un jeton volé et rejoué depuis ailleurs : la lignée tombe, mais sans
  // l'adresse de chaque tour on ne sait pas d'où venait la copie.
  it("chaque rotation note l'adresse d'où elle vient", async () => {
    const id = await client();
    const paire = await jetons.issuePair(id, "Chrome — macOS", "102.244.18.7");

    await jetons.rotate(paire.refreshToken, "Chrome — macOS", "41.202.219.9");

    const enfant = await db.prisma.refreshToken.findFirstOrThrow({ where: { parentId: { not: null } } });
    expect(enfant.ip).toBe("41.202.219.9");
  });

  it("une adresse absente n'empêche rien", async () => {
    const id = await client();

    await expect(jetons.issuePair(id, "Chrome — macOS")).resolves.toBeDefined();

    expect((await db.prisma.refreshToken.findFirstOrThrow()).ip).toBeNull();
  });

  // Une session d'exploitation ouvre sur les comptes des autres. Elle dure
  // moins longtemps pour cette raison — et devrait au moins tracer autant
  // qu'une session ordinaire.
  it("une session d'administration note aussi son adresse", async () => {
    const id = await administrateur();

    await jetonsAdmin.ouvrir(id, "Chrome — macOS", "102.244.18.7");

    expect((await db.prisma.adminRefreshToken.findFirstOrThrow()).ip).toBe("102.244.18.7");
  });

  it("la rotation d'une session d'administration note la sienne", async () => {
    const id = await administrateur();
    const paire = await jetonsAdmin.ouvrir(id, "Chrome — macOS", "102.244.18.7");

    await jetonsAdmin.tourner(paire.refreshToken, "Chrome — macOS", "41.202.219.9");

    const enfant = await db.prisma.adminRefreshToken.findFirstOrThrow({ where: { parentId: { not: null } } });
    expect(enfant.ip).toBe("41.202.219.9");
  });

  // La garde : l'adresse sert aux investigations, pas à l'affichage courant.
  // Aucun chemin de lecture ne doit la rendre.
  it("l'adresse ne sort par aucun contrat publié", async () => {
    const contrat = JSON.stringify(
      (await import("@lehno/contracts")) as unknown as Record<string, unknown>,
    );

    // Aucun schéma de session, de connexion ou de profil n'a de champ « ip ».
    expect(contrat).not.toMatch(/"ip"/);
  });
});

/**
 * Le chemin complet : de la requête HTTP jusqu'à la ligne en base.
 *
 * Les tests ci-dessus appellent les services directement — ils prouvent que
 * l'adresse est écrite si on la donne. Ceux-ci prouvent qu'elle est **donnée**,
 * ce qui est un défaut distinct : une colonne correctement écrite par un
 * service que personne n'alimente reste vide, et c'est exactement l'histoire de
 * ces trois colonnes.
 */
describe("l'adresse remonte des points d'entrée", () => {
  let db2: TestDb;
  let app2: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    db2 = await withDatabase();
    process.env.DATABASE_URL = db2.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    process.env.LEHNO_MAIL_CONSOLE = "1";
    app2 = await NestFactory.create(AppModule, { logger: false });
    app2.setGlobalPrefix("v1");
    await app2.listen(0);
    baseUrl = await app2.getUrl();
  }, 180_000);

  beforeEach(async () => { await resetDatabase(db2.prisma); });
  afterAll(async () => { await app2?.close(); await db2.close(); });

  it("une rotation de session d'administration écrit l'adresse de la requête", async () => {
    const compte = await db2.prisma.admin.create({ data: { email: "sam@lehno.app", role: "admin" } });
    const paire = await app2.get(AdminTokenService).ouvrir(compte.id, "Chrome");

    const res = await fetch(`${baseUrl}/v1/admin/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: paire.refreshToken }),
    });

    expect(res.status).toBe(200);
    const enfant = await db2.prisma.adminRefreshToken.findFirstOrThrow({ where: { parentId: { not: null } } });
    // En local, la requête vient de la boucle locale : ce qui compte est
    // qu'une adresse soit écrite, pas laquelle.
    expect(enfant.ip).not.toBeNull();
  });
});
