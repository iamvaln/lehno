import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppExceptionFilter } from "../src/common/errors.js";
import { AmorceStudioService } from "../src/studio/amorce.service.js";
import { StudioConfigurationService } from "../src/studio/configuration.service.js";
import {
  ORIENTATIONS, studioOptionsSchema, reglagesPortraitDeDepart,
  type ReglagesPortrait,
} from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/** Le code d'erreur de l'enveloppe. `Response.json()` rend `unknown` : le
 *  typer ici une fois évite un `as` à chaque assertion. */
const codeDe = async (res: Response): Promise<string | undefined> =>
  ((await res.json()) as { code?: string }).code;

/* `/me/studio/options` — « l'écran s'ouvre déjà réglé ».
 *
 * Sans ce chemin, l'application devrait coder les douze orientations en dur.
 * Ces cas gardent les trois promesses qui le justifient : ce qui est actif et
 * rien d'autre, le prix lu en base, et jamais un brouillon. */
describe("le studio de l'utilisateur", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let amorce: AmorceStudioService;
  let configs: StudioConfigurationService;
  let jeton: string;
  let userId: string;

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
    amorce = app.get(AmorceStudioService);
    configs = app.get(StudioConfigurationService);
  }, 180_000);

  afterAll(async () => { await app?.close(); await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await amorce.reconcilier();
    // Le catalogue des actions payantes vient du même semis que les modèles.
    await db.prisma.premiumAction.createMany({
      data: [{ code: "portrait", label: "Un portrait", creditCost: 1 }],
      skipDuplicates: true,
    });
    // Le drapeau gouverne la surface entière : ligne absente vaut éteint.
    await db.prisma.featureFlag.upsert({
      where: { key: "generation.portrait" },
      create: { key: "generation.portrait", enabled: true },
      update: { enabled: true },
    });
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa_studio", referralCode: "AWASTUD" },
    });
    userId = u.id;
    jeton = jwt.sign({ sub: userId }, SECRET, { algorithm: "HS256", expiresIn: 900 });
  });

  const options = (entete: Record<string, string> = { authorization: `Bearer ${jeton}` }) =>
    fetch(`${baseUrl}/v1/me/studio/options`, { headers: entete });

  const reglages = (f: (r: ReglagesPortrait) => void): ReglagesPortrait => {
    const r = JSON.parse(JSON.stringify(reglagesPortraitDeDepart())) as ReglagesPortrait;
    f(r);
    return r;
  };

  const publier = async (r: ReglagesPortrait) => {
    const admin = await db.prisma.admin.create({
      data: { email: `a${Date.now()}@lehno.app`, role: "admin" },
    });
    const brouillon = await configs.deposerBrouillon("portrait", r);
    await db.prisma.studioTrial.create({
      data: { studioConfigId: brouillon.id, provider: "anthropic", modelKey: "x", status: "success" },
    });
    return configs.publier(admin.id, brouillon.id, "on met à jour le catalogue");
  };

  /* Le contrat est la seule chose que les deux côtés partagent. Sans ce cas, le
     serveur peut renommer un champ sans que rien ne s'en aperçoive avant
     l'écran — et l'écran du studio mobile se construit maintenant dessus. */
  it("suit le contrat publié, au champ près", async () => {
    const res = await options();
    expect(res.status).toBe(200);
    const page = studioOptionsSchema.parse(await res.json());

    expect(page.version).toBe(1);
    expect(page.creditCost).toBe(1);
    expect(page.catalogue.rootGroupIds).toContain("orientation");
    const orientation = page.catalogue.groups.find((g) => g.id === "orientation");
    expect(orientation?.choices.map((c) => c.id)).toEqual([...ORIENTATIONS]);
    expect(orientation?.defaultChoiceId).toBe(ORIENTATIONS[0]);
  });

  /* LE prix vient de la base. Une constante dans le client afficherait
     l'ancien tarif sur tout un parc jusqu'à la mise à jour suivante — et le
     tarif se règle justement en administration pour éviter cette livraison. */
  it("rend le prix réglé en administration, pas une constante", async () => {
    await db.prisma.premiumAction.update({ where: { code: "portrait" }, data: { creditCost: 4 } });
    const page = studioOptionsSchema.parse(await (await options()).json());
    expect(page.creditCost).toBe(4);
  });

  /* « Une orientation désactivée disparaît de l'application sans livraison. »
     C'est tout l'intérêt du catalogue en base ; si ça tombe, il faut publier
     une version de l'application pour en retirer une. */
  it("fait disparaître une orientation désactivée, sans livraison", async () => {
    await publier(reglages((r) => {
      r.ambiances.find((a): boolean => a.id === "nature")!.actif = false;
    }));

    const page = studioOptionsSchema.parse(await (await options()).json());
    const ids = page.catalogue.groups.find((g) => g.id === "orientation")!.choices.map((c) => c.id);
    expect(ids).not.toContain("un_hommage");
    expect(ids).toHaveLength(ORIENTATIONS.length - 1);
    expect(page.version).toBe(2);
  });

  /* UN BROUILLON N'ATTEINT JAMAIS UN UTILISATEUR. Sans ce cas, une consigne en
     cours de composition — et le libellé provisoire qui va avec — partirait
     chez tout le monde à la première prévisualisation. */
  it("ne rend jamais un brouillon", async () => {
    await configs.deposerBrouillon("portrait", reglages((r) => {
      r.ambiances[0]!.libelle.fr = "LIBELLÉ EN COURS DE COMPOSITION";
    }));

    const page = studioOptionsSchema.parse(await (await options()).json());
    const libelles = page.catalogue.groups.flatMap((g) => g.choices.map((c) => c.label));
    expect(libelles).not.toContain("LIBELLÉ EN COURS DE COMPOSITION");
    // Deux numéros désormais : le catalogue réunit les deux configurations.
    expect(page.version.portrait).toBe(1);
  });

  /* Aucun repli sur les réglages du code. Il rendrait cette route increvable,
     et c'est ce qui le disqualifie : le jour où l'administration publie un
     catalogue à trois orientations, un incident ferait silencieusement
     réapparaître les douze du code sans que personne ne sache pourquoi. */
  it("refuse plutôt que de se replier sur les réglages du code", async () => {
    await db.prisma.studioTrial.deleteMany({});
    await db.prisma.studioConfig.deleteMany({});

    const res = await options();
    expect(res.status).toBe(422);
    expect(await codeDe(res)).toBe("resource_inactive");
  });

  /* La langue de l'INTERFACE, pas celle du proche : cet écran est celui de
     l'utilisateur. Les deux diffèrent souvent — on écrit en anglais à
     quelqu'un depuis une application réglée en français. */
  it("résout les libellés dans la langue d'interface du demandeur", async () => {
    await db.prisma.user.update({ where: { id: userId }, data: { uiLanguage: "en" } });
    const page = studioOptionsSchema.parse(await (await options()).json());
    expect(page.catalogue.groups[0]!.choices[0]!.label).toBe("Our relationship");
  });

  /* Le drapeau AVANT l'authentification : une surface éteinte l'est pour tout
     le monde. Dans l'autre ordre, le statut distinguerait « éteinte » de « non
     authentifiée », et raconterait donc quelque chose. */
  it("répond comme une surface éteinte, même sans jeton", async () => {
    await db.prisma.featureFlag.update({
      where: { key: "generation.portrait" }, data: { enabled: false },
    });
    const avec = await options();
    const sans = await options({});
    expect(avec.status).toBe(sans.status);
    expect(await codeDe(avec)).toBe(await codeDe(sans));
  });
});
