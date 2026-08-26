import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PARAM_MAINTENANCE, PARAM_MAINTENANCE_RETRY } from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

// L'arrêt pour intervention. Le sujet est petit et les erreurs coûtent cher :
// se tromper de statut fait lire une fenêtre de deux heures comme une
// suppression, et se tromper d'exemption enferme l'équipe dehors.
describe("l'arrêt pour intervention", () => {
  const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
  const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
  const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let precedent: Record<string, string | undefined>;

  const poser = async (valeur: string, retry = "900"): Promise<void> => {
    for (const [key, value, valueType] of [
      [PARAM_MAINTENANCE, valeur, "boolean"],
      [PARAM_MAINTENANCE_RETRY, retry, "duration"],
    ] as const) {
      await db.prisma.systemParameter.upsert({
        where: { key },
        update: { value },
        create: { key, value, valueType },
      });
    }
  };

  beforeAll(async () => {
    db = await withDatabase();
    await resetDatabase(db.prisma);
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
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await db.close();
    for (const [cle, valeur] of Object.entries(precedent)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
  });

  // Rouvrir après chaque cas : un test qui laisse l'API fermée ferait échouer
  // le suivant pour une raison qui n'a rien à voir avec ce qu'il éprouve.
  afterEach(async () => { await poser("false"); });

  it("laisse tout passer quand l'interrupteur est éteint", async () => {
    await poser("false");
    const r = await fetch(`${baseUrl}/v1/public/config`);
    expect(r.status).toBe(200);
  });

  // Le défaut d'un interrupteur d'ARRÊT doit être « ça marche ». Une ligne
  // manquante, une valeur mal saisie : l'API reste ouverte. L'inverse
  // couperait le service au premier semis oublié.
  it("reste ouverte quand la valeur ne dit pas « true »", async () => {
    await poser("");
    expect((await fetch(`${baseUrl}/v1/public/config`)).status).toBe(200);
    await poser("oui");
    expect((await fetch(`${baseUrl}/v1/public/config`)).status).toBe(200);
  });

  it("rend 503 — et surtout pas 404 — quand l'arrêt est posé", async () => {
    await poser("true");
    const r = await fetch(`${baseUrl}/v1/public/config`);
    // LE point. 404 dirait « ça n'existe plus », et le contrat demande alors au
    // client de masquer la surface : un arrêt se lirait comme une suppression.
    expect(r.status).toBe(503);
    const corps = (await r.json()) as { code: string; details?: { retryAfterSeconds?: number } };
    expect(corps.code).toBe("maintenance");
    // Le délai vient du serveur. Si le client l'inventait, deux versions du
    // parc appliqueraient deux règles, et la nôtre ne compterait plus.
    expect(corps.details?.retryAfterSeconds).toBe(900);
  });

  it("annonce le délai réglé, pas une constante", async () => {
    await poser("true", "60");
    const r = await fetch(`${baseUrl}/v1/public/config`);
    const corps = (await r.json()) as { details?: { retryAfterSeconds?: number } };
    expect(corps.details?.retryAfterSeconds).toBe(60);
  });

  // Sans cette exemption, poser l'arrêt fermerait le chemin qui sert à le
  // lever. On se serait enfermé dehors, et il aurait fallu la base.
  it("laisse /admin ouvert — c'est par là qu'on rouvre", async () => {
    await poser("true");
    const r = await fetch(`${baseUrl}/v1/admin/parameters`);
    // 401 et non 503 : le garde d'arrêt a laissé passer, l'authentification
    // d'administration a fait son travail. C'est exactement ce qu'on veut.
    expect(r.status).toBe(401);
  });

  it("laisse /public/maintenance ouvert, pour savoir quand revenir", async () => {
    await poser("true", "120");
    const r = await fetch(`${baseUrl}/v1/public/maintenance`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ maintenance: true, retryAfterSeconds: 120 });
  });

  it("dit hors arrêt qu'il n'y a pas d'arrêt", async () => {
    await poser("false");
    const r = await fetch(`${baseUrl}/v1/public/maintenance`);
    expect(await r.json()).toEqual({ maintenance: false, retryAfterSeconds: null });
  });

  // Le garde ne doit pas se laisser tromper par ce qui RESSEMBLE à une
  // exemption. « /publicité », « /admin-truc » ne sont pas « /admin ».
  it("n'exempte pas un chemin qui commence par les mêmes lettres", async () => {
    await poser("true");
    for (const chemin of ["/v1/public/features", "/v1/me/persons"]) {
      expect((await fetch(`${baseUrl}${chemin}`)).status, chemin).toBe(503);
    }
  });
});
