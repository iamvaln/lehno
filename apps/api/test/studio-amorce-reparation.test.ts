import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import jwt from "jsonwebtoken";
import type { Prisma } from "@prisma/client";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AppModule } from "../src/app.module.js";
import { AppError, AppExceptionFilter } from "../src/common/errors.js";
import { AmorceStudioService } from "../src/studio/amorce.service.js";
import { StudioConfigurationService } from "../src/studio/configuration.service.js";
import { reglagesMessageDeDepart } from "@lehno/contracts";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const SECRET_ADMIN = "Y2xlLWFkbWluLWRlLXRlc3QtMzItb2N0ZXRzLWljaSEh";

/* LA FORME D'AVANT LE DÉCOUPAGE, telle qu'elle dort encore en base.
 *
 * Ce n'est pas une invention pour les besoins du test : c'est
 * `studioReglagesSchema` avant `c8cc26b`, et c'est exactement ce que la
 * migration `20260829180000_studio_deux_configurations` a laissé derrière elle
 * en posant `kind = 'message'` sans toucher à la charge.
 *
 * Les quatre clés qui tuent la relecture sont `motifs`, `voiesImage`,
 * `ambiances` et `modeles` — le schéma du message est `.strict()`, et il
 * attend `modele` au singulier. */
function reglagesDAvantLeDecoupage(): Prisma.InputJsonValue {
  const { modele, ...message } = reglagesMessageDeDepart();
  return {
    ...message,
    motifs: { bande: "trame_de_hampes", fondSansImage: "registres" },
    modeles: { message: modele, illustration: "openai:gpt-image-1", photo_style: "xai:grok-imagine-image" },
    voiesImage: [{
      id: "aucune", actif: true,
      libelle: { fr: "Sans image", en: "No image" },
      description: { fr: "Le message seul.", en: "The message alone." },
    }],
    ambiances: [],
  } as unknown as Prisma.InputJsonValue;
}

/* Le semis répare une configuration devenue illisible — et seulement la sienne.
 *
 * La panne a coûté une semaine au mobile : chaque génération de message
 * répondait 500, aucune route ne savait réparer, et il a fallu un DELETE en
 * base pour repartir. Ces cas gardent les deux moitiés de la correction : ça
 * se répare tout seul au démarrage, et ça ne touche pas à ce qu'un
 * administrateur a publié. */
