import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Controller, Get, Module, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { CLES_DRAPEAUX } from "@lehno/contracts";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { FlagsService } from "../src/flags/flags.service.js";
import { Feature } from "../src/flags/feature.decorator.js";
import { FeatureGuard } from "../src/flags/feature.guard.js";
import { AuthGuard } from "../src/auth/auth.guard.js";
import { TokenService } from "../src/auth/token.service.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { UseGuards } from "@nestjs/common";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

// Un contrôleur d'essai, gardé par un vrai drapeau du registre.
//
// Aucune route du serveur ne porte encore @Feature : toutes les surfaces à
// drapeau — Mur, souhaits, générations, crédits — restent à construire, et les
// proches relèvent du socle, qui n'a pas de drapeau. Sans ce contrôleur, le
// garde n'aurait plus aucun usage éprouvé et pourrirait jusqu'au jour où on
// s'appuierait dessus pour de bon. C'est exactement le genre de protection qui
// cesse de protéger sans que rien ne rougisse.
@Controller("essai/mur")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("wall")
class ControleurDEssai {
  @Get()
  lire(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  controllers: [ControleurDEssai],
  providers: [
    PrismaService, FlagsService, FeatureGuard, AuthGuard, TokenService,
    { provide: "JWT_SECRET", useFactory: () => process.env.JWT_SECRET },
  ],
})
class ModuleDEssai {}

