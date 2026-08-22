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
