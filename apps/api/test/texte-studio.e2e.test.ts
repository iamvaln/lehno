import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  reglagesIdeesDeDepart, reglagesMessageDeDepart, reglagesBriefPortraitDeDepart,
  etatIdeesSchema, etatMessageSchema, historiqueIdeesSchema,
} from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AdminTokenService } from "../src/admin/admin-token.service.js";
import { AmorceStudioService } from "../src/studio/amorce.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/**
 * L'ATELIER DES TEXTES, par HTTP.
 *
 * PAR HTTP ET NON PAR LE SERVICE, et c'est le cœur du sujet. Ces routes
 * n'existaient pas : `StudioEssaiService.essayer` était écrit, testé, et branché
 * à AUCUN contrôleur. Un test qui construirait le service à la main serait vert
 * exactement comme il l'était hier — pendant qu'aucune route ne répondait.
 *
 * Ce qu'ils gardent : que les trois natures se lisent et s'écrivent chacune par
 * son chemin, qu'on ne puisse pas poster les réglages d'une nature sur le chemin
 * d'une autre, et que le support n'entre pas.
 */
describe("l'atelier des textes", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let jetons: AdminTokenService;
  let entete: Record<string, string>;

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

  afterAll(async () => { await app?.close(); await db.close(); });

  const session = async (role: "support" | "admin") => {
    const compte = await db.prisma.admin.create({
      data: { email: `${role}-${Date.now()}@lehno.app`, role },
    });
    const { accessToken } = await jetons.ouvrir(compte.id);
    return { authorization: `Bearer ${accessToken}` };
  };

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await app.get(AmorceStudioService).reconcilier();
    entete = await session("admin");
  });

  const appeler = (
    methode: string, suffixe: string, corps?: unknown, e: Record<string, string> = entete,
  ) =>
    fetch(`${baseUrl}/v1/admin/text-studio${suffixe}`, {
      method: methode,
      headers: { "content-type": "application/json", ...e },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });

  describe("la lecture", () => {
    it("sert chacune des trois natures par son chemin", async () => {
      for (const nature of ["message", "idees", "portrait_brief"]) {
        const res = await appeler("GET", `/${nature}/config`);
        expect(res.status, nature).toBe(200);
        const page = (await res.json()) as { enService: { reglages: unknown } | null };
        expect(page.enService, nature).not.toBeNull();
      }
    });

    /* LE CONTRAT AU CHAMP PRÈS. C'est la seule chose que l'API et l'atelier
       partagent : sans ce cas, renommer un champ ici ne se verrait qu'à
       l'écran. */
    it("suit le contrat publié, pour chaque nature", async () => {
      etatMessageSchema.parse(await (await appeler("GET", "/message/config")).json());
      etatIdeesSchema.parse(await (await appeler("GET", "/idees/config")).json());
      historiqueIdeesSchema.parse(await (await appeler("GET", "/idees/config/history")).json());
    });

    /* « portrait » est une nature de configuration, mais ce n'est PAS un texte :
       elle règle l'image, s'éprouve sur un modèle d'image, et a son propre
       atelier. La servir ici la ferait publier par le mauvais chemin. */
    it("refuse le portrait, qui n'est pas un texte", async () => {
      expect((await appeler("GET", "/portrait/config")).status).toBe(400);
      expect((await appeler("GET", "/inconnue/config")).status).toBe(400);
    });
  });

  describe("l'enregistrement direct", () => {
    /* IL N'ACCEPTE QUE CE QUI NE TOUCHE PAS AU MODÈLE. Sinon ce chemin serait la
       porte de service par laquelle on publie une consigne que personne n'a vue
       tourner. Ici, rien ne change : l'empreinte tient, et c'est accepté. */
    it("accepte une modification qui ne change pas l'empreinte", async () => {
      const res = await appeler("PATCH", "/idees/config", { reglages: reglagesIdeesDeDepart() });
      expect(res.status).toBe(200);
      const config = (await res.json()) as { etat: string };
      expect(config.etat).toBe("draft");
    });

    it("refuse une modification qui change ce que le modèle lit", async () => {
      const res = await appeler("PATCH", "/idees/config", {
        reglages: { ...reglagesIdeesDeDepart(), consigneCommune: "Restez concrets." },
      });
      expect(res.status).toBe(422);
      expect(((await res.json()) as { code: string }).code).toBe("trial_required");
    });

    /* LE PIÈGE DU CONTRÔLEUR UNIQUE, et la garde qui le tient. Sans elle, des
       réglages d'idées postés sur le chemin du message seraient enregistrés
       tels quels — et la configuration du message deviendrait illisible, la
       panne même qu'on vient de réparer ailleurs. */
    it("refuse les réglages d'une nature sur le chemin d'une autre", async () => {
      const res = await appeler("PATCH", "/message/config", {
        reglages: reglagesIdeesDeDepart(),
      });
      // 400 et non 422 : le corps est malformé pour ce chemin-là, ce n'est pas
      // une règle métier qui s'oppose — contrairement à `trial_required`.
      expect(res.status).toBe(400);
      expect(((await res.json()) as { code: string }).code).toBe("validation_failed");
    });

    it("refuse une clé de trop", async () => {
      const res = await appeler("PATCH", "/idees/config", {
        reglages: { ...reglagesIdeesDeDepart(), inattendu: true },
      });
      expect(res.status).toBe(400);
    });

    /* LES BORNES CROISÉES : un minimum de dix mots pour un maximum de trois ne
       rend pas un texte bizarre, il rend une consigne que le modèle ne peut pas
       satisfaire — et l'essai échoue sans qu'on comprenne pourquoi. */
    it("refuse des bornes de mots croisées", async () => {
      const res = await appeler("PATCH", "/portrait_brief/config", {
        reglages: { ...reglagesBriefPortraitDeDepart(), motsDuPortrait: { min: 10, max: 3 } },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("l'accès", () => {
    /* FERMÉ AU SUPPORT, Y COMPRIS EN LECTURE : lire montre la consigne en
       préparation, et chaque essai engage une dépense réelle. Même doctrine que
       l'atelier du portrait. */
    it("n'ouvre pas au support, même pour lire", async () => {
      const support = await session("support");
      expect((await appeler("GET", "/idees/config", undefined, support)).status).toBe(403);
    });

    it("n'ouvre pas sans jeton", async () => {
      expect((await appeler("GET", "/idees/config", undefined, {})).status).toBe(401);
    });
  });

  describe("la publication", () => {
    /* ELLE NE PORTE PAS LA NATURE, et c'est correct : elle vise une
       configuration par son identifiant, et c'est la ligne qui dit sa nature.
       La faire répéter au chemin ouvrirait la possibilité qu'elle contredise la
       ligne — et il faudrait alors décider laquelle ment. */
    it("refuse de publier ce qu'aucun essai n'a éprouvé", async () => {
      const brouillon = await db.prisma.studioConfig.create({
        data: {
          kind: "idees", state: "draft",
          settings: { ...reglagesIdeesDeDepart(), consigneCommune: "Jamais éprouvée." } as never,
          fingerprint: "empreinte-sans-essai",
        },
      });

      const res = await appeler("POST", "/config/publish", {
        configId: brouillon.id, note: "on tente sans essai",
      });
      expect(res.status).toBe(422);
      expect(((await res.json()) as { code: string }).code).toBe("trial_required");
    });

    it("publie un brouillon qu'un essai réussi couvre", async () => {
      const brouillon = await db.prisma.studioConfig.create({
        data: {
          kind: "idees", state: "draft",
          settings: { ...reglagesIdeesDeDepart(), consigneCommune: "Éprouvée." } as never,
          fingerprint: "empreinte-eprouvee",
        },
      });
      await db.prisma.studioTrial.create({
        data: {
          studioConfigId: brouillon.id, provider: "anthropic",
          modelKey: "claude-opus-5", status: "success",
        },
      });

      const res = await appeler("POST", "/config/publish", {
        configId: brouillon.id, note: "les idées se veulent plus concrètes",
      });
      expect(res.status).toBe(201);

      const enService = await db.prisma.studioConfig.findFirstOrThrow({
        where: { kind: "idees", state: "published" },
      });
      expect(enService.id).toBe(brouillon.id);
      // Le message n'a pas bougé : publier une nature n'en dépasse aucune autre.
      const message = await db.prisma.studioConfig.findFirstOrThrow({
        where: { kind: "message", state: "published" },
      });
      expect(message.settings).toEqual(reglagesMessageDeDepart());
    });
  });
});
