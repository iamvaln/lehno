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
const JOUR = 24 * 60 * 60_000;

describe("administration — les métriques", () => {
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
    return { entete: { authorization: `Bearer ${accessToken}` } };
  };

  const metriques = (entete: Record<string, string>, periode?: string) =>
    fetch(`${baseUrl}/v1/admin/metrics${periode ? `?periode=${periode}` : ""}`, { headers: entete });

  let n = 0;
  const compte = (ilYAJours: number) => {
    n += 1;
    return db.prisma.user.create({
      data: {
        email: `u${n}@example.com`, username: `u${n}`, referralCode: `R${n}`,
        createdAt: new Date(Date.now() - ilYAJours * JOUR),
      },
    });
  };

  const connexion = (userId: string, ilYAJours: number, result: "success" | "failure" = "success") =>
    db.prisma.loginActivity.create({
      data: { userId, result, createdAt: new Date(Date.now() - ilYAJours * JOUR) },
    });

  const palier = (credits: number) =>
    db.prisma.creditBundle.create({
      data: { amount: credits, currency: "XAF", credits, position: 1 },
    });

  const paiement = async (
    userId: string, ilYAJours: number,
    status: "succeeded" | "pending" = "succeeded", bundleId?: string,
  ) =>
    db.prisma.payment.create({
      data: {
        userId, creditBundleId: bundleId ?? null, amount: 1000, currency: "XAF",
        credits: 1000, status, createdAt: new Date(Date.now() - ilYAJours * JOUR),
      },
    });

  const mouvement = (userId: string, amount: number, type: "consumption" | "purchase", ilYAJours: number) =>
    db.prisma.creditTransaction.create({
      data: {
        userId, type, source: type === "consumption" ? "consumption" : "purchase",
        amount, createdAt: new Date(Date.now() - ilYAJours * JOUR),
      },
    });

  // ——— L'accès ———

  it("refuse sans session", async () => {
    expect((await fetch(`${baseUrl}/v1/admin/metrics`)).status).toBe(401);
  });

  // « Consulter le tableau de bord, les métriques, les connexions » figure dans
  // ce que §6 accorde au support. La lecture lui est donc ouverte — c'est la
  // SORTIE en fichier qui lui est fermée, et elle l'est ailleurs.
  it("est ouvert au support en lecture", async () => {
    const { entete } = await session("support");
    expect((await metriques(entete)).status).toBe(200);
  });

  it("refuse une période que l'écran ne propose pas", async () => {
    const { entete } = await session("admin");
    expect((await metriques(entete, "1j")).status).toBe(400);
  });

  it("prend trente jours quand rien n'est demandé", async () => {
    const { entete } = await session("admin");
    expect((await (await metriques(entete)).json()).periode).toBe("30j");
  });

  // ——— La rétention ———

  it("compte les inscrits d'un mois, et ceux qui sont revenus", async () => {
    const { entete } = await session("admin");
    const revenu = await compte(40);
    await connexion(revenu.id, 36);
    await compte(40);

    const { retention } = await (await metriques(entete)).json();
    const cohorte = retention.cohortes.find((c: { inscrits: number }) => c.inscrits === 2);
    expect(cohorte.actifsA7j).toBe(1);
  });

  // Une tentative ratée n'est pas un retour : elle dit qu'on a essayé, pas
  // qu'on est entré. Les compter gonflerait la rétention de tous les comptes
  // dont quelqu'un cherche le mot de passe.
  it("ne compte pas une connexion échouée comme un retour", async () => {
    const { entete } = await session("admin");
    const u = await compte(40);
    await connexion(u.id, 36, "failure");

    const { retention } = await (await metriques(entete)).json();
    expect(retention.cohortes.find((c: { inscrits: number }) => c.inscrits === 1).actifsA7j).toBe(0);
  });

  // Une connexion au-delà de la fenêtre compte à trente jours, pas à sept.
  it("range un retour tardif dans la bonne colonne", async () => {
    const { entete } = await session("admin");
    const u = await compte(60);
    await connexion(u.id, 40);

    const { retention } = await (await metriques(entete)).json();
    const c = retention.cohortes.find((x: { inscrits: number }) => x.inscrits === 1);
    expect([c.actifsA7j, c.actifsA30j]).toEqual([0, 1]);
  });

  // La rétention ne suit pas la période choisie : à sept jours, la colonne
  // « J+30 » ne pourrait qu'afficher zéro pour tout le monde, et ce zéro se
  // lirait comme une fuite alors qu'il ne dit que « c'est trop tôt ».
  it("garde ses douze mois de cohortes quelle que soit la période", async () => {
    const { entete } = await session("admin");
    await compte(200);

    const court = await (await metriques(entete, "7j")).json();
    const long = await (await metriques(entete, "12m")).json();
    expect(court.retention.cohortes).toEqual(long.retention.cohortes);
  });

  // ——— La conversion ———

  it("ne compte comme acheteur qu'un paiement réussi", async () => {
    const { entete } = await session("admin");
    const paye = await compte(10);
    const attend = await compte(10);
    await paiement(paye.id, 8);
    await paiement(attend.id, 8, "pending");

    const { conversion } = await (await metriques(entete)).json();
    expect([conversion.comptes, conversion.acheteurs]).toEqual([2, 1]);
  });

  it("n'annonce aucun délai quand personne n'a acheté", async () => {
    const { entete } = await session("admin");
    await compte(10);

    const { conversion } = await (await metriques(entete)).json();
    expect(conversion.delaiMedianJours).toBeNull();
  });

  // Trois acheteurs à 1, 2 et 30 jours : la médiane dit 2, la moyenne dirait
  // 11. Un seul compte parti tard ferait croire à un cycle d'achat long qui
  // n'existe pour personne.
  it("rend la médiane du délai, et non la moyenne", async () => {
    const { entete } = await session("admin");
    for (const jours of [1, 2, 30]) {
      const u = await compte(40);
      await paiement(u.id, 40 - jours);
    }

    // Sur douze mois : les trois comptes datent de quarante jours, et une
    // fenêtre de trente les laisserait dehors.
    const { conversion } = await (await metriques(entete, "12m")).json();
    expect(conversion.delaiMedianJours).toBeCloseTo(2, 0);
  });

  it("répartit les achats par palier, désigné par ses crédits", async () => {
    const { entete } = await session("admin");
    const petit = await palier(500);
    const u = await compte(10);
    await paiement(u.id, 8, "succeeded", petit.id);

    const { conversion } = await (await metriques(entete)).json();
    expect(conversion.parPalier).toEqual([{ credits: 500, achats: 1 }]);
  });

  // ——— La consommation ———

  it("rend le volume consommé sans son signe, et le compte des mouvements", async () => {
    const { entete } = await session("admin");
    const u = await compte(10);
    await mouvement(u.id, -30, "consumption", 5);
    await mouvement(u.id, -12, "consumption", 5);

    const { consommation } = await (await metriques(entete)).json();
    expect(consommation).toEqual({ credits: 42, mouvements: 2 });
  });

  it("ne mêle pas un achat à la consommation", async () => {
    const { entete } = await session("admin");
    const u = await compte(10);
    await mouvement(u.id, 1000, "purchase", 5);

    const { consommation } = await (await metriques(entete)).json();
    expect(consommation).toEqual({ credits: 0, mouvements: 0 });
  });

  it("ne compte pas un mouvement hors de la période", async () => {
    const { entete } = await session("admin");
    const u = await compte(200);
    await mouvement(u.id, -50, "consumption", 120);

    const court = await (await metriques(entete, "30j")).json();
    const long = await (await metriques(entete, "12m")).json();
    expect([court.consommation.credits, long.consommation.credits]).toEqual([0, 50]);
  });

  // ——— Ce qui manque ———

  // Trois des cinq contenus de §5.11 n'ont pas de source. Le serveur le DIT,
  // plutôt que de rendre des rangs vides : un zéro non expliqué se lit comme
  // une mesure, et c'est ainsi que quatre écrans ont affiché des fixtures en
  // production (écart H).
  it("déclare les trois contenus qu'il ne sait pas encore mesurer", async () => {
    const { entete } = await session("admin");
    const { manques } = await (await metriques(entete)).json();
    expect(manques.sort()).toEqual(
      ["contributions", "issue_des_actions", "usage_par_fonctionnalite"],
    );
  });
});
