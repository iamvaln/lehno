import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { PersonService } from "../src/me/person.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { randomBytes } from "node:crypto";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

describe("annuaire des proches", () => {
  let db: TestDb;
  let service: PersonService;
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
    service = new PersonService(new TenantRepository(db.prisma as never));
    awa = await compte();
    bila = await compte();
  });

  it("crée un proche et le rend avec son identifiant", async () => {
    const p = await service.create(awa, { displayName: "Valery", register: "amical" });
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.displayName).toBe("Valery");
    expect(p.register).toBe("amical");
    expect(p.isSelf).toBe(false);
  });

  // Le cloisonnement est la propriété qui compte le plus ici : l'annuaire d'un
  // compte ne doit jamais laisser voir celui d'un autre.
  it("ne montre que les proches du demandeur", async () => {
    await service.create(awa, { displayName: "Valery" });
    await service.create(bila, { displayName: "Celarine" });

    const vus = await service.list(awa);
    expect(vus.map((p) => p.displayName)).toEqual(["Valery"]);
  });

  // Le nom d'usage n'est pas unique : deux « Maman » sont deux personnes.
  it("accepte deux proches du même nom", async () => {
    await service.create(awa, { displayName: "Maman" });
    await service.create(awa, { displayName: "Maman" });
    expect(await service.list(awa)).toHaveLength(2);
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

    it("refuse un appel sans jeton", async () => {
      const r = await fetch(`${baseUrl}/v1/me/persons`);
      expect(r.status).toBe(401);
    });
  });
});
