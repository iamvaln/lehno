import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { TokenService } from "../src/auth/token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/* Revenir sur une suppression.
 *
 * C'est ce qui donne un sens au délai de grâce. Sans cette route, il ne
 * protégeait que de NOTRE lenteur : la personne qui changeait d'avis ne pouvait
 * pas se connecter, et seul un administrateur pouvait la rétablir. */
describe("annuler sa suppression", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let jetons: TokenService;

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
    jetons = new TokenService(db.prisma as never, SECRET);
  }, 180_000);

  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await app?.close(); await db.close(); });

  const compte = async (status: "active" | "pending_deletion" | "suspended") => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
        status,
        ...(status === "pending_deletion" ? { deletionRequestedAt: new Date() } : {}),
      },
      select: { id: true },
    });
    const { accessToken } = await jetons.issuePair(u.id, "test", "127.0.0.1");
    return { id: u.id, entete: { authorization: `Bearer ${accessToken}` } };
  };

  const annuler = (entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/me/account/cancel-deletion`, { method: "POST", headers: entete });

  it("rétablit un compte en suppression", async () => {
    const c = await compte("pending_deletion");
    const res = await annuler(c.entete);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "active", refundCancelled: false });

    const apres = await db.prisma.user.findUniqueOrThrow({ where: { id: c.id } });
    expect(apres.status).toBe("active");
    expect(apres.deletionRequestedAt).toBeNull();
  });

  /* LA PIÈCE EST VIDE. Un compte en suppression ouvre une session, et cette
     session n'ouvre qu'une porte. Sans ce cas, marquer une route ouverte par
     inadvertance ne se verrait nulle part. */
  it("ne laisse rien d'autre ouvert à un compte en suppression", async () => {
    const c = await compte("pending_deletion");
    for (const chemin of ["me/home", "me/persons", "me/notifications", "me/credits"]) {
      const res = await fetch(`${baseUrl}/v1/${chemin}`, { headers: c.entete });
      expect(res.status, chemin).toBe(403);
    }
  });

  // Un compte suspendu, lui, n'a rien à faire dans l'application : il n'entre
  // pas, et l'annulation ne lui est pas ouverte non plus.
  it("n'ouvre pas la porte à un compte suspendu", async () => {
    const c = await compte("suspended");
    expect((await annuler(c.entete)).status).toBe(403);
  });

  /* 404 plutôt qu'un succès silencieux : un écran qui affiche « votre compte
     est rétabli » sur un compte qui ne partait pas ment à quelqu'un qui ne
     peut plus le vérifier. */
  it("refuse d'annuler ce qui n'a pas été demandé", async () => {
    const c = await compte("active");
    expect((await annuler(c.entete)).status).toBe(404);
  });

  /* Le remboursement en attente tombe avec la suppression. Le verser plus tard
     reviendrait à reprendre des crédits à quelqu'un qui peut encore les
     dépenser — et l'administrateur n'aurait aucun moyen de savoir que le compte
     est revenu. */
  it("annule le remboursement en attente", async () => {
    const c = await compte("pending_deletion");
    await db.prisma.payment.create({
      data: {
        userId: c.id, direction: "refund", mode: "manual", status: "pending",
        amount: 1000, currency: "XAF", credits: 10,
      },
    });

    const res = await annuler(c.entete);
    expect(await res.json()).toMatchObject({ refundCancelled: true });

    const p = await db.prisma.payment.findFirstOrThrow({ where: { userId: c.id } });
    expect(p.status).toBe("failed");
    expect(p.failureReason).toBe("deletion_cancelled");
  });

  // Deux appels simultanés, ou un appel après le passage de l'ordonnanceur :
  // le second ne trouve plus la ligne dans l'état attendu et ne rétablit rien.
  it("est idempotente : le second appel ne rétablit rien", async () => {
    const c = await compte("pending_deletion");
    expect((await annuler(c.entete)).status).toBe(200);
    expect((await annuler(c.entete)).status).toBe(404);
  });
});
