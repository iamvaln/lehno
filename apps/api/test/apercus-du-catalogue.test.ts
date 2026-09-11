import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import {
  catalogueServi, clesDApercu, studioOptionsSchema,
  reglagesMessageDeDepart, reglagesPortraitDeDepart,
  type ReglagesPortrait,
} from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AmorceStudioService } from "../src/studio/amorce.service.js";
import { StudioConfigurationService } from "../src/studio/configuration.service.js";
import { StudioEssaiService } from "../src/studio/essai.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/**
 * LES VIGNETTES DU CATALOGUE — design du portrait mobile, §A.
 *
 * « Un choix de rendu ne se fait pas avec des mots : personne ne sait départager
 * "chaleureux" et "sobre" dans l'abstrait. » L'écran montre donc l'image qu'on
 * aura — la même pour tout le monde, publiée avec la configuration.
 *
 * Ces cas gardent les trois choses qui rendent ça tenable : la vignette
 * n'est PAS engendrée à la volée (elle vient d'un essai déjà payé), elle n'entre
 * PAS dans l'empreinte (sinon publier une miniature coûterait une génération),
 * et son absence n'est PAS une panne (la grille retombe sur la description).
 */
describe("les vignettes du catalogue", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let configs: StudioConfigurationService;
  let essais: StudioEssaiService;
  let jeton: string;

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
    configs = app.get(StudioConfigurationService);
    essais = app.get(StudioEssaiService);
  }, 180_000);

  afterAll(async () => { await app?.close(); await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await app.get(AmorceStudioService).reconcilier();
    await db.prisma.premiumAction.createMany({
      data: [{ code: "portrait", label: "Un portrait", creditCost: 1 }],
      skipDuplicates: true,
    });
    await db.prisma.featureFlag.upsert({
      where: { key: "generation.portrait" },
      create: { key: "generation.portrait", enabled: true },
      update: { enabled: true },
    });
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa_vign", referralCode: "AWAVIGN" },
    });
    jeton = jwt.sign({ sub: u.id }, SECRET, { algorithm: "HS256", expiresIn: 900 });
  });

  const options = () =>
    fetch(`${baseUrl}/v1/me/studio/options`, { headers: { authorization: `Bearer ${jeton}` } });

  /** Poser une vignette dans la configuration en service, sans passer par un essai. */
  const publierAvecVignette = async (cle: string) => {
    const enService = await db.prisma.studioConfig.findFirstOrThrow({
      where: { kind: "portrait", state: "published" },
    });
    const r = configs.reglagesPortraitDe(enService);
    const avec: ReglagesPortrait = {
      ...r,
      ambiances: r.ambiances.map((a) => (a.id === "nature" ? { ...a, apercuCle: cle } : a)),
    };
    await db.prisma.studioConfig.update({
      where: { id: enService.id }, data: { settings: avec as never },
    });
  };

  describe("le contrat", () => {
    /* L'ÉTAT NORMAL D'UN CATALOGUE NEUF. Personne n'a encore retenu d'essai, et
       l'écran doit s'ouvrir quand même — la grille retombe sur la description.
       Une vignette absente n'est pas une panne. */
    it("sert des vignettes nulles quand rien n'a été retenu", async () => {
      const res = await options();
      expect(res.status).toBe(200);
      const page = studioOptionsSchema.parse(await res.json());
      const tous = page.catalogue.groups.flatMap((g) => g.choices);
      expect(tous.length).toBeGreaterThan(0);
      expect(tous.every((c) => c.previewUrl === null)).toBe(true);
    });

    it("sert une URL signée dès qu'une référence est publiée", async () => {
      await publierAvecVignette("portraits/une-cle-de-test");

      const page = studioOptionsSchema.parse(await (await options()).json());
      const nature = page.catalogue.groups
        .flatMap((g) => g.choices).find((c) => c.id === "nature");

      /* UNE ADRESSE RÉSOLUE, jamais la clé nue. On n'affirme pas le schéma
         d'URL : le stockage d'essai rend `memoire://…` là où R2 signe du
         `https://`. Ce qui compte est que le port ait été appelé — la clé seule
         ne s'affiche pas dans une balise image. */
      expect(nature?.previewUrl).toBeTruthy();
      expect(nature?.previewUrl).not.toBe("portraits/une-cle-de-test");
      expect(nature?.previewUrl).toContain("portraits/une-cle-de-test");
      expect(nature?.previewUrl).toMatch(/:\/\//);
    });

    /* « C'est le PROPOS, pas le rendu. Rien à montrer. » Le champ existe sur
       tous les choix, mais l'orientation ne le remplit jamais. */
    it("ne montre rien pour une orientation", async () => {
      const page = studioOptionsSchema.parse(await (await options()).json());
      const orientation = page.catalogue.groups.find((g) => g.id === "orientation");
      expect(orientation?.choices.every((c) => c.previewUrl === null)).toBe(true);
    });
  });

  describe("l'empreinte", () => {
    /* LE CAS QUI DÉCIDE DE TOUT. Si la vignette entrait dans l'empreinte,
       choisir une miniature ferait retomber toute la couverture d'essais, et il
       faudrait payer une génération pour publier une image déjà produite. */
    it("ne bouge pas quand on pose une vignette", () => {
      const r = reglagesPortraitDeDepart();
      const avec: ReglagesPortrait = {
        ...r,
        ambiances: r.ambiances.map((a) => ({ ...a, apercuCle: "portraits/x" })),
      };
      expect(configs.empreinte("portrait", avec)).toBe(configs.empreinte("portrait", r));
    });
  });

  describe("la composition du catalogue", () => {
    /* Une clé qu'on n'a pas su signer sort NULLE plutôt que de fermer l'écran :
       le studio ne doit pas dépendre de la santé du stockage pour des images
       qui ne sont qu'un confort de choix. */
    it("rend une vignette nulle quand la clé n'a pas pu être signée", () => {
      const r = reglagesPortraitDeDepart();
      const avec: ReglagesPortrait = {
        ...r,
        ambiances: r.ambiances.map((a) => (a.id === "nature" ? { ...a, apercuCle: "k" } : a)),
      };
      const c = catalogueServi(reglagesMessageDeDepart(), avec, "fr", new Map());
      const nature = c.groups.flatMap((g) => g.choices).find((x) => x.id === "nature");
      expect(nature?.previewUrl).toBeNull();
    });

    it("ne relève que les clés posées, sans doublon", () => {
      const r = reglagesPortraitDeDepart();
      const avec: ReglagesPortrait = {
        ...r,
        ambiances: r.ambiances.map((a) => ({ ...a, apercuCle: "meme-cle" })),
        compositions: r.compositions.map((c) => ({ ...c, apercuCle: "autre" })),
      };
      expect(clesDApercu(avec).sort()).toEqual(["autre", "meme-cle"]);
      expect(clesDApercu(r)).toEqual([]);
    });
  });

  describe("retenir un essai comme référence", () => {
    const essai = async (sur: Record<string, unknown> = {}) => {
      const config = await db.prisma.studioConfig.findFirstOrThrow({
        where: { kind: "portrait", state: "published" },
      });
      return db.prisma.studioTrial.create({
        data: {
          studioConfigId: config.id, provider: "openai", modelKey: "gpt-image-2",
          status: "success", ambianceId: "nature",
          output: { cle: "portraits/celle-ci" } as never,
          ...sur,
        },
      });
    };

    it("pose la clé de son image sur son ambiance", async () => {
      const t = await essai();
      await essais.juger(t.id, "kept", true);

      /* UN BROUILLON, jamais la version en service : la vignette suit la version
         publiée comme le reste du catalogue. */
      const brouillon = await db.prisma.studioConfig.findFirstOrThrow({
        where: { kind: "portrait", state: "draft" },
      });
      const r = configs.reglagesPortraitDe(brouillon);
      expect(r.ambiances.find((a) => a.id === "nature")?.apercuCle).toBe("portraits/celle-ci");
      // Les autres n'ont pas bougé.
      expect(r.ambiances.find((a) => a.id === "animal")?.apercuCle).toBeNull();
    });

    /* Ce que voit l'utilisateur ne change PAS tant que personne n'a publié. */
    it("ne change rien pour l'utilisateur avant publication", async () => {
      const t = await essai();
      await essais.juger(t.id, "kept", true);

      const page = studioOptionsSchema.parse(await (await options()).json());
      const nature = page.catalogue.groups
        .flatMap((g) => g.choices).find((c) => c.id === "nature");
      expect(nature?.previewUrl).toBeNull();
    });

    /* Montrer comme référence ce qu'on vient d'écarter serait montrer au client
       exactement ce qu'on a refusé. */
    it("refuse de représenter une ambiance avec un essai écarté", async () => {
      const t = await essai();
      await expect(essais.juger(t.id, "discarded", true)).rejects.toThrow();
    });

    it("refuse un essai qui n'a produit aucune image", async () => {
      const t = await essai({ output: { message: "un texte" } as never });
      await expect(essais.juger(t.id, "kept", true)).rejects.toThrow();
    });

    it("refuse un essai en échec", async () => {
      const t = await essai({ status: "error", output: undefined });
      await expect(essais.juger(t.id, "kept", true)).rejects.toThrow();
    });

    /* L'ORDRE COMPTE : le dépôt d'abord, le verdict ensuite. Sinon un essai
       resterait « retenu » sans la vignette demandée, et la moitié du geste
       aurait échoué en silence. */
    it("laisse le verdict intact quand la référence est refusée", async () => {
      const t = await essai({ output: { message: "un texte" } as never });
      await expect(essais.juger(t.id, "kept", true)).rejects.toThrow();

      const apres = await db.prisma.studioTrial.findUniqueOrThrow({ where: { id: t.id } });
      expect(apres.verdict).toBeNull();
    });

    it("juge normalement quand on ne demande pas de référence", async () => {
      const t = await essai();
      await essais.juger(t.id, "kept");
      const apres = await db.prisma.studioTrial.findUniqueOrThrow({ where: { id: t.id } });
      expect(apres.verdict).toBe("kept");
      expect(await db.prisma.studioConfig.count({ where: { kind: "portrait", state: "draft" } }))
        .toBe(0);
    });
  });
});
