import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
// AdminTokenService refuse de démarrer sans sa propre clé, même si ce fichier
// ne touche jamais l'administration — voir security-http.e2e.test.ts.
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/* UN COMPTE EN SUPPRESSION NE SE COMPORTE PAS COMME UN COMPTE ACTIF.
 *
 * Le piège que ce fichier garde tient à la nature du jeton d'accès : il est
 * AUTOPORTANT, sa validité se lit dans sa signature et jamais en base. Un
 * jeton émis avant la confirmation reste donc parfaitement valide pendant
 * quinze minutes après — et pendant ces quinze minutes, un compte qu'on vient
 * de mettre en suppression pourrait continuer à dépenser ses crédits, avec un
 * solde dont on vient peut-être d'enregistrer le remboursement.
 *
 * `/auth/otp` et `/auth/federated` refusaient déjà ces comptes à l'entrée. Ne
 * garder que cette porte-là revenait à verrouiller la serrure en laissant la
 * fenêtre ouverte à qui est déjà dedans. C'est pourquoi la vérification vit
 * dans AuthGuard : elle couvre alors TOUTE surface authentifiée, y compris
 * celles qu'une autre session écrira demain sans avoir lu ce fichier.
 *
 * D'où les cas ci-dessous : ils portent sur des chemins d'AUTRES chantiers
 * (le profil, les proches, les crédits) plutôt que sur ceux de la suppression.
 * Un test qui n'éprouverait que /me/account laisserait passer exactement la
 * régression qu'on craint — quelqu'un qui déplace la vérification du garde
 * vers les contrôleurs du compte.
 */
describe("un compte en suppression ne peut plus rien faire", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let userId: string;
  let token: string;

  beforeAll(async () => {
    db = await withDatabase();
    process.env.DATABASE_URL = db.url;
    process.env.OTP_PEPPER = PEPPER;
    process.env.JWT_SECRET = SECRET;
    process.env.ADMIN_JWT_SECRET = SECRET_ADMIN;
    process.env.LEHNO_MAIL_CONSOLE = "1";

    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix("v1");
    app.useGlobalFilters(new AppExceptionFilter());
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await db.close();
  });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa_actif", referralCode: "AWAACT" },
    });
    userId = u.id;
    // Jeton signé directement : pas besoin de rejouer le parcours OTP pour
    // éprouver le garde, et surtout, ce jeton est émis AVANT la mise en
    // suppression — c'est exactement la situation à couvrir.
    token = jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });
  });

  function get(path: string): Promise<Response> {
    return fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });
  }

  async function mettreEnSuppression(): Promise<void> {
    await db.prisma.user.update({
      where: { id: userId },
      data: { status: "pending_deletion", deletionRequestedAt: new Date() },
    });
  }

  /* Le témoin. Sans lui, tous les cas ci-dessous passeraient aussi bien si le
     garde refusait TOUT LE MONDE — et on ne le saurait pas. */
  it("laisse passer un compte actif", async () => {
    expect((await get("/v1/me/profile")).status).toBe(200);
  });

  /* Le piège gardé : un jeton émis AVANT la confirmation, employé APRÈS. Sans
     la lecture d'état dans le garde, il ouvrirait encore toutes les portes
     pendant un quart d'heure. */
  it("refuse un jeton émis avant la confirmation, sur une surface d'un autre chantier", async () => {
    await mettreEnSuppression();

    const res = await get("/v1/me/profile");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "account_pending_deletion" });
  });

  it("refuse aussi la lecture des proches et celle des crédits", async () => {
    await mettreEnSuppression();

    for (const chemin of ["/v1/me/persons", "/v1/me/credits"]) {
      const res = await get(chemin);
      expect(res.status, chemin).toBe(403);
      expect(await res.json(), chemin).toMatchObject({ code: "account_pending_deletion" });
    }
  });

  /* Le piège gardé : le code d'erreur lui-même. 403 avec
     `account_pending_deletion` est ce que le contrat publié annonce, et c'est
     lui qui permet au client de montrer le bon écran — « votre compte est en
     cours de suppression, écrivez-nous pour revenir » — plutôt qu'un
     déconnecté générique qui inviterait à se reconnecter en boucle. */
  it("rend 403 et non 401 : le compte existe, il n'est pas utilisable", async () => {
    await mettreEnSuppression();
    const res = await get("/v1/me/profile");
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(403);
  });

  /* Le piège gardé : un compte SUSPENDU par la modération gardait lui aussi
     un quart d'heure d'accès complet. Même cause, même remède — et le garde
     refuse par défaut tout état qui n'est pas `active`, pour qu'un statut
     ajouté demain arrive fermé plutôt qu'ouvert. */
  it("refuse également un compte suspendu", async () => {
    await db.prisma.user.update({ where: { id: userId }, data: { status: "suspended" } });

    const res = await get("/v1/me/profile");
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "account_suspended" });
  });

  it("refuse un compte déjà effacé, sans lui inventer de code particulier", async () => {
    await db.prisma.user.update({ where: { id: userId }, data: { status: "deleted" } });

    const res = await get("/v1/me/profile");
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "unauthorized" });
  });
});