describe("drapeaux de fonctionnalité", () => {
  let db: TestDb;
  let service: FlagsService;

  const compte = async (): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    return u.id;
  };

  const allumer = async (...cles: string[]): Promise<void> => {
    for (const key of cles) {
      await db.prisma.featureFlag.upsert({
        where: { key }, update: { enabled: true }, create: { key, enabled: true },
      });
    }
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    service = new FlagsService(db.prisma as never);
  });

  // Une ligne absente vaut éteint : même règle que le reste du projet (pas de
  // domaine configuré -> aucune origine CORS autorisée).
  it("une ligne absente vaut éteint", async () => {
    expect(await service.estActif("wall")).toBe(false);
  });

  it("un drapeau allumé sans prérequis est actif", async () => {
    await allumer("wall");
    expect(await service.estActif("wall")).toBe(true);
  });

  describe("les dépendances se résolvent côté serveur", () => {
    // §6.4 : « wall éteint emporte wishes et reservation ». Le dépôt de vœux
    // passe par le Mur — allumer wishes sans le Mur ne lui donne aucune porte
    // d'entrée, et le laisser actif ferait afficher au client une surface que
    // le serveur refusera.
    it("« wishes » allumé reste inactif si « wall » est éteint", async () => {
      await allumer("wishes");
      expect(await service.estActif("wishes")).toBe(false);
      await allumer("wall");
      expect(await service.estActif("wishes")).toBe(true);
    });

    // La réservation exige les DEUX, et c'est écrit ainsi dans la
    // spécification : elle passe par le Mur, et sans liste partagée il n'y a
    // plus rien à réserver.
    it("« reservation » exige « wall » ET « wishlist.own »", async () => {
      await allumer("reservation", "wall");
      expect(await service.estActif("reservation")).toBe(false);
      await allumer("wishlist.own");
      expect(await service.estActif("reservation")).toBe(true);
    });

    // Le piège que §6.4 signale elle-même. Éteindre l'achat ne doit pas
    // éteindre le produit : les générations restent disponibles et gratuites.
    // Une dépendance ajoutée ici par réflexe couperait la génération à tout le
    // monde le jour où le paiement tombe.
    it("« credits » éteint laisse les générations actives", async () => {
      await allumer("generation.message", "generation.ideas", "generation.portrait");
      expect(await service.estActif("generation.message")).toBe(true);
      expect(await service.estActif("generation.ideas")).toBe(true);
      expect(await service.estActif("generation.portrait")).toBe(true);
      expect(await service.estActif("credits")).toBe(false);
    });
  });

  describe("la réconciliation au démarrage", () => {
    it("insère les treize clés du registre, éteintes", async () => {
      await service.reconcilier();
      const lignes = await db.prisma.featureFlag.findMany();
      expect(lignes.map((l) => l.key).sort()).toEqual([...CLES_DRAPEAUX].sort());
      expect(lignes.every((l) => l.enabled === false)).toBe(true);
    });

    // Sans quoi un déploiement rallumerait — ou éteindrait — ce qu'un humain
    // avait réglé en administration.
    it("n'écrase jamais un état existant", async () => {
      await allumer("wall");
      await service.reconcilier();
      expect(await service.estActif("wall")).toBe(true);
    });
  });

  describe("le garde, sur une route gardée", () => {
    let app: INestApplication;
    let baseUrl: string;
    let precedent: Record<string, string | undefined>;

    beforeAll(async () => {
      precedent = {
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
      };
      process.env.DATABASE_URL = db.url;
      process.env.JWT_SECRET = SECRET;

      app = await NestFactory.create(ModuleDEssai, { logger: false, abortOnError: false });
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

    const jeton = async (): Promise<string> =>
      jwt.sign({ sub: await compte() }, SECRET, { algorithm: "HS256", expiresIn: 900 });

    // Avec un jeton VALABLE : seul moyen de prouver que c'est le drapeau qui
    // a répondu, et non l'authentification.
    it("rend 404 quand le drapeau est éteint, jeton valable", async () => {
      const r = await fetch(`${baseUrl}/v1/essai/mur`, {
        headers: { authorization: `Bearer ${await jeton()}` },
      });
      expect(r.status).toBe(404);
    });

    // Même statut sans jeton du tout : la réponse ne doit pas distinguer
    // « éteinte » de « non authentifiée », sinon elle raconte que la
    // fonctionnalité existe.
    it("rend 404 quand le drapeau est éteint, sans jeton", async () => {
      const r = await fetch(`${baseUrl}/v1/essai/mur`);
      expect(r.status).toBe(404);
    });

    // Sans ce cas, un garde qui refuserait TOUT serait vert sur les deux
    // précédents.
    it("laisse passer quand le drapeau est allumé", async () => {
      await allumer("wall");
      const r = await fetch(`${baseUrl}/v1/essai/mur`, {
        headers: { authorization: `Bearer ${await jeton()}` },
      });
      expect(r.status).toBe(200);
    });

    // Le drapeau est allumé, donc le garde laisse passer — et c'est
    // l'authentification qui refuse. Prouve que le garde de drapeau ne
    // court-circuite pas AuthGuard : il passe AVANT, il ne le remplace pas.
    it("drapeau allumé, sans jeton : 401, pas 200", async () => {
      await allumer("wall");
      const r = await fetch(`${baseUrl}/v1/essai/mur`);
      expect(r.status).toBe(401);
    });
  });

  describe("les listes résolues, en HTTP", () => {
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
      };
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
      for (const [cle, valeur] of Object.entries(precedent)) {
        if (valeur === undefined) delete process.env[cle];
        else process.env[cle] = valeur;
      }
    });

    // La forme compte autant que le contenu : une LISTE de ce qui est actif,
    // jamais un dictionnaire clé → booléen. Avec un dictionnaire, le client
    // distinguerait « éteint » d'« inconnu » ; ici les deux se confondent, et
    // c'est ce qui permettra d'activer par compte sans rien changer chez lui.
    it("/public/features rend une liste, pas un état brut", async () => {
      await allumer("launch.live");
      const r = await fetch(`${baseUrl}/v1/public/features`);
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { features: string[] };
      expect(Array.isArray(corps.features)).toBe(true);
      expect(corps.features).toContain("launch.live");
      expect(corps).not.toHaveProperty("launch.live");
    });

    // Un drapeau d'application n'a rien à faire sur une surface sans compte :
    // l'exposer annoncerait au monde ce qu'on prépare.
    it("/public/features ne laisse pas fuiter un drapeau d'application", async () => {
      await allumer("credits", "generation.portrait", "launch.live");
      const r = await fetch(`${baseUrl}/v1/public/features`);
      const corps = (await r.json()) as { features: string[] };
      expect(corps.features).not.toContain("credits");
      expect(corps.features).not.toContain("generation.portrait");
      expect(corps.features).toContain("launch.live");
    });

    it("/public/features n'expose pas ce qui est éteint", async () => {
      const r = await fetch(`${baseUrl}/v1/public/features`);
      const corps = (await r.json()) as { features: string[] };
      expect(corps.features).toEqual([]);
    });

    it("/me/features exige une session", async () => {
      const r = await fetch(`${baseUrl}/v1/me/features`);
      expect(r.status).toBe(401);
    });

    it("/me/features rend les capacités d'application actives", async () => {
      await allumer("wall", "credits", "launch.live");
      const token = jwt.sign({ sub: await compte() }, SECRET, {
        algorithm: "HS256", expiresIn: 900,
      });
      const r = await fetch(`${baseUrl}/v1/me/features`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(r.status).toBe(200);
      const corps = (await r.json()) as { features: string[] };
      expect(corps.features).toContain("wall");
      expect(corps.features).toContain("credits");
      // launch.live n'a de sens que sur la landing : sa portée est publique.
      expect(corps.features).not.toContain("launch.live");
    });

    // La résolution s'applique AVANT l'envoi : le client n'a aucune règle à
    // connaître. S'il recevait « wishes » actif alors que le Mur est éteint,
    // il afficherait une surface que le serveur refuse.
    it("les listes rendues sont déjà résolues", async () => {
      await allumer("wishes");
      const r = await fetch(`${baseUrl}/v1/public/features`);
      const corps = (await r.json()) as { features: string[] };
      expect(corps.features).not.toContain("wishes");
    });
  });
});
