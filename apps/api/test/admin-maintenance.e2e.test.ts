import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  PARAM_MAINTENANCE, PARAM_MAINTENANCE_UNTIL, type MaintenanceStatus,
} from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";
const MOTIF = "Migration de la base de production";

/**
 * Déclencher, prolonger et lever un arrêt depuis le back-office.
 *
 * Le mécanisme existait — garde, état public, paramètres semés — mais rien ne
 * permettait de l'actionner : il fallait écrire `true` et une date ISO à la
 * main dans l'écran générique des paramètres. Un interrupteur d'urgence qui
 * demande de composer une date au format ISO n'est pas un interrupteur.
 */
describe("administration — l'arrêt pour intervention", () => {
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

  // Rouvrir après chaque cas : un test qui laisse l'API fermée ferait échouer
  // le suivant pour une raison qui n'a rien à voir avec ce qu'il éprouve.
  afterEach(async () => {
    await db.prisma.systemParameter.updateMany({
      where: { key: PARAM_MAINTENANCE }, data: { value: "false" },
    });
  });

  afterAll(async () => { await app?.close(); await db.close(); });

  const session = async (role: "support" | "admin") => {
    await resetDatabase(db.prisma);
    const compte = await db.prisma.admin.create({ data: { email: `${role}@lehno.app`, role } });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { compte, entete: { authorization: `Bearer ${accessToken}` } };
  };

  const arret = (): string => `${baseUrl}/v1/admin/maintenance`;

  const lire = (entete: Record<string, string>) =>
    fetch(arret(), { headers: entete });

  const declencher = (entete: Record<string, string>, corps: unknown) =>
    fetch(arret(), {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });

  const lever = (entete: Record<string, string>, corps: unknown) =>
    fetch(arret(), {
      method: "DELETE",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify(corps),
    });

  const etatPublic = async (): Promise<MaintenanceStatus> =>
    (await (await fetch(`${baseUrl}/v1/public/maintenance`)).json()) as MaintenanceStatus;

  const parametre = async (cle: string): Promise<string | undefined> =>
    (await db.prisma.systemParameter.findUnique({ where: { key: cle } }))?.value;

  // ——— L'accès ———

  it("refuse sans session", async () => {
    expect((await fetch(`${baseUrl}/v1/admin/maintenance`)).status).toBe(401);
  });

  // Arrêter le service engage tout le produit : c'est un levier d'administration,
  // pas un geste d'assistance quotidienne.
  it("est fermé au support", async () => {
    const { entete } = await session("support");
    expect((await lire(entete)).status).toBe(403);
    expect((await declencher(entete, { dureeMinutes: 60, reason: MOTIF })).status).toBe(403);
  });

  // C'est par là qu'on rouvre : la route doit répondre PENDANT l'arrêt.
  it("reste joignable une fois le service arrêté", async () => {
    const { entete } = await session("admin");
    await declencher(entete, { dureeMinutes: 30, reason: MOTIF });

    expect((await lire(entete)).status).toBe(200);
    expect((await fetch(`${baseUrl}/v1/public/config`)).status).toBe(503);
  });

  // ——— Déclencher ———

  it("arrête le service et annonce une heure de retour", async () => {
    const { entete } = await session("admin");
    const avant = Date.now();

    expect((await declencher(entete, { dureeMinutes: 120, reason: MOTIF })).status).toBe(200);

    const etat = await etatPublic();
    expect(etat.maintenance).toBe(true);
    const annonce = Date.parse(etat.until ?? "");
    expect(annonce).toBeGreaterThan(avant + 119 * 60_000);
    expect(annonce).toBeLessThan(avant + 121 * 60_000);
  });

  // « Pas de "bientôt", pas d'estimation inventée » : sans durée, on arrête
  // sans rien promettre — l'écran d'attente a deux états, et c'est voulu.
  it("arrête sans heure quand la durée n'est pas connue", async () => {
    const { entete } = await session("admin");

    await declencher(entete, { dureeMinutes: null, reason: MOTIF });

    const etat = await etatPublic();
    expect([etat.maintenance, etat.until]).toEqual([true, null]);
  });

  // Prolonger repart de MAINTENANT, jamais de l'heure déjà annoncée : sinon,
  // prolonger d'une échéance dépassée annoncerait un retour déjà passé.
  it("prolonge depuis maintenant, pas depuis l'échéance dépassée", async () => {
    const { entete } = await session("admin");
    await db.prisma.systemParameter.update({
      where: { key: PARAM_MAINTENANCE_UNTIL },
      data: { value: new Date(Date.now() - 60 * 60_000).toISOString() },
    });

    await declencher(entete, { dureeMinutes: 30, reason: MOTIF });

    const annonce = Date.parse((await etatPublic()).until ?? "");
    expect(annonce).toBeGreaterThan(Date.now());
  });

  // ——— Lever ———

  it("rouvre le service", async () => {
    const { entete } = await session("admin");
    await declencher(entete, { dureeMinutes: 60, reason: MOTIF });

    expect((await lever(entete, { reason: MOTIF })).status).toBe(200);

    expect((await etatPublic()).maintenance).toBe(false);
    expect((await fetch(`${baseUrl}/v1/public/config`)).status).toBe(200);
  });

  // Une heure laissée derrière soi ressortirait au prochain arrêt : le service
  // annoncerait un retour pour une heure d'avant-hier.
  it("efface l'heure annoncée en rouvrant", async () => {
    const { entete } = await session("admin");
    await declencher(entete, { dureeMinutes: 60, reason: MOTIF });

    await lever(entete, { reason: MOTIF });

    expect(await parametre(PARAM_MAINTENANCE_UNTIL)).toBe("");
  });

  // ——— Le motif ———

  it("refuse de déclencher sans motif", async () => {
    const { entete } = await session("admin");
    expect((await declencher(entete, { dureeMinutes: 60 })).status).toBe(400);
    expect((await etatPublic()).maintenance).toBe(false);
  });

  it("refuse de lever sans motif", async () => {
    const { entete } = await session("admin");
    expect((await lever(entete, {})).status).toBe(400);
  });

  it("journalise les deux gestes avec leur auteur et leur motif", async () => {
    const { compte, entete } = await session("admin");

    await declencher(entete, { dureeMinutes: 45, reason: MOTIF });
    await lever(entete, { reason: "Intervention terminée plus tôt que prévu" });

    const traces = await db.prisma.auditLog.findMany({
      where: { actorId: compte.id }, orderBy: { createdAt: "asc" },
    });
    expect(traces.map((t) => t.action)).toEqual(["maintenance_start", "maintenance_end"]);
    expect(traces[0]?.reason).toBe(MOTIF);
  });

  // ——— Lire ———

  it("rend l'état courant à l'administrateur", async () => {
    const { entete } = await session("admin");
    await declencher(entete, { dureeMinutes: 90, reason: MOTIF });

    const corps = (await (await lire(entete)).json()) as MaintenanceStatus;
    expect(corps.maintenance).toBe(true);
    expect(corps.until).not.toBeNull();
  });
});
