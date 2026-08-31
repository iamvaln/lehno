import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { pageAuditSchema, pageConnexionsSchema } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

describe("administration — les deux lectures de suivi", () => {
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

  const lire = (chemin: string, entete: Record<string, string>) =>
    fetch(`${baseUrl}/v1/admin/${chemin}`, { headers: entete });

  describe("le journal d'audit", () => {
    const CIBLE = "11111111-1111-4111-8111-111111111111";
    const AUTRE_CIBLE = "22222222-2222-4222-8222-222222222222";

    const consigner = (adminId: string, action: string, over: Record<string, unknown> = {}) =>
      db.prisma.auditLog.create({
        data: {
          actorType: "admin", actorId: adminId, action,
          reason: "Motif de démonstration", ...over,
        },
      });

    // « Le journal d'audit est réservé aux administrateurs — c'est ce qui lui
    // donne sa valeur de contrôle sur le travail de l'équipe » (ux-admin §6).
    // Le paquet de passation l'ouvrait au support ; c'est la spec qui tranche.
    it("est refusé au support", async () => {
      const { entete } = await session("support");
      expect((await lire("audit-log", entete)).status).toBe(403);
    });

    /**
     * « Sur chaque objet, l'historique des interventions est consultable depuis
     * son détail » (ux-admin §7).
     *
     * Le pied de fiche d'un compte a rendu pendant tout le premier lot le même
     * historique fabriqué pour tous : un défaut de props le fournissait, et
     * aucun filtre par cible n'existait pour le remplacer.
     */
    describe("filtré sur une cible", () => {
      it("ne rend que les gestes portés sur cet objet", async () => {
        const { compte, entete } = await session("admin");
        await consigner(compte.id, "user_status_update", { targetType: "user", targetId: CIBLE });
        await consigner(compte.id, "credit_adjustment", { targetType: "user", targetId: AUTRE_CIBLE });
        await consigner(compte.id, "parameter_update");

        const res = await lire(`audit-log?targetType=user&targetId=${CIBLE}`, entete);
        expect(res.status).toBe(200);
        const page = pageAuditSchema.parse(await res.json());
        expect(page.items).toHaveLength(1);
        expect(page.items[0]?.cibleId).toBe(CIBLE);
      });

      // Les deux colonnes portent chacune leur part. Le type d'abord : sans lui,
      // un identifiant partagé entre deux tables ramènerait des gestes portés
      // sur autre chose que ce qu'on regarde.
      it("le type de cible discrimine, à identifiant égal", async () => {
        const { compte, entete } = await session("admin");
        await consigner(compte.id, "user_status_update", { targetType: "user", targetId: CIBLE });
        await consigner(compte.id, "payment_decision", { targetType: "payment", targetId: CIBLE });

        const page = pageAuditSchema.parse(
          await (await lire(`audit-log?targetType=user&targetId=${CIBLE}`, entete)).json(),
        );
        expect(page.items).toHaveLength(1);
        expect(page.items[0]?.cibleType).toBe("user");
      });

      // L'identifiant ensuite : sans lui, deux comptes se confondraient, et la
      // fiche de l'un montrerait les gestes portés sur l'autre.
      it("l'identifiant discrimine, à type égal", async () => {
        const { compte, entete } = await session("admin");
        await consigner(compte.id, "user_status_update", { targetType: "user", targetId: CIBLE });
        await consigner(compte.id, "credit_adjustment", { targetType: "user", targetId: AUTRE_CIBLE });

        const page = pageAuditSchema.parse(await (await lire("audit-log?targetType=user", entete)).json());
        expect(page.items).toHaveLength(2);
      });

      // 400 et non 422 : la maison réserve le second aux refus métier, et
        // garde le premier pour un schéma qui ne tient pas.
      it("refuse un identifiant qui n'est pas un uuid", async () => {
        const { entete } = await session("admin");
        expect((await lire("audit-log?targetType=user&targetId=pas-un-uuid", entete)).status).toBe(400);
      });

      // Le filtre se combine à ceux qui existaient : documenter un incident,
      // c'est souvent « ce compte, ce mois-ci ».
      it("se combine à la période", async () => {
        const { compte, entete } = await session("admin");
        await consigner(compte.id, "user_status_update", {
          targetType: "user", targetId: CIBLE, createdAt: new Date("2026-01-01T00:00:00.000Z"),
        });
        await consigner(compte.id, "credit_adjustment", { targetType: "user", targetId: CIBLE });

        const depuis = new Date(Date.now() - 60_000).toISOString();
        const page = pageAuditSchema.parse(
          await (await lire(`audit-log?targetType=user&targetId=${CIBLE}&since=${depuis}`, entete)).json(),
        );
        expect(page.items).toHaveLength(1);
        expect(page.items[0]?.action).toBe("credit_adjustment");
      });
    });

    // Le contrat est la seule chose que les deux côtés partagent. Sans ce test,
    // le serveur peut renommer un champ sans que rien ne s'en aperçoive avant
    // l'écran.
    it("suit le contrat publié, au champ près", async () => {
      const { compte, entete } = await session("admin");
      await consigner(compte.id, "user_status_update");

      const corps = await (await lire("audit-log", entete)).json();

      const valide = pageAuditSchema.safeParse(corps);
      expect(valide.success ? null : valide.error.issues).toBeNull();
    });

    it("est lisible par un administrateur", async () => {
      const { compte, entete } = await session("admin");
      await consigner(compte.id, "user_status_update");

      const res = await lire("audit-log", entete);
      expect(res.status).toBe(200);
      const corps = (await res.json()) as { items: { action: string; motif: string }[] };
      expect(corps.items[0]?.action).toBe("user_status_update");
      expect(corps.items[0]?.motif).toBe("Motif de démonstration");
    });

    it("filtre par action et par auteur", async () => {
      const { compte, entete } = await session("admin");
      const autre = await db.prisma.admin.create({ data: { email: "dora@lehno.app", role: "admin" } });
      await consigner(compte.id, "user_status_update");
      await consigner(autre.id, "parameter_update");

      const parAction = (await (await lire("audit-log?action=parameter_update", entete)).json()) as { items: unknown[] };
      expect(parAction.items).toHaveLength(1);

      const parAuteur = (await (await lire(`audit-log?actorId=${autre.id}`, entete)).json()) as { items: unknown[] };
      expect(parAuteur.items).toHaveLength(1);
    });

    it("rend le plus récent en tête", async () => {
      const { compte, entete } = await session("admin");
      await consigner(compte.id, "ancien", { createdAt: new Date(Date.now() - 60_000) });
      await consigner(compte.id, "recent");

      const corps = (await (await lire("audit-log", entete)).json()) as { items: { action: string }[] };
      expect(corps.items.map((e) => e.action)).toEqual(["recent", "ancien"]);
    });

    // Une trace qui fait foi ne se modifie ni ne s'efface : la section est en
    // lecture seule, et il n'existe aucun chemin d'écriture depuis l'extérieur.
    it("n'offre aucune écriture", async () => {
      const { entete } = await session("admin");
      for (const methode of ["POST", "PATCH", "DELETE"]) {
        const res = await fetch(`${baseUrl}/v1/admin/audit-log`, { method: methode, headers: entete });
        expect(res.status).toBe(404);
      }
    });
  });

  describe("les connexions", () => {
    const tenter = (result: "success" | "failure", over: Record<string, unknown> = {}) =>
      db.prisma.loginActivity.create({
        data: { result, attemptedEmail: "awa@example.com", ...over },
      });

    it("suivent le contrat publié, au champ près", async () => {
      const { entete } = await session("admin");
      await tenter("failure");
      await tenter("success", { userAgent: "Chrome — macOS", geoApprox: "Douala, CM" });

      const corps = await (await lire("login-activity", entete)).json();

      const valide = pageConnexionsSchema.safeParse(corps);
      expect(valide.success ? null : valide.error.issues).toBeNull();
    });

    // « Consulter le tableau de bord, les métriques, les connexions » appartient
    // au support (ux-admin §6) : c'est ce qu'on regarde pour répondre à
    // quelqu'un qui n'arrive pas à entrer.
    it("sont lisibles par le support", async () => {
      const { entete } = await session("support");
      await tenter("failure");

      const res = await lire("login-activity", entete);
      expect(res.status).toBe(200);
      const corps = (await res.json()) as { items: { resultat: string }[] };
      expect(corps.items[0]?.resultat).toBe("failure");
    });

    it("filtrent par résultat", async () => {
      const { entete } = await session("support");
      await tenter("success");
      await tenter("failure");

      const corps = (await (await lire("login-activity?result=failure", entete)).json()) as { items: { resultat: string }[] };
      expect(corps.items.map((l) => l.resultat)).toEqual(["failure"]);
    });

    it("filtrent par période", async () => {
      const { entete } = await session("support");
      await tenter("success", { createdAt: new Date("2026-01-01T00:00:00Z") });
      await tenter("failure");

      const corps = (await (await lire("login-activity?since=2026-06-01T00:00:00.000Z", entete)).json()) as { items: unknown[] };
      expect(corps.items).toHaveLength(1);
    });
  });
});
