import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AvatarService } from "../src/me/avatar.service.js";
import { ProfileService } from "../src/me/profile.service.js";
import { StockageMemoire } from "../src/stockage/memoire.adapter.js";
import { AppError } from "../src/common/errors.js";

/**
 * La photo de profil, déposée EN DIRECT sur le stockage.
 *
 * Le dépôt direct évite qu'une photo de deux mégaoctets traverse l'API — mais
 * personne ne regarde plus les octets. Le serveur les relit donc à la
 * confirmation, et c'est ce que ces tests éprouvent : le type d'après le
 * contenu, les bornes, et surtout la RECOMPOSITION, qui retire les métadonnées.
 */
describe("la photo de profil", () => {
  let db: TestDb;
  let stockage: StockageMemoire;
  let avatars: AvatarService;
  let userId: string;

  /* Une vraie image, avec une position géographique dedans. C'est le risque
     qu'on éprouve : une photo prise chez soi porte l'adresse du domicile. */
  const photoAvecPosition = async (): Promise<Buffer> =>
    sharp({ create: { width: 900, height: 600, channels: 3, background: "#7B6BB7" } })
      /* `IFD0` porte de quoi identifier l'appareil et son propriétaire ; le
         bloc GPS vit dans le même conteneur EXIF et disparaît avec lui. Ce
         qu'on éprouve, c'est que le conteneur ENTIER ne survit pas à la
         recomposition. */
      .withExif({ IFD0: { Copyright: "Awa", Make: "Lehno", Model: "Domicile" } })
      .jpeg()
      .toBuffer();

  const deposer = async (contenu: Buffer): Promise<void> => {
    await avatars.depot(userId);
    const { depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { depotEnCoursKey: true },
    });
    stockage.poser(depotEnCoursKey!, contenu);
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    stockage = new StockageMemoire();
    avatars = new AvatarService(
      db.prisma as never,
      stockage,
      new ProfileService(db.prisma as never, stockage),
    );
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "A1" },
    });
    userId = u.id;
  });

  /* LE CLIENT NE CHOISIT RIEN. La clé est engendrée par le serveur et retenue
     par lui : la lui donner permettrait de la remplacer par celle d'un autre —
     un reçu, un export — et de nous faire signer une lecture dessus. */
  it("ne rend jamais la clé au client", async () => {
    const depot = await avatars.depot(userId);
    expect(Object.keys(depot).sort()).toEqual(["expireDans", "tailleMax", "typeMime", "url"]);

    const { depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { depotEnCoursKey: true },
    });
    expect(depotEnCoursKey).toMatch(/^avatars\//);
  });

  /* La recomposition n'est pas un raffinement : c'est elle qui retire les
     métadonnées, dont la POSITION GÉOGRAPHIQUE. */
  it("retire les métadonnées, position géographique comprise", async () => {
    const origine = await photoAvecPosition();
    expect((await sharp(origine).metadata()).exif).toBeDefined();

    await deposer(origine);
    await avatars.confirmer(userId);

    const { avatarKey } = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { avatarKey: true },
    });
    const servie = await sharp(stockage.contenuDe(avatarKey!)).metadata();
    expect(servie.exif).toBeUndefined();
    // Et recadrée au carré : un visage vaut mieux cadré serré que déformé.
    expect([servie.width, servie.height]).toEqual([512, 512]);
  });

  /* Le type se lit dans le CONTENU, jamais dans l'extension ni le
     `Content-Type` : les deux se déclarent, et un fichier se déclare comme il
     veut. */
  it("refuse ce qui n'est pas une image, et oublie le dépôt", async () => {
    await deposer(Buffer.from("<?php echo 'bonjour'; ?>"));
    await expect(avatars.confirmer(userId)).rejects.toBeInstanceOf(AppError);

    const { avatarKey, depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { avatarKey: true, depotEnCoursKey: true },
    });
    expect(avatarKey).toBeNull();
    // Le dépôt refusé ne reste pas en attente : sinon la confirmation suivante
    // reprendrait un objet qu'on vient de rejeter.
    expect(depotEnCoursKey).toBeNull();
  });

  it("refuse au-delà de la borne, sans la recalculer côté client", async () => {
    const depot = await avatars.depot(userId);
    await deposer(Buffer.alloc(depot.tailleMax + 1, 1));
    await expect(avatars.confirmer(userId)).rejects.toBeInstanceOf(AppError);
  });

  /* Une confirmation qui ne suit aucun dépôt ne va pas chercher au hasard dans
     le compartiment. */
  it("refuse une confirmation qui ne suit aucun dépôt", async () => {
    await expect(avatars.confirmer(userId)).rejects.toBeInstanceOf(AppError);
  });

  /* L'image vérifiée s'écrit sous une clé NEUVE : celle du dépôt a été signée
     pour le client, qui peut y réécrire tant que l'URL vit. Garder la même
     laisserait remplacer l'image vérifiée par une autre, après coup. */
  it("range l'image vérifiée sous une clé neuve", async () => {
    await avatars.depot(userId);
    const { depotEnCoursKey: deposee } = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { depotEnCoursKey: true },
    });
    stockage.poser(deposee!, await photoAvecPosition());
    await avatars.confirmer(userId);

    const { avatarKey } = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { avatarKey: true },
    });
    expect(avatarKey).not.toBe(deposee);
    // Et l'objet déposé ne traîne pas derrière.
    expect(stockage.contenuDe(deposee!)).toBeUndefined();
  });

  it("retire la photo, et l'objet avec", async () => {
    await deposer(await photoAvecPosition());
    await avatars.confirmer(userId);
    const { avatarKey } = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { avatarKey: true },
    });

    await avatars.retirer(userId);
    const apres = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { avatarKey: true },
    });
    expect(apres.avatarKey).toBeNull();
    expect(stockage.contenuDe(avatarKey!)).toBeUndefined();
  });

  /* Le profil rend une URL SIGNÉE, jamais la clé : une URL présignée expire, et
     la ranger donnerait des liens morts. */
  it("rend une URL signée, pas la clé", async () => {
    const profils = new ProfileService(db.prisma as never, stockage);
    expect((await profils.get(userId)).avatarUrl).toBeNull();

    await deposer(await photoAvecPosition());
    const profil = await avatars.confirmer(userId);
    expect(profil.avatarUrl).toContain("memoire://lecture/");
  });

  /* `sharp` est une bibliothèque NATIVE : elle tient à des binaires compilés
     pour la plateforme, et l'image de production tourne sur Alpine. Son absence
     ne doit PAS empêcher quelqu'un de se connecter — une photo de profil qui ne
     sait pas se redimensionner n'est pas une raison de fermer l'application.

     Ce test éprouve la conséquence : le dépôt reste EN ATTENTE. Une panne de
     chez nous ne détruit pas ce que l'utilisateur vient de monter, et une
     confirmation plus tard aboutira. */
  it("survit à l'absence de l'outil d'image, sans détruire le dépôt", async () => {
    await deposer(await photoAvecPosition());
    const { depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { depotEnCoursKey: true },
    });

    vi.doMock("sharp", () => { throw new Error("binaire absent"); });
    vi.resetModules();
    const { AvatarService: Sans } = await import("../src/me/avatar.service.js");
    const sans = new Sans(
      db.prisma as never, stockage, new ProfileService(db.prisma as never, stockage),
    );

    await expect(sans.confirmer(userId)).rejects.toMatchObject({ code: "internal_error" });

    const apres = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { depotEnCoursKey: true, avatarKey: true },
    });
    expect(apres.depotEnCoursKey).toBe(depotEnCoursKey);
    expect(apres.avatarKey).toBeNull();
    vi.doUnmock("sharp");
    vi.resetModules();
  });

  /* LA CLÉ SEULE NE VAUT RIEN. Sans ce contrôle, une clé aperçue une fois — sur
     un écran partagé, dans un journal — se rejouerait indéfiniment, et le
     serveur cesserait de décider à chaque lecture. C'est toute la raison pour
     laquelle le compartiment n'est pas public.

     404 et non 403 : dire « cette clé existe mais n'est pas à vous »
     apprendrait qu'elle existe. */
  it("ne signe que les clés de celui qui demande", async () => {
    await deposer(await photoAvecPosition());
    await avatars.confirmer(userId);
    const { avatarKey } = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { avatarKey: true },
    });

    const autre = await db.prisma.user.create({
      data: { email: "bila@example.com", username: "bila", referralCode: "B1" },
    });
    await expect(avatars.urlDe(autre.id, avatarKey!)).rejects.toMatchObject({ code: "not_found" });
    await expect(avatars.urlDe(userId, "avatars/inventee")).rejects.toMatchObject({ code: "not_found" });

    const signee = await avatars.urlDe(userId, avatarKey!);
    expect(signee.url).toContain("memoire://lecture/");
    expect(signee.expireDans).toBeGreaterThan(0);
  });

  /* La clé d'un dépôt EN COURS ne se signe pas : elle désigne un objet que
     personne n'a vérifié, et servir un fichier qu'on n'a pas regardé annulerait
     tout le contrôle de la confirmation. */
  it("ne signe jamais un dépôt non confirmé", async () => {
    await avatars.depot(userId);
    const { depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { depotEnCoursKey: true },
    });
    await expect(avatars.urlDe(userId, depotEnCoursKey!)).rejects.toMatchObject({ code: "not_found" });
  });

  /* LA PHOTO D'UN SOUHAIT suit exactement le même chemin, et subit le même
     examen : elle vient du même inconnu — un appareil photo — et porte les
     mêmes métadonnées. */
  describe("la photo d'un souhait", () => {
    const unSouhait = async (proprietaire: string): Promise<string> => {
      const personne = await db.prisma.person.create({
        data: { userId: proprietaire, displayName: "Awa", isSelf: true, register: "familier", language: "fr" },
      });
      const evenement = await db.prisma.event.create({
        data: {
          personId: personne.id, authorUserId: proprietaire, kind: "birthday",
          eventNature: "happy", referenceDate: new Date("1994-03-07"),
        },
      });
      const occurrence = await db.prisma.eventOccurrence.create({
        data: {
          eventId: evenement.id, userId: proprietaire,
          occurrenceDate: new Date("2026-03-07"), occurrenceYear: 2026, status: "upcoming",
        },
      });
      const souhait = await db.prisma.ownerWish.create({
        data: { eventOccurrenceId: occurrence.id, label: "Un carnet", isPublic: true },
      });
      return souhait.id;
    };

    it("rattache la photo au souhait, métadonnées retirées", async () => {
      const souhaitId = await unSouhait(userId);
      await avatars.depotSouhait(userId, souhaitId);
      const { depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
        where: { id: userId }, select: { depotEnCoursKey: true },
      });
      stockage.poser(depotEnCoursKey!, await photoAvecPosition());

      await avatars.confirmerSouhait(userId);

      const souhait = await db.prisma.ownerWish.findUniqueOrThrow({ where: { id: souhaitId } });
      expect(souhait.imageKey).not.toBeNull();
      expect(souhait.imageKey).not.toBe(depotEnCoursKey);
      const servie = await sharp(stockage.contenuDe(souhait.imageKey!)).metadata();
      expect(servie.exif).toBeUndefined();
    });

    /* Le souhait doit être À LUI, et on le vérifie AU DÉPÔT : refuser après une
       montée ferait payer le forfait pour rien. */
    it("refuse d'ouvrir un dépôt sur le souhait d'un autre", async () => {
      const autre = await db.prisma.user.create({
        data: { email: "bila@example.com", username: "bila", referralCode: "B1" },
      });
      const sien = await unSouhait(autre.id);
      await expect(avatars.depotSouhait(userId, sien)).rejects.toMatchObject({ code: "not_found" });
    });

    /* La confirmation ne dit pas ce qu'elle vise : c'est le dépôt qui l'a fixé.
       Appeler la mauvaise route rattacherait une photo de souhait à un avatar. */
    it("refuse de confirmer un dépôt qui visait autre chose", async () => {
      const souhaitId = await unSouhait(userId);
      await avatars.depotSouhait(userId, souhaitId);
      const { depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
        where: { id: userId }, select: { depotEnCoursKey: true },
      });
      stockage.poser(depotEnCoursKey!, await photoAvecPosition());

      await expect(avatars.confirmer(userId)).rejects.toMatchObject({ code: "conflict" });

      const inchange = await db.prisma.user.findUniqueOrThrow({
        where: { id: userId }, select: { avatarKey: true },
      });
      expect(inchange.avatarKey).toBeNull();
    });

    it("signe la lecture d'une photo de souhait qui est la sienne", async () => {
      const souhaitId = await unSouhait(userId);
      await avatars.depotSouhait(userId, souhaitId);
      const { depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
        where: { id: userId }, select: { depotEnCoursKey: true },
      });
      stockage.poser(depotEnCoursKey!, await photoAvecPosition());
      await avatars.confirmerSouhait(userId);

      const souhait = await db.prisma.ownerWish.findUniqueOrThrow({ where: { id: souhaitId } });
      await expect(avatars.urlDe(userId, souhait.imageKey!)).resolves.toMatchObject({
        expireDans: expect.any(Number) as number,
      });

      const autre = await db.prisma.user.create({
        data: { email: "kine@example.com", username: "kine", referralCode: "K1" },
      });
      await expect(avatars.urlDe(autre.id, souhait.imageKey!))
        .rejects.toMatchObject({ code: "not_found" });
    });

    /* LE SOUHAIT NOTÉ POUR UN PROCHE — `wishlist_item`, l'autre table.
       `image_key` y existait et la lecture la servait déjà ; rien ne pouvait
       l'écrire, si bien que la colonne restait vide pour toujours. */
    describe("celle d'un souhait du carnet", () => {
      const unVoeuDuCarnet = async (proprietaire: string): Promise<string> => {
        const occurrenceId = await unSouhait(proprietaire).then(async (id) => {
          const s = await db.prisma.ownerWish.findUniqueOrThrow({ where: { id } });
          return s.eventOccurrenceId;
        });
        const ligne = await db.prisma.wishlistItem.create({
          data: { eventOccurrenceId: occurrenceId, label: "Un foulard", origin: "owner" },
        });
        return ligne.id;
      };

      it("rattache la photo au souhait du carnet, métadonnées retirées", async () => {
        const id = await unVoeuDuCarnet(userId);
        await avatars.depotPhotoDuCarnet(userId, id);
        const { depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
          where: { id: userId }, select: { depotEnCoursKey: true },
        });
        stockage.poser(depotEnCoursKey!, await photoAvecPosition());

        await avatars.confirmerPhotoDuCarnet(userId);

        const ligne = await db.prisma.wishlistItem.findUniqueOrThrow({ where: { id } });
        expect(ligne.imageKey).not.toBeNull();
        expect(ligne.imageKey).not.toBe(depotEnCoursKey);
        expect((await sharp(stockage.contenuDe(ligne.imageKey!)).metadata()).exif).toBeUndefined();
        // La lecture la servait DÉJÀ : c'est ce qui rend le manque invisible.
        await expect(avatars.urlDe(userId, ligne.imageKey!)).resolves.toMatchObject({
          expireDans: expect.any(Number) as number,
        });
      });

      it("refuse d'ouvrir un dépôt sur le souhait d'un autre", async () => {
        const autre = await db.prisma.user.create({
          data: { email: "nina@example.com", username: "nina", referralCode: "N1" },
        });
        const sien = await unVoeuDuCarnet(autre.id);
        await expect(avatars.depotPhotoDuCarnet(userId, sien))
          .rejects.toMatchObject({ code: "not_found" });
      });

      /* LA GARDE QUI JUSTIFIE LE PRÉFIXE. Les deux tables ont des identifiants
         du même genre : sans cible distincte, une photo déposée pour un souhait
         de ma liste se rattacherait à un souhait du carnet, et inversement. */
      it("ne confond pas les deux tables de souhaits", async () => {
        const duCarnet = await unVoeuDuCarnet(userId);
        await avatars.depotPhotoDuCarnet(userId, duCarnet);
        const { depotEnCoursKey } = await db.prisma.user.findUniqueOrThrow({
          where: { id: userId }, select: { depotEnCoursKey: true },
        });
        stockage.poser(depotEnCoursKey!, await photoAvecPosition());

        await expect(avatars.confirmerSouhait(userId)).rejects.toMatchObject({ code: "conflict" });
        await expect(avatars.confirmer(userId)).rejects.toMatchObject({ code: "conflict" });

        const ligne = await db.prisma.wishlistItem.findUniqueOrThrow({ where: { id: duCarnet } });
        expect(ligne.imageKey).toBeNull();
      });
    });
  });
});
