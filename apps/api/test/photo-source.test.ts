import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { reglagesPortraitDeDepart, type ReglagesPortrait } from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { StockageMemoire } from "../src/stockage/memoire.adapter.js";
import { PhotoSourceService } from "../src/me/photo-source.service.js";
import { StudioConfigurationService } from "../src/studio/configuration.service.js";
import { AuditService } from "../src/admin/audit.service.js";
import { AppError } from "../src/common/errors.js";

/**
 * LA PHOTO DONT LE PORTRAIT S'INSPIRE.
 *
 * Trois choses à garder, et la troisième a changé en cours de route.
 *
 * ELLE NE TRANSITE PAS PAR NOUS : le client téléverse directement sur le
 * stockage, par une URL signée. Ces cas le simulent avec `poser`, qui écrit là
 * où le dépôt pointait — exactement ce que ferait un `PUT` du téléphone.
 *
 * ON LA JUGE ET ON DIT POURQUOI. « Refusée avec une raison claire, plutôt que
 * traitée mal » : un modèle qui reçoit une photo illisible ne refuse pas, il
 * invente, et l'utilisateur paie une image qui n'a rien à voir.
 *
 * ELLE RESTE. Une première version l'effaçait après chaque génération. C'était
 * contre l'usage — on refait un portrait POUR EN VOIR UN AUTRE, et redemander un
 * téléversement à chaque essai transformerait la recherche du bon rendu en
 * corvée. Le cas « une relance repart sur la même photo » garde cette décision.
 */