describe("le semis du studio, face à une configuration illisible", () => {
  let db: TestDb;
  let app: INestApplication;
  let baseUrl: string;
  let amorce: AmorceStudioService;
  let configs: StudioConfigurationService;
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
    amorce = app.get(AmorceStudioService);
    configs = app.get(StudioConfigurationService);
  }, 180_000);

  afterAll(async () => { await app?.close(); await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await amorce.reconcilier();
    await db.prisma.premiumAction.createMany({
      data: [{ code: "portrait", label: "Un portrait", creditCost: 1 }],
      skipDuplicates: true,
    });
    // La surface entière est derrière ce drapeau : ligne absente vaut éteint,
    // et l'écran répondrait 404 avant d'avoir lu la moindre configuration.
    await db.prisma.featureFlag.upsert({
      where: { key: "generation.portrait" },
      create: { key: "generation.portrait", enabled: true },
      update: { enabled: true },
    });
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa_semis", referralCode: "AWASEMI" },
    });
    jeton = jwt.sign({ sub: u.id }, SECRET, { algorithm: "HS256", expiresIn: 900 });
  });

  const options = () =>
    fetch(`${baseUrl}/v1/me/studio/options`, { headers: { authorization: `Bearer ${jeton}` } });

  /** Ramener la configuration du message à la forme d'avant le découpage. */
  const vieillir = async (publieePar: string | null = null): Promise<string> => {
    const enService = await db.prisma.studioConfig.findFirstOrThrow({
      where: { kind: "message", state: "published" },
    });
    await db.prisma.studioConfig.update({
      where: { id: enService.id },
      data: { settings: reglagesDAvantLeDecoupage(), publishedByAdminId: publieePar },
    });
    return enService.id;
  };

  it("refuse de la relire EN LE DISANT, au lieu de tomber en erreur interne", async () => {
    await vieillir();
    const ligne = await db.prisma.studioConfig.findFirstOrThrow({
      where: { kind: "message", state: "published" },
    });

    /* Le code compte autant que le refus : `internal_error` fait écrire
       « réessayez » à l'écran, et on réessaie une semaine. */
    expect(() => configs.reglagesMessageDe(ligne)).toThrowError(AppError);
    try {
      configs.reglagesMessageDe(ligne);
      expect.unreachable("la relecture aurait dû refuser");
    } catch (e) {
      expect((e as AppError).code).toBe("resource_inactive");
    }
  });

  it("repose les réglages de départ au démarrage suivant", async () => {
    const ancienne = await vieillir();

    await amorce.reconcilier();

    const enService = await db.prisma.studioConfig.findFirstOrThrow({
      where: { kind: "message", state: "published" },
    });
    expect(enService.id).not.toBe(ancienne);
    expect(configs.estLisible(enService)).toBe(true);
    // Le motif est dans la note : sans elle, on lirait « réglages de départ »
    // sans savoir qu'une version a été dépassée.
    expect(enService.note).toMatch(/ne se relisait plus/);

    // L'ancienne est DÉPASSÉE, pas supprimée : c'est ce qui distingue une
    // réparation d'un DELETE, et ce qui permet de voir après coup ce qu'il y
    // avait.
    const depassee = await db.prisma.studioConfig.findUniqueOrThrow({ where: { id: ancienne } });
    expect(depassee.state).toBe("superseded");
  });

  /* LE PIÈGE QUI A FAILLI PASSER : l'index unique porte sur (kind, version),
     et la ligne dépassée garde la sienne. Reposer la version 1 par-dessus
     tombe sur une violation de contrainte AU DÉMARRAGE — donc un serveur qui
     ne boote plus, pour réparer une configuration. */
  it("numérote la réparation à la suite plutôt que de rejouer la version 1", async () => {
    await vieillir();
    await amorce.reconcilier();

    const enService = await db.prisma.studioConfig.findFirstOrThrow({
      where: { kind: "message", state: "published" },
    });
    expect(enService.version).toBe(2);
  });

  /* LA PREUVE PAR LE MOBILE, et c'est la seule qui compte : ce que voit
     l'application, pas ce que dit la base. `/me/studio/options` est l'appel qui
     ouvre l'écran du studio — celui qui répondait 500. */
  it("rouvre l'écran du studio à l'application", async () => {
    await vieillir();
    /* 422 et non 500, et c'est toute la différence : `resource_inactive` dit
       « indisponible », là où l'erreur interne disait « réessayez » — et on a
       réessayé une semaine. */
    expect((await options()).status).toBe(422);

    await amorce.reconcilier();

    expect((await options()).status).toBe(200);
  });

  it("ne touche pas à ce qu'un administrateur a publié", async () => {
    const admin = await db.prisma.admin.create({
      data: { email: "gardien@lehno.app", role: "admin" },
    });
    const sienne = await vieillir(admin.id);

    await amorce.reconcilier();

    /* Elle reste en service, illisible. C'est voulu : effacer le travail d'un
       administrateur pour remettre les valeurs du code ferait chercher
       longtemps pourquoi « le réglage ne tient pas ». Le refus nommé dit ce
       qui se passe, et la réparation redevient une décision. */
    const enService = await db.prisma.studioConfig.findFirstOrThrow({
      where: { kind: "message", state: "published" },
    });
    expect(enService.id).toBe(sienne);
    expect(configs.estLisible(enService)).toBe(false);
  });

  it("laisse le portrait sans configuration plutôt que d'en publier une sans essai", async () => {
    // Le découpage l'a voulu ainsi : le portrait n'a plus de version en service
    // tant qu'un essai sur un modèle d'image ne l'a pas justifiée.
    await db.prisma.studioConfig.updateMany({
      where: { kind: "portrait" }, data: { state: "superseded" },
    });

    await amorce.reconcilier();

    const enService = await db.prisma.studioConfig.findFirst({
      where: { kind: "portrait", state: "published" },
    });
    expect(enService).toBeNull();
  });
});
