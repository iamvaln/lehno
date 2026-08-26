import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { soldeApresAjustementSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("administration — l'ajustement manuel d'un solde", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let jetons: AdminTokenService;

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
    jetons = app.get(AdminTokenService);
  }, 180_000);

  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await app?.close(); await db.close(); });

  const session = async (role: "support" | "admin") => {
    const compte = await db.prisma.admin.create({ data: { email: `${role}@lehno.app`, role } });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { compte, entete: { authorization: `Bearer ${accessToken}` } };
  };

  const client = async (credits = 0) => {
    const u = await db.prisma.user.create({
      data: { email: "awa@exemple.cm", username: "awa", referralCode: "AWA1" },
    });
    if (credits > 0) {
      await db.prisma.creditTransaction.create({
        data: { userId: u.id, type: "grant", source: "signup_grant", amount: credits },
      });
    }
    return u.id;
  };

  const ajuster = (entete: Record<string, string>, id: string, corps: unknown) =>
    fetch(`${baseUrl}/v1/admin/users/${id}/credits`, {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });

  it("suit le contrat publié, au champ près", async () => {
    const { entete } = await session("admin");
    const id = await client();

    const corps = await (await ajuster(entete, id, { montant: 5, reason: "Geste commercial après incident" })).json();

    const valide = soldeApresAjustementSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  it("créditer écrit un ajustement, source admin", async () => {
    const { entete } = await session("admin");
    const id = await client();

    await ajuster(entete, id, { montant: 5, reason: "Geste commercial après incident" });

    const m = await db.prisma.creditTransaction.findFirstOrThrow();
    expect(m.type).toBe("adjustment");
    expect(m.source).toBe("admin_adjustment");
    expect(m.amount).toBe(5);
  });

  it("le motif se garde sur le mouvement, pas seulement au journal", async () => {
    const { entete } = await session("admin");
    const id = await client();

    await ajuster(entete, id, { montant: 5, reason: "Geste commercial après incident" });

    expect((await db.prisma.creditTransaction.findFirstOrThrow()).reason)
      .toBe("Geste commercial après incident");
  });

  it("le solde rendu est celui d'après", async () => {
    const { entete } = await session("admin");
    const id = await client(10);

    const corps = (await (await ajuster(entete, id, { montant: 5, reason: "Geste commercial après incident" })).json()) as {
      solde: number;
    };

    expect(corps.solde).toBe(15);
  });

  // Le montant est signé : reprendre, c'est un ajustement négatif. Un champ
  // « sens » séparé se désynchroniserait du signe au premier oubli.
  it("reprendre des crédits est un ajustement négatif", async () => {
    const { entete } = await session("admin");
    const id = await client(10);

    const corps = (await (await ajuster(entete, id, { montant: -4, reason: "Correction d'un octroi en double" })).json()) as {
      solde: number;
    };

    expect(corps.solde).toBe(6);
    expect((await db.prisma.creditTransaction.findFirstOrThrow({ where: { type: "adjustment" } })).amount).toBe(-4);
  });

  // Un solde négatif signifierait qu'une action payante s'est lancée sans
  // provision : c'est un défaut, pas un état à écrire.
  it("un ajustement ne peut pas rendre le solde négatif", async () => {
    const { entete } = await session("admin");
    const id = await client(3);

    const res = await ajuster(entete, id, { montant: -10, reason: "Correction d'un octroi en double" });

    expect(res.status).toBe(422);
    expect(await db.prisma.creditTransaction.count({ where: { type: "adjustment" } })).toBe(0);
  });

  // Deux reprises qui, ensemble, dépassent le solde.
  //
  // **Ce test ne prouve pas le verrou.** Il passe avec et sans, vérifié par
  // mutation : sous ce banc d'essai, les deux requêtes ne se chevauchent pas
  // assez pour produire la course. Il décrit l'issue attendue, pas le mécanisme
  // qui l'obtient.
  //
  // Le verrou consultatif reste, parce que le danger est réel : sous
  // READ COMMITTED, deux transactions liraient le même solde avant qu'aucune
  // n'écrive, et le compte finirait négatif. Aucune contrainte de base ne peut
  // s'y substituer — « la somme des mouvements reste positive » n'est pas
  // exprimable en CHECK. C'est le même motif que le plafond d'appareil, pour le
  // même genre de danger.
  it("deux reprises concurrentes ne creusent pas le solde", async () => {
    const { entete } = await session("admin");
    const id = await client(10);

    const [a, b] = await Promise.all([
      ajuster(entete, id, { montant: -8, reason: "Correction d'un octroi en double" }),
      ajuster(entete, id, { montant: -8, reason: "Correction d'un second octroi" }),
    ]);

    // L'une passe, l'autre est refusée faute de provision.
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    const somme = await db.prisma.creditTransaction.aggregate({ where: { userId: id }, _sum: { amount: true } });
    expect(somme._sum.amount).toBe(2);
  });

  it("reprendre exactement le solde est permis", async () => {
    const { entete } = await session("admin");
    const id = await client(3);

    const corps = (await (await ajuster(entete, id, { montant: -3, reason: "Correction d'un octroi en double" })).json()) as {
      solde: number;
    };

    expect(corps.solde).toBe(0);
  });

  it("un ajustement de zéro ne dit rien, et est refusé", async () => {
    const { entete } = await session("admin");
    const id = await client(10);

    expect((await ajuster(entete, id, { montant: 0, reason: "Un ajustement sans effet" })).status).toBe(400);
  });

  it("un motif trop court est refusé, et rien n'est écrit", async () => {
    const { entete } = await session("admin");
    const id = await client();

    const res = await ajuster(entete, id, { montant: 5, reason: "court" });

    expect(res.status).toBe(400);
    expect(await db.prisma.creditTransaction.count()).toBe(0);
  });

  it("l'ajustement rejoint le journal d'audit", async () => {
    const { compte, entete } = await session("admin");
    const id = await client();

    await ajuster(entete, id, { montant: 5, reason: "Geste commercial après incident" });

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "credit_adjustment" } });
    expect(trace.actorId).toBe(compte.id);
    expect(trace.targetId).toBe(id);
  });

  it("un compte inconnu rend 404", async () => {
    const { entete } = await session("admin");

    const res = await ajuster(entete, "00000000-0000-0000-0000-000000000000", {
      montant: 5, reason: "Geste commercial après incident",
    });

    expect(res.status).toBe(404);
  });

  // « Ajuster manuellement un solde de crédits » figure parmi ce que le support
  // ne fait pas (ux-admin §6).
  it("le support n'ajuste pas", async () => {
    const { entete } = await session("support");
    const id = await client();

    const res = await ajuster(entete, id, { montant: 5, reason: "Geste commercial après incident" });

    expect(res.status).toBe(403);
    expect(await db.prisma.creditTransaction.count()).toBe(0);
  });
});