describe("la photo source d'un portrait", () => {
  let db: TestDb;
  let stockage: StockageMemoire;
  let photos: PhotoSourceService;
  let awa: string;

  /* DES IMAGES FABRIQUÉES, PAS DES FIXTURES. Une image sur disque ne dirait pas
     ce qu'elle éprouve — « pourquoi celle-ci est-elle refusée ? » demanderait de
     l'ouvrir. Ici chacune porte son défaut dans son nom et dans ses paramètres. */
  const bonne = (cote = 800): Promise<Buffer> =>
    sharp({
      create: { width: cote, height: cote, channels: 3, background: "#808080" },
    })
      /* DU BRUIT, pour que l'écart-type dépasse le seuil de netteté : une image
         d'un gris uni est parfaitement « floue » au sens de cette mesure. */
      .composite([{
        input: Buffer.from(
          `<svg width="${cote}" height="${cote}">${
            Array.from({ length: 40 }, (_, i) =>
              `<rect x="${i * 20}" y="0" width="10" height="${cote}" fill="${i % 2 ? "#FFFFFF" : "#101010"}"/>`)
              .join("")
          }</svg>`,
        ),
        top: 0, left: 0,
      }])
      .jpeg()
      .toBuffer();

  const sombre = (): Promise<Buffer> =>
    sharp({ create: { width: 800, height: 800, channels: 3, background: "#050505" } })
      .jpeg().toBuffer();

  /* Un gris uni : bien éclairé, de bonne taille, et sans le moindre contraste.
     C'est ce que mesure `nettetteMin` — l'écart-type s'effondre. */
  const plate = (): Promise<Buffer> =>
    sharp({ create: { width: 800, height: 800, channels: 3, background: "#9A9A9A" } })
      .jpeg().toBuffer();

  const configs = (): StudioConfigurationService =>
    new StudioConfigurationService(db.prisma as never, new AuditService(db.prisma as never));

  /** Déposer, simuler le téléversement du client, et RENDRE LA CLÉ déposée —
   *  c'est elle qu'on vérifie effacée après un refus. */
  const deposer = async (octets: Buffer): Promise<string> => {
    await photos.deposer(awa);
    const compte = await db.prisma.user.findUniqueOrThrow({
      where: { id: awa }, select: { depotEnCoursKey: true },
    });
    stockage.poser(compte.depotEnCoursKey!, octets);
    return compte.depotEnCoursKey!;
  };

  const cleGardee = async (): Promise<string | null> =>
    (await db.prisma.user.findUniqueOrThrow({
      where: { id: awa }, select: { photoSourceKey: true },
    })).photoSourceKey;

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    stockage = new StockageMemoire();
    photos = new PhotoSourceService(db.prisma as never, configs(), stockage);
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
      select: { id: true },
    });
    awa = u.id;
  });

  describe("le dépôt", () => {
    /* LE CLIENT REÇOIT UNE URL, JAMAIS LA CLÉ. La lui donner permettrait de la
       remplacer par celle d'un reçu de paiement ou d'un export, et de nous faire
       signer une lecture dessus — la doctrine est écrite sur `depotAvatarSchema`. */
    it("rend une adresse de dépôt, et garde la clé pour lui", async () => {
      const depot = await photos.deposer(awa);
      expect(depot.url).toContain("://");
      expect(Object.keys(depot).sort()).toEqual(["expireDans", "typeMime", "url"]);

      const compte = await db.prisma.user.findUniqueOrThrow({
        where: { id: awa }, select: { depotEnCoursKey: true, depotEnCoursCible: true },
      });
      expect(compte.depotEnCoursKey).toMatch(/^sources\//);
      expect(compte.depotEnCoursCible).toBe("portrait-source");
    });

    /* UN PRÉFIXE À PART, et il n'est pas cosmétique : le jour où l'on pose une
       règle de cycle de vie côté stockage, elle portera sur `sources` seul.
       Posée sur `portraits`, elle effacerait ce que les gens ont payé. */
    it("range sous le préfixe des sources, jamais des portraits", async () => {
      await photos.deposer(awa);
      const compte = await db.prisma.user.findUniqueOrThrow({
        where: { id: awa }, select: { depotEnCoursKey: true },
      });
      expect(compte.depotEnCoursKey).not.toMatch(/^portraits\//);
    });
  });

  describe("le jugement", () => {
    it("accepte une photo nette, claire et assez grande", async () => {
      await deposer(await bonne());
      await photos.confirmer(awa);

      expect(await cleGardee()).toMatch(/^sources\//);
      // La place du dépôt se libère : un second `confirmer` n'a plus rien à juger.
      const compte = await db.prisma.user.findUniqueOrThrow({
        where: { id: awa }, select: { depotEnCoursKey: true },
      });
      expect(compte.depotEnCoursKey).toBeNull();
    });

    /* LES TROIS REFUS, chacun avec sa raison. Elle voyage dans le DÉTAIL et non
       dans le message : l'écran a ses phrases, et les traduire au serveur les
       figerait en une langue. */
    const refus: [string, () => Promise<Buffer>, string][] = [
      ["trop petite", () => bonne(64), "trop_petite"],
      ["trop sombre", sombre, "trop_sombre"],
      ["trop plate", plate, "trop_floue"],
    ];

    for (const [quoi, fabriquer, raison] of refus) {
      it(`refuse une photo ${quoi}, en le disant`, async () => {
        const cle = await deposer(await fabriquer());
        expect(stockage.contenuDe(cle)).toBeDefined();

        try {
          await photos.confirmer(awa);
          expect.unreachable("la photo aurait dû être refusée");
        } catch (e) {
          expect(e).toBeInstanceOf(AppError);
          expect((e as AppError).code).toBe("validation_failed");
          expect((e as AppError).details).toMatchObject({ raison });
        }

        /* RIEN N'EST GARDÉ, ET LE FICHIER S'EN VA. On vérifie la clé RÉELLEMENT
           déposée — une clé littérale qui n'existe jamais rendrait ce cas vert
           sans rien éprouver. */
        expect(await cleGardee()).toBeNull();
        expect(stockage.contenuDe(cle)).toBeUndefined();
      });
    }

    it("refuse quand aucun dépôt n'est en cours", async () => {
      await expect(photos.confirmer(awa)).rejects.toMatchObject({ code: "conflict" });
    });

    /* Le client a annoncé un dépôt qu'il n'a pas fait, ou le téléversement a été
       coupé. La place se libère pour qu'un second essai reparte proprement. */
    it("refuse quand rien n'a été téléversé, et libère la place", async () => {
      await photos.deposer(awa);
      await expect(photos.confirmer(awa)).rejects.toThrow();

      const compte = await db.prisma.user.findUniqueOrThrow({
        where: { id: awa }, select: { depotEnCoursKey: true },
      });
      expect(compte.depotEnCoursKey).toBeNull();
    });
  });

  describe("les seuils", () => {
    /* ILS SE RÈGLENT AU STUDIO, et c'est le propos : on les ajuste au vu des
       photos qui arrivent, sans livrer. Ce cas le prouve en RESSERRANT le seuil
       de taille jusqu'à refuser une photo que le défaut acceptait. */
    it("viennent de la configuration publiée", async () => {
      const r = reglagesPortraitDeDepart();
      const severe: ReglagesPortrait = {
        ...r,
        photo: { ...r.photo!, coteMin: 2048 },
      };
      await db.prisma.studioConfig.create({
        data: {
          kind: "portrait", state: "published", version: 1,
          settings: severe as never, fingerprint: "empreinte-severe",
          publishedAt: new Date(),
        },
      });

      await deposer(await bonne(800));
      await expect(photos.confirmer(awa)).rejects.toMatchObject({
        details: { raison: "trop_petite" },
      });
    });

    /* SANS CONFIGURATION PUBLIÉE, on ne refuse pas : la voie photo doit pouvoir
       s'éprouver sur un serveur neuf. */
    it("retombent sur ceux du code quand rien n'est publié", async () => {
      await deposer(await bonne(800));
      await photos.confirmer(awa);
      expect(await cleGardee()).not.toBeNull();
    });
  });

  describe("ce qu'elle devient", () => {
    /* LA DÉCISION DU 11 SEPTEMBRE, et c'est ce cas qui la garde. On refait un
       portrait pour en voir un autre : la source reste, et les relances
       repartent dessus sans redemander de téléversement. */
    it("reste en place après lecture, pour que les relances repartent dessus", async () => {
      await deposer(await bonne());
      await photos.confirmer(awa);
      const cle = await cleGardee();

      expect(await photos.lire(awa)).toBe(cle);
      expect(await photos.lire(awa)).toBe(cle);
      expect(await cleGardee()).toBe(cle);
      expect(stockage.contenuDe(cle!)).toBeDefined();
    });

    it("refuse de se lire quand aucune photo n'a été acceptée", async () => {
      await expect(photos.lire(awa)).rejects.toMatchObject({ code: "validation_failed" });
    });

    /* UN NOUVEAU DÉPÔT REMPLACE, ET L'ANCIENNE S'EN VA. C'est le geste naturel —
       on choisit une photo, puis on en choisit une autre — et la garder ferait
       vivre au stockage un fichier que plus rien ne désigne. */
    it("remplace la précédente et l'efface", async () => {
      await deposer(await bonne());
      await photos.confirmer(awa);
      const premiere = await cleGardee();

      await deposer(await bonne(900));
      await photos.confirmer(awa);
      const seconde = await cleGardee();

      expect(seconde).not.toBe(premiere);
      expect(stockage.contenuDe(premiere!)).toBeUndefined();
      expect(stockage.contenuDe(seconde!)).toBeDefined();
    });
  });
});
