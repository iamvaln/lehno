import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { profilAdminSchema } from "@lehno/contracts";
import jwt from "jsonwebtoken";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/**
 * « Mon profil » — le compte connecté et ses sessions ouvertes.
 *
 * L'écran existait depuis le premier lot et rendait une fixture : un e-mail,
 * un rôle et des sessions inventés, avec leurs adresses IP. Un administrateur
 * qui venait y fermer une session fermait quelque chose qui n'existait pas.
 */
describe("administration — mon profil", () => {
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

  const compteAvecSession = async (
    role: "support" | "admin",
    userAgent?: string,
    ip?: string,
    email = `${role}@lehno.app`,
  ) => {
    const compte = await db.prisma.admin.findUnique({ where: { email } })
      ?? await db.prisma.admin.create({ data: { email, role } });
    const paire = await jetons.ouvrir(compte.id, userAgent, ip);
    return { compte, paire, entete: { authorization: `Bearer ${paire.accessToken}` } };
  };

  /** Un jeton d'accès tel qu'on en signait avant que la lignée y voyage. */
  const jetonSansLignee = (adminId: string) =>
    jwt.sign({ sub: adminId, typ: "adm" }, SECRET_ADMIN, { expiresIn: 600, algorithm: "HS256" });

  const lire = (entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/admin/me`, { headers: { "content-type": "application/json", ...entete } });

  it("rend le compte connecté, conforme au contrat", async () => {
    const { entete } = await compteAvecSession("support");
    const res = await lire(entete);
    expect(res.status).toBe(200);
    expect(profilAdminSchema.parse(await res.json()).email).toBe("support@lehno.app");
  });

  // La section n'est pas réservée : chacun a le droit de voir son propre
  // compte, et un support qui ne peut pas fermer ses sessions n'a aucun moyen
  // de réagir à un appareil perdu.
  it("s'ouvre aux deux rôles — c'est son propre compte qu'on regarde", async () => {
    expect((await lire((await compteAvecSession("support")).entete)).status).toBe(200);
    expect((await lire((await compteAvecSession("admin")).entete)).status).toBe(200);
  });

  it("ne rend que ses propres sessions, jamais celles d'un autre compte", async () => {
    const mien = await compteAvecSession("admin", "Firefox", "10.0.0.1");
    await compteAvecSession("support", "Chrome", "10.0.0.2");

    const profil = profilAdminSchema.parse(await (await lire(mien.entete)).json());
    expect(profil.sessions).toHaveLength(1);
    expect(profil.sessions[0]?.ip).toBe("10.0.0.1");
  });

  // Le cœur de l'écran : savoir laquelle des sessions ouvertes est celle d'où
  // l'on regarde. Sans elle, « fermer les autres sessions » fermerait la
  // sienne, et la pastille « ici » se poserait au hasard.
  it("désigne la session d'où vient l'appel, et elle seule", async () => {
    const { compte, entete } = await compteAvecSession("admin", "Firefox", "10.0.0.1");
    await jetons.ouvrir(compte.id, "Chrome", "10.0.0.2");
    await jetons.ouvrir(compte.id, "Safari", "10.0.0.3");

    const profil = profilAdminSchema.parse(await (await lire(entete)).json());
    expect(profil.sessions).toHaveLength(3);
    const courantes = profil.sessions.filter((s) => s.courante);
    expect(courantes).toHaveLength(1);
    expect(courantes[0]?.ip).toBe("10.0.0.1");
  });

  it("ne rend pas une session révoquée", async () => {
    const { compte, entete } = await compteAvecSession("admin");
    const autre = await jetons.ouvrir(compte.id, "Chrome");
    await db.prisma.adminRefreshToken.updateMany({
      where: { adminId: compte.id, userAgent: "Chrome" },
      data: { revokedAt: new Date() },
    });
    void autre;

    const profil = profilAdminSchema.parse(await (await lire(entete)).json());
    expect(profil.sessions).toHaveLength(1);
  });

  it("ne rend pas une session expirée", async () => {
    const { compte, entete } = await compteAvecSession("admin");
    await jetons.ouvrir(compte.id, "Chrome");
    await db.prisma.adminRefreshToken.updateMany({
      where: { adminId: compte.id, userAgent: "Chrome" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const profil = profilAdminSchema.parse(await (await lire(entete)).json());
    expect(profil.sessions).toHaveLength(1);
  });

  // Une session, c'est une famille de jetons — pas un jeton. L'échange en crée
  // un nouveau et consomme l'ancien ; compter les jetons ferait apparaître une
  // session de plus à chaque rafraîchissement.
  it("un rafraîchissement ne fait pas apparaître une session de plus", async () => {
    const { paire } = await compteAvecSession("admin", "Firefox");
    const echange = await jetons.tourner(paire.refreshToken, "Firefox");

    const profil = profilAdminSchema.parse(await (await lire({
      authorization: `Bearer ${echange.accessToken}`,
    })).json());
    expect(profil.sessions).toHaveLength(1);
    expect(profil.sessions[0]?.courante).toBe(true);
  });

  // L'écran offre « fermer les autres sessions » depuis le premier lot. Sans
  // ce point d'entrée, le bouton retirait les lignes du tableau et laissait les
  // sessions ouvertes : il montrait un geste qu'il ne faisait pas.
  describe("fermer les autres sessions", () => {
    const fermer = (entete: Record<string, string>) =>
      fetch(`${baseUrl}/v1/admin/me/sessions`, { method: "DELETE", headers: entete });

    it("ferme les autres et garde la sienne", async () => {
      const { compte, entete } = await compteAvecSession("admin", "Firefox", "10.0.0.1");
      await jetons.ouvrir(compte.id, "Chrome");
      await jetons.ouvrir(compte.id, "Safari");

      expect((await fermer(entete)).status).toBe(200);

      const profil = profilAdminSchema.parse(await (await lire(entete)).json());
      expect(profil.sessions).toHaveLength(1);
      expect(profil.sessions[0]?.courante).toBe(true);
      expect(profil.sessions[0]?.appareil).toBe("Firefox");
    });

    // Le jeton long d'une session fermée ne doit plus rien ouvrir, sans quoi
    // l'appareil perdu reprendrait la main au prochain échange.
    it("le jeton long d'une session fermée ne s'échange plus", async () => {
      const { compte, entete } = await compteAvecSession("admin", "Firefox");
      const autre = await jetons.ouvrir(compte.id, "Chrome");

      await fermer(entete);

      await expect(jetons.tourner(autre.refreshToken, "Chrome")).rejects.toThrow();
    });

    it("ne touche pas aux sessions d'un autre compte", async () => {
      const mien = await compteAvecSession("admin", "Firefox");
      const sien = await compteAvecSession("support", "Chrome");

      await fermer(mien.entete);

      const profil = profilAdminSchema.parse(await (await lire(sien.entete)).json());
      expect(profil.sessions).toHaveLength(1);
    });

    // Un jeton émis avant que la lignée voyage dans la charge ne désigne aucune
    // session. Fermer « les autres » fermerait alors tout, y compris celle d'où
    // vient l'appel — on refuse plutôt que de déconnecter qui demandait.
    it("refuse quand l'appelant ne peut pas désigner sa propre session", async () => {
      const { compte, entete } = await compteAvecSession("admin", "Firefox");
      await jetons.ouvrir(compte.id, "Chrome");

      const res = await fermer({ authorization: `Bearer ${jetonSansLignee(compte.id)}` });

      // 401 et non 422 : la réponse dit au client d'échanger son jeton, et
      // l'échange lui en remettra un qui porte sa lignée. C'est le remède.
      expect(res.status).toBe(401);
      expect(((await res.json()) as { code: string }).code).toBe("session_expired");

      // Et surtout : le refus n'a rien fermé. Une garde qui refuse à moitié
      // serait pire que pas de garde du tout.
      const profil = profilAdminSchema.parse(await (await lire(entete)).json());
      expect(profil.sessions).toHaveLength(2);
    });

    it("refuse un appel sans jeton", async () => {
      expect((await fermer({})).status).toBe(401);
    });
  });

  it("refuse un appel sans jeton", async () => {
    expect((await lire({})).status).toBe(401);
  });

  // Le condensé du jeton long n'a rien à faire dans une réponse : c'est lui qui
  // ouvre la session, et le rendre reviendrait à la publier.
  it("ne laisse échapper aucun secret de session", async () => {
    const { entete } = await compteAvecSession("admin", "Firefox");
    const texte = await (await lire(entete)).text();
    expect(texte).not.toMatch(/tokenHash|token_hash|refreshToken/i);
  });
});
