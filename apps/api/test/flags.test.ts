import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { FlagsService } from "../src/flags/flags.service.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

describe("drapeaux de fonctionnalité", () => {
  let db: TestDb;
  let service: FlagsService;

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
    service = new FlagsService(db.prisma as never);
  });

  // Cas 1 : une ligne absente vaut éteint. C'est la même règle que le reste
  // du projet (pas de domaine configuré -> aucune origine CORS autorisée).
  it("une ligne absente vaut éteint", async () => {
    expect(await service.estActif("me.persons")).toBe(false);
  });

  // Cas 5 : la réconciliation insère les lignes manquantes mais ne touche
  // jamais une ligne existante — sinon un déploiement rallumerait ou
  // éteindrait ce qu'un humain avait réglé en administration.
  it("la réconciliation n'écrase pas un état existant", async () => {
    await db.prisma.featureFlag.create({ data: { key: "me.persons", enabled: true } });
    await service.reconcilier();
    expect(await service.estActif("me.persons")).toBe(true);
  });

  it("la réconciliation insère les lignes manquantes du registre, éteintes", async () => {
    await service.reconcilier();
    const lignes = await db.prisma.featureFlag.findMany();
    expect(lignes.map((l) => l.key).sort()).toEqual(["launch.live", "me.persons"]);
    expect(lignes.every((l) => l.enabled === false)).toBe(true);
  });

  describe("HTTP de bout en bout", () => {
    let app: INestApplication;
    let baseUrl: string;
    let previousEnv: {
      DATABASE_URL: string | undefined; OTP_PEPPER: string | undefined; JWT_SECRET: string | undefined;
      LEHNO_MAIL_CONSOLE: string | undefined;
    };

    beforeAll(async () => {
      previousEnv = {
        DATABASE_URL: process.env.DATABASE_URL,
        OTP_PEPPER: process.env.OTP_PEPPER,
        JWT_SECRET: process.env.JWT_SECRET,
        LEHNO_MAIL_CONSOLE: process.env.LEHNO_MAIL_CONSOLE,
      };
      process.env.DATABASE_URL = db.url;
      process.env.OTP_PEPPER = PEPPER;
      process.env.JWT_SECRET = SECRET;
      process.env.LEHNO_MAIL_CONSOLE = "1";

      app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
      app.setGlobalPrefix("v1");
      app.useGlobalFilters(new AppExceptionFilter());
      await app.listen(0);
      baseUrl = await app.getUrl();
    }, 120_000);

    afterAll(async () => {
      await app.close();
      if (previousEnv.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousEnv.DATABASE_URL;
      if (previousEnv.OTP_PEPPER === undefined) delete process.env.OTP_PEPPER;
      else process.env.OTP_PEPPER = previousEnv.OTP_PEPPER;
      if (previousEnv.JWT_SECRET === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousEnv.JWT_SECRET;
      if (previousEnv.LEHNO_MAIL_CONSOLE === undefined) delete process.env.LEHNO_MAIL_CONSOLE;
      else process.env.LEHNO_MAIL_CONSOLE = previousEnv.LEHNO_MAIL_CONSOLE;
    });

    const éteindre = () => db.prisma.featureFlag.upsert({
      where: { key: "me.persons" }, update: { enabled: false }, create: { key: "me.persons", enabled: false },
    });
    const allumer = () => db.prisma.featureFlag.upsert({
      where: { key: "me.persons" }, update: { enabled: true }, create: { key: "me.persons", enabled: true },
    });

    // Cas 2 : le garde rend 404 quand le drapeau est éteint, en HTTP réel,
    // avec un jeton VALABLE — seul moyen de prouver que ce n'est pas
    // l'authentification qui a répondu.
    it("rend 404 quand le drapeau est éteint, avec un jeton valable", async () => {
      await éteindre();
      const uid = await compte();
      const token = jwt.sign({ sub: uid }, SECRET, { algorithm: "HS256", expiresIn: 900 });
      const r = await fetch(`${baseUrl}/v1/me/persons`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(r.status).toBe(404);
    });

    // Cas 3 : même statut sans jeton du tout — la réponse ne doit pas
    // distinguer « éteinte » de « non authentifiée ».
    it("rend 404 quand le drapeau est éteint, sans jeton du tout", async () => {
      await éteindre();
      const r = await fetch(`${baseUrl}/v1/me/persons`);
      expect(r.status).toBe(404);
    });

    // Cas 4, pas optionnel : un garde qui refuse tout serait vert sur les
    // trois cas précédents. Drapeau allumé, la route répond normalement.
    it("drapeau allumé : la liste répond 200 et la création 201", async () => {
      await allumer();
      const uid = await compte();
      const token = jwt.sign({ sub: uid }, SECRET, { algorithm: "HS256", expiresIn: 900 });

      const liste = await fetch(`${baseUrl}/v1/me/persons`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(liste.status).toBe(200);

      const création = await fetch(`${baseUrl}/v1/me/persons`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: "Valery" }),
      });
      expect(création.status).toBe(201);
    });
  });
});
