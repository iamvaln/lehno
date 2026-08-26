import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/**
 * L'export des deux lectures — ux-admin §5.12, §5.13 et §7.
 *
 * « Les listes filtrées s'exportent, pour l'analyse ou la conformité. » Deux
 * mots comptent : **filtrées**, donc l'export porte les mêmes filtres que ce
 * qu'on regarde — sortir tout quand on regarde une semaine serait un autre
 * geste ; et **journalisé**, parce qu'un export du journal d'audit est
 * lui-même un geste d'administration.
 */
describe("administration — l'export des lectures", () => {
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

  const exporter = (chemin: string, entete: Record<string, string>, requete = "") =>
    fetch(`${baseUrl}/v1/admin/${chemin}/export${requete}`, { method: "POST", headers: entete });

  const tracer = (adminId: string, action: string, over: Record<string, unknown> = {}) =>
    db.prisma.auditLog.create({
      data: { actorType: "admin", actorId: adminId, action, reason: "Motif de démonstration", ...over },
    });

  // ─── Le journal d'audit ────────────────────────────────────────────────────

  it("rend un fichier de valeurs séparées, pas du JSON", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");

    const res = await exporter("audit-log", entete);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
  });

  it("la première ligne nomme les colonnes", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");

    const texte = await (await exporter("audit-log", entete)).text();

    expect(texte.split("\n")[0]).toBe("date,acteurType,acteurId,action,motif,cibleType,cibleId");
  });

  it("chaque trace donne une ligne", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");
    await tracer(compte.id, "parameter_update");

    const texte = await (await exporter("audit-log", entete)).text();

    // Deux traces, plus l'entête — et l'export lui-même n'y figure pas : il est
    // écrit après la lecture.
    expect(texte.trim().split("\n")).toHaveLength(3);
  });

  // « Les listes FILTRÉES s'exportent » : sortir tout quand on regarde une
  // semaine serait un autre geste, et personne ne s'en apercevrait à la
  // lecture du fichier.
  it("l'export porte les mêmes filtres que la liste", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");
    await tracer(compte.id, "parameter_update");

    const texte = await (await exporter("audit-log", entete, "?action=parameter_update")).text();

    expect(texte).toContain("parameter_update");
    expect(texte).not.toContain("user_status_update");
  });

  // Un motif qui contient une virgule, un guillemet ou un retour à la ligne
  // casserait le fichier en silence : la ligne se scinderait, et une colonne
  // glisserait sur la suivante sans que rien ne le dise.
  it("une valeur qui contient une virgule ne casse pas la ligne", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update", { reason: "Suspendu, puis rétabli" });

    const texte = await (await exporter("audit-log", entete)).text();

    expect(texte).toContain('"Suspendu, puis rétabli"');
    expect(texte.trim().split("\n")).toHaveLength(2);
  });

  it("un guillemet dans une valeur est doublé, pas laissé nu", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update", { reason: 'Motif dit « urgent »' });

    const texte = await (await exporter("audit-log", entete)).text();

    expect(texte.trim().split("\n")).toHaveLength(2);
  });

  // « L'export apparaît au journal d'audit » : sortir le journal est
  // lui-même un geste d'administration, et le plus sensible de tous.
  it("l'export du journal s'inscrit au journal", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");

    await exporter("audit-log", entete);

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "audit_log_export" } });
    expect(trace.actorId).toBe(compte.id);
  });

  // Le motif dit CE QU'ON A SORTI. « qui a sorti quoi » n'a de sens que si le
  // quoi y figure : un motif générique ne dirait rien qu'on ne sache déjà.
  it("la trace de l'export dit ce qui a été sorti", async () => {
    const { compte, entete } = await session("admin");
    await tracer(compte.id, "user_status_update");

    await exporter("audit-log", entete, "?action=user_status_update");

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "audit_log_export" } });
    expect(trace.reason).toContain("user_status_update");
    expect(trace.metadata).toMatchObject({ lignes: 1 });
  });

  // ─── Les connexions ────────────────────────────────────────────────────────

  it("les connexions s'exportent aussi", async () => {
    const { entete } = await session("admin");
    await db.prisma.loginActivity.create({
      data: { result: "failure", attemptedEmail: "awa@exemple.cm", method: "otp" },
    });

    const texte = await (await exporter("login-activity", entete)).text();

    expect(texte.split("\n")[0]).toBe("date,compte,adresseTentee,resultat,voie,appareil,lieu");
    expect(texte).toContain("awa@exemple.cm");
  });

  // L'adresse sert aux investigations, pas à l'affichage — ni au fichier qu'on
  // fait circuler par courriel ou dans un tableur.
  it("l'adresse IP ne sort pas dans le fichier", async () => {
    const { entete } = await session("admin");
    await db.prisma.loginActivity.create({
      data: { result: "failure", attemptedEmail: "awa@exemple.cm", method: "otp", ip: "102.244.18.7" },
    });

    const texte = await (await exporter("login-activity", entete)).text();

    expect(texte).not.toContain("102.244.18.7");
  });

  // §5.13 demande un filtre par utilisateur, que le serveur n'acceptait pas.
  it("les connexions se filtrent par utilisateur", async () => {
    const { entete } = await session("admin");
    const u = await db.prisma.user.create({
      data: { email: "awa@exemple.cm", username: "awa", referralCode: "AWA1" },
    });
    await db.prisma.loginActivity.create({ data: { result: "success", userId: u.id, method: "otp" } });
    await db.prisma.loginActivity.create({ data: { result: "failure", attemptedEmail: "autre@exemple.cm", method: "otp" } });

    const corps = (await (await fetch(`${baseUrl}/v1/admin/login-activity?utilisateurId=${u.id}`, { headers: entete })).json()) as {
      items: { compte: string | null }[];
    };

    expect(corps.items).toHaveLength(1);
    expect(corps.items[0]?.compte).toBe("awa");
  });

  // ─── Les droits ────────────────────────────────────────────────────────────

  // Le journal est réservé aux administrateurs : son export l'est aussi, sans
  // quoi le support en obtiendrait par la sortie ce qu'on lui refuse à l'écran.
  it("l'export du journal est fermé au support", async () => {
    const { entete } = await session("support");

    expect((await exporter("audit-log", entete)).status).toBe(403);
  });

  it("l'export des connexions est ouvert au support", async () => {
    const { entete } = await session("support");

    expect((await exporter("login-activity", entete)).status).toBe(200);
  });

  it("rien ne sort sans session", async () => {
    expect((await exporter("audit-log", {})).status).toBe(401);
    expect((await exporter("login-activity", {})).status).toBe(401);
  });
});
