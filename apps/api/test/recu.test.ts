import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { RecuService } from "../src/payments/recu.service.js";
import { StockageMemoire } from "../src/stockage/memoire.adapter.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { FlagsService } from "../src/flags/flags.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";
const SITE = "https://lehno.test";

/**
 * Le reçu d'un versement.
 *
 * Il COMPLÈTE la référence de transaction, il ne la remplace pas : la référence
 * reste obligatoire à la déclaration, le reçu se joint après, sur le paiement
 * créé. La personne a déjà versé son argent quand elle déclare — exiger le
 * fichier à cet instant la laisserait coincée si son dépôt échoue.
 *
 * Le fichier ne traverse pas l'API : le serveur signe, le client dépose, puis
 * confirme. Ces cas éprouvent ce qui se passe À LA CONFIRMATION, quand plus
 * personne n'a regardé les octets.
 */
describe("le reçu d'un versement", () => {
  let db: TestDb;
  let stockage: StockageMemoire;
  let recus: RecuService;
  let awa: string;
  let paiement: string;

  const compte = async (): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
      select: { id: true },
    });
    return u.id;
  };

  /* Le compte de collecte n'est pas décoratif : la base porte une contrainte
     `payment_voie_manuelle_a_un_compte` qui refuse une voie manuelle sans lui.
     Une ligne fabriquée sans ce compte ne ressemblerait à aucune ligne réelle,
     et le test ne prouverait rien. */
  const unPaiement = async (userId: string, status: "pending" | "succeeded" = "pending"): Promise<string> => {
    const banque = await db.prisma.collectionAccount.create({
      data: { label: "Compte principal", operator: "MTN", number: "670000000" },
      select: { id: true },
    });
    const p = await db.prisma.payment.create({
      data: {
        userId, mode: "semi_manual", amount: 1_000, currency: "XAF", credits: 10,
        collectionAccountId: banque.id,
        providerRef: `TX-${randomBytes(5).toString("hex").toUpperCase()}`, status,
      },
      select: { id: true },
    });
    return p.id;
  };

  /* Un reçu PHOTOGRAPHIÉ, donc large et porteur de métadonnées. C'est le risque
     qu'on éprouve : une photo prise chez soi porte l'adresse du domicile, et un
     reçu se photographie chez soi comme le reste. */
  const photoDeRecu = async (): Promise<Buffer> =>
    sharp({ create: { width: 1200, height: 400, channels: 3, background: "#EEEEEE" } })
      .withExif({ IFD0: { Copyright: "Awa", Make: "Lehno", Model: "Domicile" } })
      .jpeg()
      .toBuffer();

  /* Le plus petit PDF que la spécification admette. Ce qui compte est l'en-tête
     `%PDF-` : c'est par lui qu'on reconnaît un PDF, pas par ce que le client
     déclare. */
  const unPdf = (): Buffer => Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n", "latin1");

  const deposer = async (paymentId: string, type: "image/jpeg" | "application/pdf", octets: Buffer): Promise<void> => {
    await recus.depot(awa, paymentId, type);
    const { depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
      where: { id: awa }, select: { depotEnCoursKey: true },
    });
    stockage.poser(depotEnCoursKey!, octets);
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    stockage = new StockageMemoire();
    recus = new RecuService(db.prisma as never, stockage);
    awa = await compte();
    paiement = await unPaiement(awa);
  });

  /* LA DIFFÉRENCE AVEC UN AVATAR, et c'est celle qui compte. `AvatarService`
     recadre en carré : appliqué ici, le recadrage couperait la référence de
     transaction, qui est précisément ce qu'on vient lire sur le reçu. On borne
     le plus grand côté et on garde la page entière. */
  it("garde la page entière plutôt que de la recadrer", async () => {
    await deposer(paiement, "image/jpeg", await photoDeRecu());
    await recus.confirmer(awa, paiement);

    const ligne = await db.prisma.payment.findUniqueOrThrow({ where: { id: paiement } });
    const servi = await sharp(stockage.contenuDe(ligne.proofKey!)).metadata();
    expect(servi.width).toBe(1200);
    expect(servi.height).toBe(400);
  });

  // Une photo de reçu prise au téléphone porte la position du domicile.
  it("retire les métadonnées d'une photo de reçu", async () => {
    await deposer(paiement, "image/jpeg", await photoDeRecu());
    await recus.confirmer(awa, paiement);

    const ligne = await db.prisma.payment.findUniqueOrThrow({ where: { id: paiement } });
    expect((await sharp(stockage.contenuDe(ligne.proofKey!)).metadata()).exif).toBeUndefined();
  });

  /* LE PDF NE SE RECOMPOSE PAS. C'est la forme sous laquelle les banques
     envoient leur relevé, et le refuser obligerait à en faire une capture
     d'écran — donc à dégrader la seule pièce qui n'ait pas été photographiée.
     On le range tel quel, après l'avoir reconnu à ses octets d'en-tête. */
  it("accepte un PDF et le range tel quel", async () => {
    const pdf = unPdf();
    await deposer(paiement, "application/pdf", pdf);
    await recus.confirmer(awa, paiement);

    const ligne = await db.prisma.payment.findUniqueOrThrow({ where: { id: paiement } });
    expect(ligne.proofKey).toMatch(/^recus\/.*\.pdf$/);
    expect(stockage.contenuDe(ligne.proofKey!)).toEqual(pdf);
  });

  /* Le type déclaré au dépôt ne décide de RIEN : un fichier se déclare comme il
     veut. La vérification porte sur les octets — ici un PDF annoncé, mais du
     texte livré. */
  it("refuse un fichier qui n'est ni une image ni un PDF", async () => {
    await deposer(paiement, "application/pdf", Buffer.from("ceci n'est pas un reçu", "utf8"));
    await expect(recus.confirmer(awa, paiement)).rejects.toMatchObject({ code: "validation_failed" });

    const ligne = await db.prisma.payment.findUniqueOrThrow({ where: { id: paiement } });
    expect(ligne.proofKey).toBeNull();
    /* Le dépôt refusé S'OUBLIE : le garder ferait reprendre à la confirmation
       suivante un objet qu'on vient de rejeter. */
    const c = await db.prisma.user.findUniqueOrThrow({ where: { id: awa }, select: { depotEnCoursKey: true } });
    expect(c.depotEnCoursKey).toBeNull();
  });

  /* Le paiement doit être À LUI, et on le vérifie AU DÉPÔT : refuser après une
     montée ferait payer le forfait pour rien. 404 et non 403 — dire « il existe
     mais n'est pas à vous » apprendrait qu'il existe. */
  it("refuse d'ouvrir un dépôt sur le paiement d'un autre", async () => {
    const bila = await compte();
    const sien = await unPaiement(bila);
    await expect(recus.depot(awa, sien, "image/jpeg")).rejects.toMatchObject({ code: "not_found" });
  });

  /* Une fois la décision prise, changer la pièce qui l'a motivée récrirait
     l'histoire. */
  it("refuse de joindre un reçu à un paiement qui n'est plus en attente", async () => {
    const clos = await unPaiement(awa, "succeeded");
    await expect(recus.depot(awa, clos, "image/jpeg")).rejects.toMatchObject({ code: "conflict" });
  });

  /* LA GARDE QUI JUSTIFIE LE PRÉFIXE DE LA CIBLE. La confirmation ne dit pas ce
     qu'elle vise — c'est le dépôt qui l'a fixé. Sans ce contrôle, un reçu déposé
     pour un paiement se rattacherait à un autre. */
  it("refuse de confirmer un dépôt qui visait un autre paiement", async () => {
    const autre = await unPaiement(awa);
    await deposer(paiement, "image/jpeg", await photoDeRecu());

    await expect(recus.confirmer(awa, autre)).rejects.toMatchObject({ code: "conflict" });
    const ligne = await db.prisma.payment.findUniqueOrThrow({ where: { id: autre } });
    expect(ligne.proofKey).toBeNull();
  });

  /* LA LECTURE SE VÉRIFIE À CHAQUE FOIS. La clé seule ne vaut rien : un seau
     ouvert ferait de chaque lien partagé une fois un lien ouvert pour toujours.
     L'administration lit n'importe lequel — c'est sa raison d'être ; un client
     ne lit que le sien. */
  it("signe la lecture pour son propriétaire et pour l'administration, jamais pour un tiers", async () => {
    await deposer(paiement, "image/jpeg", await photoDeRecu());
    await recus.confirmer(awa, paiement);

    await expect(recus.urlDe(paiement, { userId: awa })).resolves.toMatchObject({
      expireDans: expect.any(Number) as number,
    });
    await expect(recus.urlDe(paiement, { pourAdmin: true })).resolves.toMatchObject({
      expireDans: expect.any(Number) as number,
    });

    const bila = await compte();
    await expect(recus.urlDe(paiement, { userId: bila })).rejects.toMatchObject({ code: "not_found" });
  });

  // Un paiement sans reçu n'a pas d'URL à rendre, et le dire « absent » évite
  // de faire croire à un fichier illisible.
  it("rend absent plutôt qu'une URL quand il n'y a pas de reçu", async () => {
    await expect(recus.urlDe(paiement, { pourAdmin: true })).rejects.toMatchObject({ code: "not_found" });
  });

  /* Remplacer un reçu efface le précédent : deux fichiers pour une seule ligne
     laisseraient un objet que plus rien ne désigne, et qu'aucun ménage ne
     retrouverait. */
  it("efface le reçu précédent quand on en joint un autre", async () => {
    await deposer(paiement, "image/jpeg", await photoDeRecu());
    await recus.confirmer(awa, paiement);
    const premier = (await db.prisma.payment.findUniqueOrThrow({ where: { id: paiement } })).proofKey!;

    await deposer(paiement, "application/pdf", unPdf());
    await recus.confirmer(awa, paiement);
    const second = (await db.prisma.payment.findUniqueOrThrow({ where: { id: paiement } })).proofKey!;

    expect(second).not.toBe(premier);
    expect(stockage.contenuDe(premier)).toBeUndefined();
    expect(stockage.contenuDe(second)).toBeDefined();
  });

  /* LE SERVICE DOIT DÉMARRER DANS LA VRAIE APPLICATION, et les cas ci-dessus ne
   * le prouvaient pas : ils construisent `new RecuService(...)` à la main, donc
   * ils passaient au vert pendant que l'injection échouait — le jeton du
   * stockage s'appelle `STOCKAGE_PORT`, pas `STOCKAGE`, et rien ici ne le
   * lisait. Toute l'API refusait de démarrer.
   *
   * Un service ne se teste donc pas seulement dans son coin : il faut au moins
   * un cas qui monte le module et frappe la route, sinon la couverture rassure
   * sur un serveur qui ne s'allume pas. */
  describe("par HTTP, sur l'application montée", () => {
    let app: INestApplication;
    let baseUrl: string;
    let precedent: Record<string, string | undefined>;

    beforeAll(async () => {
      precedent = {
        DATABASE_URL: process.env.DATABASE_URL,
        OTP_PEPPER: process.env.OTP_PEPPER,
        JWT_SECRET: process.env.JWT_SECRET,
        ADMIN_JWT_SECRET: process.env.ADMIN_JWT_SECRET,
        LEHNO_MAIL_CONSOLE: process.env.LEHNO_MAIL_CONSOLE,
        PUBLIC_WEB_URL: process.env.PUBLIC_WEB_URL,
      };
      process.env.DATABASE_URL = db.url;
      process.env.OTP_PEPPER = PEPPER;
      process.env.JWT_SECRET = SECRET;
      process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
      process.env.LEHNO_MAIL_CONSOLE = "1";
      process.env.PUBLIC_WEB_URL = SITE;

      app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
      app.setGlobalPrefix("v1");
      app.useGlobalFilters(new AppExceptionFilter());
      await app.listen(0);
      baseUrl = await app.getUrl();
    }, 120_000);

    afterAll(async () => {
      await app.close();
      for (const [cle, valeur] of Object.entries(precedent)) {
        if (valeur === undefined) delete process.env[cle];
        else process.env[cle] = valeur;
      }
    });

    const jeton = (userId: string): string =>
      jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });

    /* APRÈS la remise à zéro de l'englobant, et à chaque cas. Un drapeau naît
       ÉTEINT — c'est voulu, c'est l'état d'un déploiement neuf — et `topup.manual`
       gouverne toute cette surface. Allumé une seule fois dans le premier cas,
       il retombait pour les suivants, qui recevaient alors `404` : FeatureGuard
       passe AVANT AuthGuard, et une surface éteinte l'est pour tout le monde,
       jeton ou pas. Les statuts qu'on éprouve ici ne veulent donc rien dire
       tant que le drapeau n'est pas rallumé. */
    beforeEach(async () => {
      const drapeaux = new FlagsService(db.prisma as never);
      await drapeaux.reconcilier();
      await db.prisma.featureFlag.update({ where: { key: "topup.manual" }, data: { enabled: true } });
    });

    it("délivre une autorisation de dépôt", async () => {
      const r = await fetch(`${baseUrl}/v1/me/payments/${paiement}/proof/depot`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ contentType: "application/pdf" }),
      });
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { url: string; typeMime: string; tailleMax: number };
      expect(corps.typeMime).toBe("application/pdf");
      // La clé ne sort JAMAIS : le client reçoit une URL, et rien d'autre.
      expect(Object.keys(corps)).not.toContain("cle");
    });

    /* 400 et non 422 : `validation_failed` vaut 400 dans tout le contrat (voir
       common/errors.ts). Le type refusé ici l'est par le SCHÉMA, avant même
       qu'on touche au stockage — signer un dépôt pour un exécutable serait déjà
       trop tard. */
    it("refuse un type de fichier qu'on n'accepte pas", async () => {
      const r = await fetch(`${baseUrl}/v1/me/payments/${paiement}/proof/depot`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${jeton(awa)}` },
        body: JSON.stringify({ contentType: "application/x-msdownload" }),
      });
      expect(r.status).toBe(400);
    });

    it("refuse un appel sans jeton", async () => {
      const r = await fetch(`${baseUrl}/v1/me/payments/${paiement}/proof/depot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: "image/jpeg" }),
      });
      expect(r.status).toBe(401);
    });
  });
});
