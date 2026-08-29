import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/* Ce qui ne se démontre QU'AU POINT D'ENTRÉE.
 *
 * Trois propriétés n'existent pas au niveau des services : l'ORDRE des gardes
 * (FeatureGuard avant AuthGuard), le STATUT réellement rendu (410 sur un lien
 * révoqué, 404 sur un drapeau éteint), et le fait que les surfaces publiques
 * répondent SANS jeton. Un appel de service ne montre rien de tout cela.
 */
describe("le Mur et la collecte — HTTP de bout en bout", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let userId: string;
  let token: string;
  let previousEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    db = await withDatabase();
    previousEnv = {
      DATABASE_URL: process.env.DATABASE_URL,
      OTP_PEPPER: process.env.OTP_PEPPER,
      JWT_SECRET: process.env.JWT_SECRET,
      LEHNO_MAIL_CONSOLE: process.env.LEHNO_MAIL_CONSOLE,
    };
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    // Adhésion explicite à la console de développement : sans identifiants
    // Resend ni cette variable, AppModule refuse de démarrer.
    process.env.LEHNO_MAIL_CONSOLE = "1";

    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 180_000);

  afterAll(async () => {
    await app.close();
    await db.close();
    for (const [cle, valeur] of Object.entries(previousEnv)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
  });

  const allumer = async (cles: string[]): Promise<void> => {
    await db.prisma.featureFlag.updateMany({ where: { key: { in: cles } }, data: { enabled: true } });
  };

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    // Les lignes de drapeaux sont recréées par resetDatabase : elles naissent
    // ÉTEINTES, comme sur un déploiement neuf. Chaque cas allume ce qu'il éprouve.
    await db.prisma.featureFlag.createMany({
      data: ["wall", "collect", "wishes"].map((key) => ({ key, enabled: false })),
      skipDuplicates: true,
    });
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWAMUR" },
    });
    userId = u.id;
    token = jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });
  });

  const get = (chemin: string, entetes: Record<string, string> = {}): Promise<Response> =>
    fetch(`${baseUrl}${chemin}`, { headers: entetes });

  const post = (chemin: string, corps: unknown, entetes: Record<string, string> = {}): Promise<Response> =>
    fetch(`${baseUrl}${chemin}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...entetes },
      body: JSON.stringify(corps),
    });

  const json = (res: Response): Promise<Record<string, unknown>> =>
    res.json() as Promise<Record<string, unknown>>;

  /* LE cas qui justifie l'ordre des gardes.
   *
   * Drapeau éteint, requête SANS jeton : la réponse doit être 404, pas 401. Si
   * AuthGuard passait en premier, le statut distinguerait « éteinte » de « non
   * authentifiée » — et raconterait ainsi que la surface existe. Inverser
   * `@UseGuards(FeatureGuard, AuthGuard)` fait tomber ce cas.
   */
  it("rend 404 sur une surface éteinte, même sans jeton", async () => {
    for (const chemin of ["/v1/me/wall", "/v1/me/collection-links", "/v1/me/received-wishes"]) {
      const res = await get(chemin);
      expect(res.status, chemin).toBe(404);
      expect((await json(res)).code, chemin).toBe("not_found");
    }
  });

  // Et l'inverse, qui compte autant : allumé, c'est bien l'authentification
  // qui refuse. Sans ce cas, un FeatureGuard qui refuserait toujours passerait
  // pour correct.
  it("rend 401 sur une surface allumée dont le jeton manque", async () => {
    await allumer(["wall"]);
    const res = await get("/v1/me/wall");
    expect(res.status).toBe(401);
    expect((await json(res)).code).toBe("unauthorized");
  });

  /* Garde la COUVERTURE exacte des drapeaux, qui n'est pas intuitive :
     `/me/wall/wish-link` prolonge le chemin du Mur mais relève de `wishes`.
     Avec `wall` seul, il doit rendre 404 — sinon le dépôt de vœux resterait
     ouvert quand on l'a fermé. */
  it("garde /me/wall/wish-link sous `wishes`, pas sous `wall`", async () => {
    await allumer(["wall"]);
    expect((await get("/v1/me/wall", { authorization: `Bearer ${token}` })).status).toBe(200);
    expect((await get("/v1/me/wall/wish-link", { authorization: `Bearer ${token}` })).status).toBe(404);
  });

  /* Garde la DÉPENDANCE `wishes` → `wall`, résolue côté serveur (§6.4).
     `wishes` allumé mais `wall` éteint doit rester fermé : le dépôt de vœux
     passe par le Mur, et sans Mur il n'y a pas de porte d'entrée. */
  it("laisse le dépôt de vœux fermé quand le Mur l'est", async () => {
    await allumer(["wishes"]);
    expect((await get("/v1/public/wishes/nimporte")).status).toBe(404);
    await allumer(["wall"]);
    // Allumé des deux côtés, c'est le jeton qui décide — et il est inconnu.
    const res = await get("/v1/public/wishes/nimporte");
    expect(res.status).toBe(404);
    expect((await json(res)).code).toBe("not_found");
  });

  // Garde le fait que les surfaces publiques répondent SANS session : aucun
  // AuthGuard ne doit s'y glisser, sinon toute la boucle d'acquisition tombe.
  it("sert le Mur public sans le moindre jeton", async () => {
    await allumer(["wall"]);
    await db.prisma.wall.create({ data: { userId, isEnabled: true } });
    const res = await get("/v1/public/walls/awa");
    expect(res.status).toBe(200);
    expect((await json(res)).username).toBe("awa");
  });

  /* Garde le 404 sur un pseudo MAL FORMÉ, et non un 400. Distinguer les deux
     dirait quelle forme est recevable, et un `../` ou un `%00` atteindrait la
     base tel quel si le pseudo n'était pas validé contre sa déclaration unique. */
  it("rend 404 sur un pseudo mal formé comme sur un pseudo inconnu", async () => {
    await allumer(["wall"]);
    for (const pseudo of ["ab", "..", "a".repeat(40), "avec%20espace"]) {
      const res = await get(`/v1/public/walls/${pseudo}`);
      expect(res.status, pseudo).toBe(404);
      expect((await json(res)).code, pseudo).toBe("not_found");
    }
  });

  /* Garde le STATUT 410 d'un lien révoqué — la propriété que seul le point
     d'entrée démontre. 404 ferait croire au visiteur qu'il a mal recopié une
     adresse qu'on lui a pourtant envoyée ; 410 dit « c'était là, ce n'est plus
     ouvert ». Et le jeton INCONNU, lui, reste en 404. */
  it("rend 410 sur un lien révoqué et 404 sur un jeton inconnu", async () => {
    await allumer(["collect"]);
    const lien = await db.prisma.collectionLink.create({
      data: { userId, type: "public", token: "jetondecollecte000000000ab" },
    });

    expect((await get(`/v1/public/collect/${lien.token}`)).status).toBe(200);

    await db.prisma.collectionLink.update({ where: { id: lien.id }, data: { isActive: false } });
    const revoque = await get(`/v1/public/collect/${lien.token}`);
    expect(revoque.status).toBe(410);
    expect((await json(revoque)).code).toBe("link_revoked");

    const inconnu = await get("/v1/public/collect/jetonquinexistepas0000000a");
    expect(inconnu.status).toBe(404);
    expect((await json(inconnu)).code).toBe("not_found");
  });

  /* Garde les BORNES au point d'entrée. Le service reçoit déjà une valeur
     typée ; c'est la route qui reçoit ce que le monde envoie, et sans le tuyau
     de validation un mot de deux mégaoctets entrerait en base. */
  it("refuse une contribution trop longue, avant d'écrire quoi que ce soit", async () => {
    await allumer(["collect"]);
    await db.prisma.collectionLink.create({
      data: { userId, type: "public", token: "jetondecollecte000000000cd" },
    });

    const res = await post("/v1/public/collect/jetondecollecte000000000cd", {
      personalNote: "x".repeat(2001),
    });
    expect(res.status).toBe(400);
    expect((await json(res)).code).toBe("validation_failed");
    expect(await db.prisma.submission.count()).toBe(0);
  });

  /* Garde le CHAMP LEURRE au contrat. S'il n'y figurait pas, le `.strict()` le
     refuserait en `validation_failed` — un code différent de celui du robot
     démasqué, ce qui apprendrait au robot que le champ existe et qu'il suffit
     de ne pas le remplir. Les deux filtres doivent rendre le MÊME code. */
  it("écarte le robot sous un seul code, jamais sous une erreur de validation", async () => {
    await allumer(["collect"]);
    await db.prisma.collectionLink.create({
      data: { userId, type: "public", token: "jetondecollecte000000000ef" },
    });

    const leurre = await post("/v1/public/collect/jetondecollecte000000000ef", {
      personalNote: "salut", website: "http://spam.example",
    });
    const tropVite = await post("/v1/public/collect/jetondecollecte000000000ef", {
      personalNote: "salut", renderedAt: Date.now(),
    });

    expect(leurre.status).toBe(422);
    expect(tropVite.status).toBe(422);
    const a = await json(leurre);
    const b = await json(tropVite);
    expect(a.code).toBe("collect_rejected");
    expect(b.code).toBe("collect_rejected");
    // Le message aussi : `toEnvelope` le rend tel quel, et deux libellés
    // distincts diraient lequel a mordu.
    expect(a.message).toBe(b.message);
    expect(await db.prisma.submission.count()).toBe(0);
  });

  // Garde le cloisonnement au point d'entrée : le Mur d'un autre compte se lit
  // par son adresse publique, jamais par le chemin privé de qui que ce soit.
  it("ne rend jamais le Mur d'un autre sous /me/wall", async () => {
    await allumer(["wall"]);
    const bila = await db.prisma.user.create({
      data: { email: "bila@example.com", username: "bila", referralCode: "BILAMUR" },
    });
    await db.prisma.wall.create({ data: { userId: bila.id, isEnabled: true, welcomeMessage: "chez Bila" } });

    const res = await get("/v1/me/wall", { authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    const corps = await json(res);
    expect(corps.slug).toBe("awa");
    expect(corps.welcomeMessage).toBeNull();
  });
});
