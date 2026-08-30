import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { StatsTransactions } from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";
const JOUR = 24 * 60 * 60_000;

describe("administration — les statistiques des transactions", () => {
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

  const lire = async (entete: Record<string, string>, requete = ""): Promise<StatsTransactions> =>
    (await (await fetch(`${baseUrl}/v1/admin/payment-stats${requete}`, { headers: entete })).json()) as StatsTransactions;

  let n = 0;
  const utilisateur = async () => {
    n += 1;
    return db.prisma.user.create({
      data: { email: `s${n}@example.com`, username: `s${n}`, referralCode: `S${n}` },
    });
  };

  /* Le canal se crée par la ROUTE, jamais en direct : la table porte un
     déclencheur d'historisation qui exige une raison, et écrire en base la
     contournerait — le test passerait alors par un chemin que la production
     n'emprunte pas. */
  const canal = async (
    entete: Record<string, string>, operateur: string, pays: string,
    nature: "mobile_money" | "card" = "mobile_money",
  ) => {
    const res = await fetch(`${baseUrl}/v1/admin/payment-channels`, {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({
        nature, operateur, pays, libelle: `${operateur} ${pays}`,
        fraisPourcent: 2, fraisFixe: 0, fraisPortesPar: "payer",
        reason: `Ouverture du canal ${operateur} en ${pays}`,
      }),
    });
    return (await res.json()) as { id: string };
  };

  /** Un compte de collecte, exigé par la contrainte des voies manuelles. */
  const compteCollecte = async () => {
    n += 1;
    return db.prisma.collectionAccount.create({
      data: { operator: "mtn_momo", number: `69900000${n}`, label: `Compte ${n}` },
    });
  };

  const paiement = async (over: {
    montant?: number; frais?: number; etat?: "pending" | "succeeded" | "failed" | "expired";
    mode?: "provider" | "semi_manual" | "manual"; sens?: "charge" | "refund";
    canalId?: string | null; ilYAJours?: number;
  } = {}) => {
    const u = await utilisateur();
    const manuel = over.mode === "semi_manual" || over.mode === "manual";
    const collecte = manuel ? await compteCollecte() : null;
    return db.prisma.payment.create({
      data: {
        userId: u.id,
        amount: over.montant ?? 1000,
        feeAmount: over.frais ?? null,
        status: over.etat ?? "succeeded",
        mode: over.mode ?? "provider",
        direction: over.sens ?? "charge",
        paymentChannelId: over.canalId ?? null,
        // `payment_voie_manuelle_a_un_compte` : c'est le compte qui a reçu
        // l'argent, et un versement manuel sans lui ne se vérifie nulle part.
        collectionAccountId: collecte?.id ?? null,
        currency: "XAF",
        credits: 10,
        createdAt: new Date(Date.now() - (over.ilYAJours ?? 1) * JOUR),
      },
    });
  };

  // ——— L'accès ———

  it("refuse sans session", async () => {
    expect((await fetch(`${baseUrl}/v1/admin/payment-stats`)).status).toBe(401);
  });

  // §6 accorde au support « consulter les paiements » : la lecture lui est
  // ouverte, c'est la sortie en fichier qui lui est fermée.
  it("est ouvert au support", async () => {
    const { entete } = await session("support");
    const r = await fetch(`${baseUrl}/v1/admin/payment-stats`, { headers: entete });
    expect(r.status).toBe(200);
  });

  it("refuse une période que l'écran ne propose pas", async () => {
    const { entete } = await session("admin");
    const r = await fetch(`${baseUrl}/v1/admin/payment-stats?periode=12m`, { headers: entete });
    expect(r.status).toBe(400);
  });

  // ——— Les quatre chiffres ———

  it("compte les tentatives et ce qui aboutit", async () => {
    const { entete } = await session("admin");
    await paiement({ etat: "succeeded" });
    await paiement({ etat: "succeeded" });
    await paiement({ etat: "failed" });

    const stats = await lire(entete);
    expect([stats.tentatives, stats.aboutis]).toEqual([3, 2]);
  });

  // Seuls les paiements ABOUTIS sont encaissés : compter un échec gonflerait
  // la recette d'argent qui n'est jamais arrivé.
  it("n'encaisse que ce qui a abouti", async () => {
    const { entete } = await session("admin");
    await paiement({ montant: 1000, frais: 45, etat: "succeeded" });
    await paiement({ montant: 5000, frais: 200, etat: "failed" });

    const stats = await lire(entete);
    expect([stats.encaisse, stats.frais]).toEqual([1000, 45]);
  });

  /* La MÉDIANE, pas la moyenne : 1 000, 1 000 et 50 000 donnent une médiane de
     1 000 et une moyenne de 17 333. Un versement exceptionnel ferait croire à
     un panier qui n'existe pour personne. */
  it("rend le paiement médian, non le moyen", async () => {
    const { entete } = await session("admin");
    for (const montant of [1000, 1000, 50000]) await paiement({ montant });

    const stats = await lire(entete);
    expect(stats.median).toBe(1000);
  });

  // Nul, jamais zéro : « aucun paiement n'a abouti » n'est pas « le paiement
  // médian vaut zéro franc ».
  it("n'annonce aucun médian quand rien n'a abouti", async () => {
    const { entete } = await session("admin");
    await paiement({ etat: "failed" });

    const stats = await lire(entete);
    expect(stats.median).toBeNull();
  });

  // ——— Les trois axes ———

  it("coupe par sens", async () => {
    const { entete } = await session("admin");
    await paiement({ sens: "charge" });
    await paiement({ sens: "refund" });

    expect((await lire(entete, "?sens=depot")).tentatives).toBe(1);
    expect((await lire(entete, "?sens=retrait")).tentatives).toBe(1);
    expect((await lire(entete, "?sens=tous")).tentatives).toBe(2);
  });

  /* « manuel » couvre LES DEUX voies humaines : au lancement c'est la seule
     façon de recharger, et n'en montrer qu'une moitié fausserait le compte. */
  it("compte les deux voies humaines sous « manuel »", async () => {
    const { entete } = await session("admin");
    await paiement({ mode: "semi_manual" });
    await paiement({ mode: "manual" });
    await paiement({ mode: "provider" });

    expect((await lire(entete, "?mode=manuel")).tentatives).toBe(2);
    expect((await lire(entete, "?mode=auto")).tentatives).toBe(1);
  });

  it("coupe par période", async () => {
    const { entete } = await session("admin");
    await paiement({ ilYAJours: 3 });
    await paiement({ ilYAJours: 45 });

    expect((await lire(entete, "?periode=7j")).tentatives).toBe(1);
    expect((await lire(entete, "?periode=90j")).tentatives).toBe(2);
  });

  // La réponse dit la coupe qu'elle rend : sans ça, une carte figée à côté d'un
  // graphe qui bouge mentirait dès le premier changement de période.
  it("rend la coupe qu'il a appliquée", async () => {
    const { entete } = await session("admin");
    const stats = await lire(entete, "?periode=7j&sens=retrait&mode=manuel");
    expect([stats.periode, stats.sens, stats.mode]).toEqual(["7j", "retrait", "manuel"]);
  });

  // ——— Le graphe ———

  /* Encaissé et échoué ne s'additionnent pas : ce sont deux mesures du même
     jour, pas les parts d'un total. Les fondre cacherait ce qu'on vient
     regarder. */
  it("garde les deux montants d'un jour séparés", async () => {
    const { entete } = await session("admin");
    await paiement({ montant: 1000, etat: "succeeded", ilYAJours: 1 });
    await paiement({ montant: 400, etat: "failed", ilYAJours: 1 });

    const [jour] = (await lire(entete)).jours;
    expect([jour?.encaisse, jour?.echoue]).toEqual([1000, 400]);
  });

  // ——— L'aboutissement par groupe ———

  it("ventile l'aboutissement par pays et par moyen", async () => {
    const { entete } = await session("admin");
    const cm = await canal(entete, "mtn_momo", "CM");
    const ci = await canal(entete, "orange_money", "CI");
    await paiement({ canalId: cm.id, etat: "succeeded" });
    await paiement({ canalId: cm.id, etat: "failed" });
    await paiement({ canalId: ci.id, etat: "succeeded" });

    const stats = await lire(entete);
    expect(stats.parPays).toEqual([
      { cle: "CI", tentatives: 1, aboutis: 1 },
      { cle: "CM", tentatives: 2, aboutis: 1 },
    ]);
    expect(stats.parMoyen).toEqual([{ cle: "mobile_money", tentatives: 3, aboutis: 2 }]);
  });

  /* Un paiement sans canal — une écriture d'administration — n'a ni pays ni
     moyen. Il sort du classement plutôt que d'y figurer sous une clé vide, qui
     se lirait comme un moyen de paiement à part. */
  it("écarte du classement un paiement sans canal", async () => {
    const { entete } = await session("admin");
    await paiement({ canalId: null });

    const stats = await lire(entete);
    expect(stats.parPays).toEqual([]);
    expect(stats.tentatives).toBe(1);
  });
});
