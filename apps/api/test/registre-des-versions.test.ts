import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { VersionsService } from "../src/clients/versions.service.js";

/**
 * CE QU'ON ACCEPTE DE SERVIR.
 *
 * Une liste blanche tend un piège, et ces cas gardent ce qui le désamorce : un
 * build inconnu ne reçoit pas un refus sec, il reçoit « mettez à jour ». Sans
 * ça, un build parti au magasin sans être enregistré bloquerait tous ses
 * utilisateurs — exactement ceux qui viennent de mettre à jour.
 */
describe("le registre des versions", () => {
  let db: TestDb;
  let service: VersionsService;

  const poser = async (
    build: number,
    options: { version?: string; force?: boolean; retiree?: boolean; url?: string } = {},
  ): Promise<void> => {
    await db.prisma.appVersion.create({
      data: {
        platform: "mobile_ios" as never,
        version: options.version ?? `1.0.${build}`,
        buildNumber: build,
        forcesUpdate: options.force ?? false,
        isRetired: options.retiree ?? false,
        storeUrl: options.url ?? "https://apps.apple.com/lehno",
      },
    });
    service.oublier("mobile_ios");
  };

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    service = new VersionsService(db.prisma as never);
  });

  /* UN REGISTRE VIDE NE BLOQUE PERSONNE : c'est l'état d'un serveur neuf, et du
     jour où l'on ouvre une plateforme. Refuser ici mettrait tout le monde dehors
     le jour de la mise en service. */
  it("ne bloque personne quand le registre est vide", async () => {
    expect(await service.exiger("mobile_ios", 400)).toEqual({ etat: "servie" });
  });

  it("sert un build enregistré", async () => {
    await poser(400);
    expect(await service.exiger("mobile_ios", 400)).toEqual({ etat: "servie" });
  });

  /* LE CAS QUI DÉSAMORCE LE PIÈGE. Un build parti au magasin sans être
     enregistré ne reçoit PAS un refus sec : il est invité à se mettre à jour,
     avec le lien. Le pire cas d'un oubli devient « on invite à réinstaller » au
     lieu de « l'application ne marche plus ». */
  it("invite un build inconnu à se mettre à jour, avec où aller", async () => {
    await poser(400, { version: "1.4.2" });
    expect(await service.exiger("mobile_ios", 999)).toMatchObject({
      etat: "a_mettre_a_jour",
      cause: "inconnue",
      version: "1.4.2",
      storeUrl: "https://apps.apple.com/lehno",
    });
  });

  /* UN BUILD ILLISIBLE VAUT INCONNU. Le prendre pour zéro le rendrait plus
     ancien que tout ; l'ignorer laisserait passer n'importe quoi. */
  it("traite un build absent comme inconnu", async () => {
    await poser(400);
    expect(await service.exiger("mobile_ios", null)).toMatchObject({ cause: "inconnue" });
  });

  it("invite un build déclassé", async () => {
    await poser(400, { retiree: true });
    await poser(401);
    expect(await service.exiger("mobile_ios", 400)).toMatchObject({ cause: "declassee" });
  });

  describe("le drapeau qui force", () => {
    /* IL SE LIT À L'ENVERS D'UN PLANCHER : on cherche le plus récent qui force,
       et tout ce qui est en dessous est périmé. Le poser sur 500 périme 400 et
       401 d'un coup, sans avoir à écrire un numéro. */
    it("périme tout ce qui est en dessous", async () => {
      await poser(400);
      await poser(401);
      await poser(500, { force: true });

      expect(await service.exiger("mobile_ios", 400)).toMatchObject({ cause: "forcee" });
      expect(await service.exiger("mobile_ios", 401)).toMatchObject({ cause: "forcee" });
      expect(await service.exiger("mobile_ios", 500)).toEqual({ etat: "servie" });
    });

    /* ET IL NE PÉRIME PAS CE QUI EST AU-DESSUS. Sans ce cas, une release plus
       récente que celle qui force pourrait se faire refuser — c'est-à-dire
       exactement la version qu'on demande aux gens d'installer. */
    it("laisse passer ce qui lui est postérieur", async () => {
      await poser(500, { force: true });
      await poser(501);
      expect(await service.exiger("mobile_ios", 501)).toEqual({ etat: "servie" });
    });

    /* UN DRAPEAU SUR UNE VERSION DÉCLASSÉE NE COMPTE PAS : on a retiré cette
       release, donc ce qu'elle exigeait n'a plus lieu d'être. Sans cette garde,
       déclasser une version fautive laisserait sa contrainte derrière elle. */
    it("ne compte pas quand la version qui le porte est déclassée", async () => {
      await poser(400);
      await poser(500, { force: true, retiree: true });
      expect(await service.exiger("mobile_ios", 400)).toEqual({ etat: "servie" });
    });
  });

  /* LA CIBLE N'EST JAMAIS UNE VERSION DÉCLASSÉE. Inviter quelqu'un à installer
     un build qu'on refuse le ferait boucler : il met à jour, on le refuse
     encore, et l'écran ne dit pas pourquoi. */
  it("ne renvoie jamais vers une version déclassée", async () => {
    await poser(400, { version: "1.4.2" });
    await poser(500, { version: "2.0.0", retiree: true });

    expect(await service.exiger("mobile_ios", 999)).toMatchObject({ version: "1.4.2" });
  });

  /* ET UN REGISTRE ENTIÈREMENT DÉCLASSÉ NE BLOQUE PAS : il n'y aurait vers quoi
     renvoyer personne, donc le refus serait un mur. */
  it("sert quand tout le registre est déclassé", async () => {
    await poser(400, { retiree: true });
    expect(await service.exiger("mobile_ios", 999)).toEqual({ etat: "servie" });
  });

  /* LA SUGGESTION N'INTERROMPT RIEN : une version plus récente existe, celle-ci
     marche encore. C'est une bannière, pas un écran. */
  it("suggère sans bloquer quand une version plus récente existe", async () => {
    await poser(400);
    await poser(401, { version: "1.5.0" });
    expect(await service.exiger("mobile_ios", 400)).toEqual({ etat: "suggeree", version: "1.5.0" });
  });

  /* LES PLATEFORMES NE SE MÊLENT PAS. Sans ce cas, un `forcesUpdate` posé sur
     iOS périmerait Android — et on ne s'en apercevrait qu'aux plaintes. */
  it("ne mêle pas deux plateformes", async () => {
    await poser(500, { force: true });
    await db.prisma.appVersion.create({
      data: {
        platform: "mobile_android" as never, version: "1.0.0",
        buildNumber: 10, forcesUpdate: false,
      },
    });
    expect(await service.exiger("mobile_android", 10)).toEqual({ etat: "servie" });
  });

  /* SANS PLATEFORME, ON NE DÉCIDE RIEN : il n'y a pas de registre à consulter,
     et inviter quelqu'un à mettre à jour sans savoir vers quoi serait un mur.
     C'est la garde des clients qui traite ce cas, pas celle-ci. */
  it("ne décide rien sans plateforme", async () => {
    await poser(400, { force: true });
    expect(await service.exiger(null, 1)).toEqual({ etat: "servie" });
  });

  /* LE CACHE. Sans lui, une lecture par requête pour une liste qui change à
     chaque publication, c'est-à-dire rarement. */
  it("ne relit pas le registre à chaque appel, et s'oublie sur demande", async () => {
    /* DEUX BUILDS, ET C'EST NÉCESSAIRE. Avec un seul, le déclasser viderait le
       registre des versions servables — et le service rendrait « servie » dans
       les deux cas, avant comme après l'oubli. Le cas passerait POUR UNE
       MAUVAISE RAISON, sans rien dire du cache. */
    await poser(400);
    await poser(401);
    await service.exiger("mobile_ios", 400);

    await db.prisma.appVersion.updateMany({
      where: { buildNumber: 400 }, data: { isRetired: true },
    });

    // Tant que le cache tient, le verdict ne bouge pas — ici « suggérée »,
    // puisque 401 existe et qu'on est en dessous.
    expect(await service.exiger("mobile_ios", 400)).toMatchObject({ etat: "suggeree" });

    service.oublier("mobile_ios");
    expect(await service.exiger("mobile_ios", 400)).toMatchObject({ cause: "declassee" });
  });
});
