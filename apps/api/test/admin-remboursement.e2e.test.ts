import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/* Le versement d'un remboursement.
 *
 * Le miroir de la saisie d'un paiement entrant, en sens inverse. Ce qui est
 * éprouvé ici n'est pas « le statut change » — c'est que les CRÉDITS partent
 * avec l'argent, et une seule fois. */
describe("administration — verser un remboursement", () => {
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
    return { authorization: `Bearer ${accessToken}` };
  };

  const demande = async (direction: "refund" | "charge" = "refund") => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
        status: "pending_deletion", deletionRequestedAt: new Date(),
      },
      select: { id: true },
    });
    await db.prisma.creditTransaction.create({
      data: { userId: u.id, type: "purchase", source: "purchase", amount: 10 },
    });
    /* Un versement manuel ENTRANT doit dire sur quel compte il est arrivé —
       `payment_voie_manuelle_a_un_compte`. La contrainte ne vaut pas pour les
       sortants, et c'est cohérent : un remboursement part vers une méthode
       enregistrée, pas vers un compte de collecte. */
    const compteCollecte = direction === "charge"
      ? await db.prisma.collectionAccount.create({
        data: { label: "Principal", operator: "mtn", number: "670000000" },
        select: { id: true },
      })
      : null;
    const p = await db.prisma.payment.create({
      data: {
        userId: u.id, direction, mode: "manual", status: "pending",
        amount: 1000, currency: "XAF", credits: 10,
        ...(compteCollecte ? { collectionAccountId: compteCollecte.id } : {}),
      },
      select: { id: true },
    });
    return { userId: u.id, paiementId: p.id };
  };

  const verser = (entete: Record<string, string>, id: string, corps: unknown) =>
    fetch(`${baseUrl}/v1/admin/payments/${id}/refund`, {
      method: "POST", headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });

  const CORPS = {
    reference: "MP-123456", reason: "Versé depuis le compte principal",
    reasonCode: "paid_by_mobile_money",
  };

  const solde = async (userId: string) => {
    const m = await db.prisma.creditTransaction.aggregate({
      where: { userId }, _sum: { amount: true },
    });
    return m._sum.amount ?? 0;
  };

  it("verse, et reprend les crédits en même temps", async () => {
    const entete = await session("admin");
    const d = await demande();
    expect(await solde(d.userId)).toBe(10);

    const res = await verser(entete, d.paiementId, CORPS);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ etat: "succeeded", creditsRepris: 10 });

    expect(await solde(d.userId)).toBe(0);
    const p = await db.prisma.payment.findUniqueOrThrow({ where: { id: d.paiementId } });
    expect(p.status).toBe("succeeded");
    expect(p.providerRef).toBe("MP-123456");
  });

  /* LA garde : deux administrateurs qui règlent la même demande ne la règlent
     qu'une fois. Sans l'état attendu dans le `where`, les crédits partiraient
     deux fois — et le compte finirait débiteur. */
  it("ne reprend pas les crédits deux fois", async () => {
    const entete = await session("admin");
    const d = await demande();
    expect((await verser(entete, d.paiementId, CORPS)).status).toBe(200);
    expect((await verser(entete, d.paiementId, CORPS)).status).toBe(409);
    expect(await solde(d.userId)).toBe(0);
  });

  /* Le geste des paiements entrants octroierait des crédits sur un
     remboursement — `amount` positif, en `source: purchase`. On rendrait
     l'argent ET on laisserait les crédits. */
  it("refuse un remboursement par le geste des paiements entrants", async () => {
    const entete = await session("admin");
    const d = await demande();
    const res = await fetch(`${baseUrl}/v1/admin/payments/${d.paiementId}/decision`, {
      method: "POST", headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({
        decision: "confirmer", montantRecu: 1000, reference: "X",
        reason: "Réception constatée", reasonCode: "operation_seen_at_the_operator",
      }),
    });
    expect(res.status).toBe(409);
    expect(await solde(d.userId)).toBe(10);
  });

  it("refuse le geste du remboursement sur un paiement entrant", async () => {
    const entete = await session("admin");
    const d = await demande("charge");
    expect((await verser(entete, d.paiementId, CORPS)).status).toBe(409);
  });

  // Renoncer laisse les crédits en place : rien n'est sorti.
  it("renoncer ne reprend aucun crédit, et libère l'effacement", async () => {
    const entete = await session("admin");
    const d = await demande();
    const res = await fetch(`${baseUrl}/v1/admin/payments/${d.paiementId}/refund-abandon`, {
      method: "POST", headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({ reason: "Le numéro est fermé", reasonCode: "the_holder_waived_it" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ etat: "failed", creditsRepris: 0 });
    expect(await solde(d.userId)).toBe(10);
  });

  // Verser de l'argent est une décision d'administration, pas d'assistance.
  it("le support ne verse pas", async () => {
    const entete = await session("support");
    const d = await demande();
    expect((await verser(entete, d.paiementId, CORPS)).status).toBe(403);
  });

  it("exige un code de motif, comme le kit en propose", async () => {
    const entete = await session("admin");
    const d = await demande();
    const res = await verser(entete, d.paiementId, {
      reference: "MP-1", reason: "Versé depuis le compte principal",
    });
    expect(res.status).toBe(422);
  });
});
