import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { OtpService } from "../src/auth/otp.service.js";
import { AppError } from "../src/common/errors.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";

describe("code à usage unique", () => {
  let db: TestDb;
  let otp: OtpService;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    otp = new OtpService(db.prisma as never, PEPPER);
  });

  it("émet six chiffres", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    expect(code).toMatch(/^\d{6}$/);
  });

  it("ne conserve jamais le code en clair", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const row = await db.prisma.otpCode.findFirstOrThrow();
    expect(row.codeHash).not.toContain(code);
    expect(row.codeHash).toMatch(/^v1\$/);
  });

  it("un condensé sans la clé ne permet pas de retrouver le code", () => {
    const autre = new OtpService(db.prisma as never, "dW5lLWF1dHJlLWNsZS1lbnRpZXJlbWVudC1kaWZmZXJlbnRl");
    expect(otp.hash("123456")).not.toBe(autre.hash("123456"));
  });

  it("accepte le bon code une seule fois", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    await expect(otp.verify("awa@example.com", "login", code)).resolves.toEqual({ userId: null });
    await expect(otp.verify("awa@example.com", "login", code)).rejects.toThrow(AppError);
  });

  it("plusieurs vérifications concurrentes avec le bon code : une seule réussit", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    // Une seule connexion Prisma ne suffit pas à faire apparaître la course de
    // façon fiable : la première requête sur une connexion neuve absorbe un
    // aller-retour TCP/authentification qui, à lui seul, laisse le temps à une
    // connexion déjà chaude de finir sa lecture-décision-écriture avant que la
    // suivante n'ait seulement lu l'état. On instancie donc N connexions
    // indépendantes, on les chauffe toutes (`select 1`), puis on les lance en
    // même temps sur le même code — constaté : 0 échec sur 6 essais avec deux
    // appels sur la même connexion, contre une majorité de succès multiples
    // dès qu'on chauffe des connexions séparées.
    const N = 4;
    const clients = Array.from({ length: N }, () => new PrismaClient({ datasources: { db: { url: db.url } } }));
    const services = clients.map((c) => new OtpService(c as never, PEPPER));
    try {
      await Promise.all(clients.map((c) => c.$queryRaw`select 1`));
      const results = await Promise.allSettled(services.map((s) => s.verify("awa@example.com", "login", code)));
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(N - 1);
    } finally {
      await Promise.all(clients.map((c) => c.$disconnect()));
    }
  });

  it("un bon code face à une rafale de mauvais qui atteint le plafond avant lui : la consommation échoue", async () => {
    // Reproduit précisément le scénario décrit en revue : le bon code lit un
    // compteur encore sous le plafond (attempts = 0) et passe la garde, mais
    // son écriture de consommation n'arrive qu'après qu'une rafale de mauvais
    // essais concurrents a fait grimper le compteur au plafond.
    //
    // Un tir groupé nu ne suffit pas ici, et un verrou de ligne tenu puis
    // relâché non plus : ni l'un ni l'autre ne garantit dans quel ordre
    // Postgres traite des écritures concurrentes venues de connexions
    // différentes sur la même ligne — constaté empiriquement : une file
    // construite via un verrou tenu ne respecte pas un ordre d'arrivée
    // fiable entre appelants (plusieurs échecs sur plusieurs relances). On
    // force donc l'ordre au niveau applicatif plutôt qu'au niveau du verrou :
    // le client du bon code retarde délibérément SA SEULE écriture de
    // consommation, via une extension Prisma qui n'intercepte que ses
    // propres updateMany sur otpCode. Sa lecture, elle, n'est pas retardée :
    // elle voit toujours attempts = 0 et passe la garde normalement. La
    // rafale de mauvais essais, sur des connexions non retardées, a tout le
    // temps de s'écrire et de faire grimper le compteur au plafond avant que
    // l'écriture (retardée) du bon code ne s'exécute à son tour.
    const MAX_ATTEMPTS = 5; // miroir de la constante privée du service
    const { code } = await otp.issue("awa@example.com", "login");

    const rawGoodClient = new PrismaClient({ datasources: { db: { url: db.url } } });
    const goodClient = rawGoodClient.$extends({
      query: {
        otpCode: {
          async updateMany({ args, query }) {
            await new Promise((r) => setTimeout(r, 300));
            return query(args);
          },
        },
      },
    });
    const badClients = Array.from(
      { length: MAX_ATTEMPTS },
      () => new PrismaClient({ datasources: { db: { url: db.url } } }),
    );
    const goodService = new OtpService(goodClient as never, PEPPER);
    const badServices = badClients.map((c) => new OtpService(c as never, PEPPER));
    const allRawClients = [rawGoodClient, ...badClients];

    try {
      await Promise.all(allRawClients.map((c) => c.$queryRaw`select 1`));

      const goodPromise = goodService.verify("awa@example.com", "login", code);
      // Laisse la lecture (non retardée) du bon code se faire avant que la
      // rafale de mauvais essais ne démarre — elle voit attempts = 0.
      await new Promise((r) => setTimeout(r, 20));
      const badPromises = badServices.map((s) => s.verify("awa@example.com", "login", "000000"));

      const [goodResult] = await Promise.allSettled([goodPromise, ...badPromises]);

      const row = await db.prisma.otpCode.findFirstOrThrow();
      expect(row.attempts).toBeGreaterThanOrEqual(MAX_ATTEMPTS);
      // Le plafond a été franchi avant que la consommation (retardée) du bon
      // code ne s'exécute : elle doit échouer, pas laisser passer un code
      // déjà brûlé.
      expect(goodResult.status).toBe("rejected");
      if (goodResult.status === "rejected") {
        expect(goodResult.reason).toMatchObject({ code: "otp_too_many_attempts" });
      }
    } finally {
      await Promise.all(allRawClients.map((c) => c.$disconnect()));
    }
  });

  it("refuse un code expiré", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    // On antidate la ligne plutôt que de déplacer l'horloge : de faux
    // horodateurs perturberaient les minuteries du pilote PostgreSQL,
    // que ce test utilise réellement.
    await db.prisma.otpCode.updateMany({
      where: { targetEmail: "awa@example.com" },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(otp.verify("awa@example.com", "login", code)).rejects.toMatchObject({ code: "otp_expired" });
  });

  it("brûle le code au cinquième essai raté", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    for (let i = 0; i < 5; i++)
      await expect(otp.verify("awa@example.com", "login", "000000")).rejects.toThrow(AppError);
    // même le bon code ne passe plus
    await expect(otp.verify("awa@example.com", "login", code))
      .rejects.toMatchObject({ code: "otp_too_many_attempts" });
  });

  it("une nouvelle demande invalide la précédente", async () => {
    const first = await otp.issue("awa@example.com", "login");
    await otp.issue("awa@example.com", "login");
    await expect(otp.verify("awa@example.com", "login", first.code)).rejects.toThrow(AppError);
  });
});
