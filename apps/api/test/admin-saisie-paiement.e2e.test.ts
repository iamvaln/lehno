import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, avecMotif, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { paiementCreeSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("administration — la saisie manuelle d'un paiement", () => {
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

  const client = async () => (await db.prisma.user.create({
    data: { email: "awa@exemple.cm", username: "awa", referralCode: "AWA1" },
  })).id;

  const decor = async () => {
    const [utilisateurId, palier, compteCollecte, canal] = await Promise.all([
      client(),
      db.prisma.creditBundle.findFirstOrThrow({ where: { position: 2 } }),
      db.prisma.collectionAccount.create({
        data: { label: "Orange Money principal", operator: "orange_money", number: "690000000" },
      }),
      avecMotif(db.prisma, "fixture de test", (tx) => tx.paymentChannel.create({
        data: { kind: "mobile_money", operator: "orange_money", country: "CM", label: "Orange Money", feePercent: 2 },
      })),
    ]);
    return { utilisateurId, palierId: palier.id, compteCollecteId: compteCollecte.id, canalId: canal.id };
  };

  const saisir = async (entete: Record<string, string>, over: Record<string, unknown> = {}) => {
    const d = await decor();
    return fetch(`${baseUrl}/v1/admin/payments`, {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({ ...d, reason: "Versement constaté sur le compte Orange", ...over }),
    });
  };

  it("suit le contrat publié, au champ près", async () => {
    const { entete } = await session("admin");

    const corps = await (await saisir(entete)).json();

    const valide = paiementCreeSchema.safeParse(corps);
    expect(valide.success ? null : valide.error.issues).toBeNull();
  });

  it("le paiement naît en attente, sur la voie manuelle", async () => {
    const { entete } = await session("admin");

    await saisir(entete);

    const p = await db.prisma.payment.findFirstOrThrow();
    expect(p.status).toBe("pending");
    expect(p.mode).toBe("manual");
  });

  // Le palier décide du montant et des crédits : « on achète un palier, jamais
  // un montant libre ». Les recopier depuis la requête laisserait un
  // administrateur créditer ce qu'il veut.
  it("le montant et les crédits viennent du palier, pas de la requête", async () => {
    const { entete } = await session("admin");

    const d = await decor();
    const poster = (corps: Record<string, unknown>) => fetch(`${baseUrl}/v1/admin/payments`, {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({ ...d, reason: "Versement constaté sur le compte Orange", ...corps }),
    });

    // Le contrat n'a pas de champ pour eux : la requête est refusée avant
    // d'atteindre le service. C'est la forme qui garantit qu'un administrateur
    // ne crédite pas ce qu'il veut, pas la vigilance de qui écrit le service.
    expect((await poster({ montant: 999_999, credits: 999 })).status).toBe(400);

    await poster({});

    const p = await db.prisma.payment.findFirstOrThrow();
    expect(Number(p.amount)).toBe(1000);
    expect(p.credits).toBe(10);
  });

  // « Les frais annoncés sont figés sur le paiement. Le barème d'un canal
  // change ; un paiement passé garde ce qui lui a été annoncé. » Lire le taux
  // du jour pour expliquer un paiement d'il y a trois mois donnerait un chiffre
  // faux, sans que personne s'en aperçoive.
  it("les frais et l'attendu sont figés à la création", async () => {
    const { entete } = await session("admin");
    await saisir(entete);
    const avant = await db.prisma.payment.findFirstOrThrow();

    // Le barème double après coup.
    await avecMotif(db.prisma, "nouveau barème", (tx) =>
      tx.paymentChannel.updateMany({ data: { feePercent: 4 } }));

    const apres = await db.prisma.payment.findUniqueOrThrow({ where: { id: avant.id } });
    expect(Number(apres.feeAmount)).toBe(20);
    expect(Number(apres.expectedAmount)).toBe(1000);
  });

  // Sur le mobile money, le client paie les frais : l'attendu sur le compte est
  // le prix du palier, et tout manque constaté est un vrai écart.
  it("sur un canal à la charge du payeur, l'attendu est le prix du palier", async () => {
    const { entete } = await session("admin");

    const corps = (await (await saisir(entete)).json()) as { frais: number; attenduSurLeCompte: number };

    expect(corps.frais).toBe(20);
    expect(corps.attenduSurLeCompte).toBe(1000);
  });

  /* CE QU'ON A ANNONCÉ, FIGÉ SUR LA LIGNE. Même doctrine que `feeAmount`,
     mais la raison est plus forte ici : un paiement saisi à la main EST le
     paiement contesté — celui qu'on rouvre six mois plus tard parce que
     quelqu'un dit avoir versé autre chose que ce qui a été crédité.

     L'épreuve va jusqu'au bout du scénario redouté : on change le prix
     unitaire ET on supprime le palier. `credit_bundle_id` est en `SetNull`,
     donc la référence disparaît — et sans ces deux montants, l'information
     avec elle. */
  it("fige le prix unitaire et le prix du palier, qui survivent à sa suppression", async () => {
    const { entete } = await session("admin");
    await db.prisma.systemParameter.upsert({
      where: { key: "credit_unit_price" },
      create: { key: "credit_unit_price", value: "250", valueType: "money" },
      update: { value: "250" },
    });

    /* Un palier À NOUS, et pas celui du semis : le test le supprime, et les
       autres épreuves du fichier lisent le palier semé — `resetDatabase` ne le
       resème pas. Emprunter celui du décor ferait tomber les suivantes, et le
       coupable serait introuvable. */
    const palier = await db.prisma.creditBundle.create({
      data: { amount: 1000, credits: 10, position: 99, currency: "XAF" },
    });
    await saisir(entete, { palierId: palier.id });

    const ligne = await db.prisma.payment.findFirstOrThrow();
    expect(Number(ligne.creditUnitPrice)).toBe(250);
    expect(Number(ligne.bundleAmount)).toBe(1000);

    await db.prisma.systemParameter.update({
      where: { key: "credit_unit_price" }, data: { value: "500" },
    });
    await db.prisma.creditBundle.delete({ where: { id: palier.id } });

    const apres = await db.prisma.payment.findUniqueOrThrow({ where: { id: ligne.id } });
    expect(apres.creditBundleId).toBeNull();
    expect(Number(apres.creditUnitPrice)).toBe(250);
    expect(Number(apres.bundleAmount)).toBe(1000);
  });

  // « Chaque passage d'état ouvre une ligne d'historique avec origin = admin,
  // l'identifiant de l'administrateur et un motif obligatoire. »
  it("l'histoire du paiement s'ouvre avec son auteur et son motif", async () => {
    const { compte, entete } = await session("admin");

    await saisir(entete);

    const ligne = await db.prisma.paymentStatusHistory.findFirstOrThrow();
    expect(ligne.status).toBe("pending");
    expect(ligne.origin).toBe("admin");
    expect(ligne.changedByAdminId).toBe(compte.id);
    expect(ligne.reason).toBe("Versement constaté sur le compte Orange");
    // L'état courant, donc pas encore fermé.
    expect(ligne.endedAt).toBeNull();
  });

  it("la saisie rejoint le journal d'audit", async () => {
    const { compte, entete } = await session("admin");

    await saisir(entete);

    const trace = await db.prisma.auditLog.findFirstOrThrow({ where: { action: "payment_manual_create" } });
    expect(trace.actorId).toBe(compte.id);
  });

  it("un motif trop court est refusé, et rien n'est écrit", async () => {
    const { entete } = await session("admin");

    const res = await saisir(entete, { reason: "court" });

    expect(res.status).toBe(400);
    expect(await db.prisma.payment.count()).toBe(0);
  });

  // Un compte de collecte désactivé ne doit plus recevoir : le proposer
  // reviendrait à envoyer un client verser sur un compte fermé.
  it("un compte de collecte inactif est refusé", async () => {
    const { entete } = await session("admin");
    const d = await decor();
    await db.prisma.collectionAccount.update({ where: { id: d.compteCollecteId }, data: { isActive: false } });

    const res = await fetch(`${baseUrl}/v1/admin/payments`, {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({ ...d, reason: "Versement constaté sur le compte Orange" }),
    });

    expect(res.status).toBe(422);
  });

  it("un palier inactif est refusé", async () => {
    const { entete } = await session("admin");
    const d = await decor();
    await db.prisma.creditBundle.update({ where: { id: d.palierId }, data: { isActive: false } });

    const res = await fetch(`${baseUrl}/v1/admin/payments`, {
      method: "POST",
      headers: { ...entete, "content-type": "application/json" },
      body: JSON.stringify({ ...d, reason: "Versement constaté sur le compte Orange" }),
    });

    expect(res.status).toBe(422);
    await db.prisma.creditBundle.update({ where: { id: d.palierId }, data: { isActive: true } });
  });

  it("aucun crédit n'est octroyé à la saisie", async () => {
    const { entete } = await session("admin");

    await saisir(entete);

    expect(await db.prisma.creditTransaction.count()).toBe(0);
  });

  // Saisir un paiement fait entrer de l'argent dans le registre : c'est un
  // levier de la famille Économie.
  it("le support ne saisit pas de paiement", async () => {
    const { entete } = await session("support");

    expect((await saisir(entete)).status).toBe(403);
  });
});
