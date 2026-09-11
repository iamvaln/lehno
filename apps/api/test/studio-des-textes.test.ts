import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  reglagesIdeesDeDepart, reglagesBriefPortraitDeDepart, reglagesMessageDeDepart,
  matierePourEmpreinteIdees, matierePourEmpreinteMessage,
  type ReglagesIdees, type ReglagesBriefPortrait,
} from "@lehno/contracts";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { GenerationService } from "../src/me/generation.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { AuditService } from "../src/admin/audit.service.js";
import { StudioConfigurationService } from "../src/studio/configuration.service.js";
import { AmorceStudioService } from "../src/studio/amorce.service.js";
import { RouteurIAService, type Adaptateur, type ReponseIA } from "../src/ia/routeur.service.js";
import { CatalogueIAService } from "../src/ia/catalogue.service.js";

/**
 * LE STUDIO DES TEXTES — trois générations, trois configurations.
 *
 * On ne produit pas qu'un message. Les idées de cadeau et le brief du portrait
 * passent par un modèle de texte eux aussi, et tournaient sur des valeurs
 * figées dans le code : `ContexteIdees` portait `consigneCommune` et
 * `gardeFous` depuis le début — « ce que l'administration ajoute, publié depuis
 * l'atelier » — et personne ne les alimentait.
 *
 * CE QUE CES CAS ÉPROUVENT N'EST PAS QUE LE RÉGLAGE S'ENREGISTRE, c'est qu'il
 * ATTEIGNE LE MODÈLE. Un réglage qui ne change pas ce qui part est pire
 * qu'absent : l'administration croit avoir agi. C'est exactement le piège du
 * champ `modele`, qui ne décide de rien en production — la chaîne
 * `ai_task_route` le fait.
 */
describe("le studio des textes", () => {
  let db: TestDb;
  let configs: StudioConfigurationService;
  let amorce: AmorceStudioService;
  let awa: string;
  let occurrence: string;
  let proche: string;

  /* L'adaptateur GARDE ce qu'on lui a envoyé. C'est la seule façon de prouver
     qu'un réglage atteint le modèle : regarder la ligne en base dirait
     seulement qu'elle est écrite. */
  const espion = (contenu: string): Adaptateur & { vu: string[] } => {
    const a = {
      vu: [] as string[],
      // `appeler(modele, demande)` — l'invite est le SECOND argument.
      async appeler(_m: string, d: { invite: string; systeme: string }): Promise<ReponseIA> {
        a.vu.push(`${d.systeme}\n${d.invite}`);
        return { contenu };
      },
    };
    return a as Adaptateur & { vu: string[] };
  };

  const IDEES_RENDUES = (n: number): string => JSON.stringify({
    idees: Array.from({ length: n }, (_, i) => ({
      titre: `Idée ${i + 1}`,
      pourquoi: "Parce que ses notes disent qu'elle jardine tous les dimanches.",
    })),
  });

  const BRIEF_RENDU = (mots: number): string => JSON.stringify({
    mots: Array.from({ length: mots }, (_, i) => `mot ${i + 1}`),
    phrase: "Celle qui plante avant que le jour se lève",
    phraseCourte: "Avant le jour",
  });

  const fabrique = (a: Adaptateur) =>
    new GenerationService(
      db.prisma as never, new TenantRepository(db.prisma as never),
      new RouteurIAService(db.prisma as never), { anthropic: a },
      configs,
    );

  /** Publier une configuration pour une nature, en dépassant celle en service. */
  const publier = async (nature: "idees" | "portrait_brief", reglages: unknown) => {
    await db.prisma.studioConfig.updateMany({
      where: { kind: nature, state: "published" }, data: { state: "superseded" },
    });
    await db.prisma.studioConfig.create({
      data: {
        kind: nature,
        state: "published",
        settings: reglages as never,
        fingerprint: configs.empreinte(nature, reglages as never),
        publishedAt: new Date(),
      },
    });
  };

  /* LE PORTRAIT SE DÉBITE, et son action doit exister au catalogue. Sans elle,
     `debiter` refuse avant tout appel de modèle — et le test passerait au vert
     en n'ayant rien éprouvé du tout, puisque l'espion resterait vide. */
  const lancerLeBrief = async (modele: Adaptateur) => {
    await crediter(5);
    const config = await db.prisma.studioConfig.findFirstOrThrow({
      where: { kind: "portrait", state: "published" },
    });
    return fabrique(modele).lancerPortrait(
      awa, proche,
      {
        orientation: "notre_relation",
        voie: "aucune",
        ambiance: null,
        composition: { id: "papier", palette: ["#EDEAF7", "#7B6BB7", "#F0CFB4", "#5A4B93"] },
      } as never,
      config.id, {},
    );
  };

  const crediter = (n: number) =>
    db.prisma.creditTransaction.create({
      data: { userId: awa, type: "grant", source: "signup_grant", amount: n },
    });

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    await new CatalogueIAService(db.prisma as never).reconcilier();
    await db.prisma.premiumAction.createMany({
      data: [
        { code: "portrait", label: "Un portrait", creditCost: 1 },
        { code: "gift_ideas", label: "Des idées", creditCost: 1 },
      ],
      skipDuplicates: true,
    });
    configs = new StudioConfigurationService(db.prisma as never, new AuditService(db.prisma as never));
    amorce = new AmorceStudioService(db.prisma as never, configs);
    await amorce.reconcilier();

    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
      select: { id: true },
    });
    awa = u.id;
    const p = await db.prisma.person.create({
      data: { userId: awa, displayName: "Célarine", gender: "female" },
      select: { id: true },
    });
    proche = p.id;
    await db.prisma.note.create({
      data: { personId: proche, authorUserId: awa, content: "Elle jardine tous les dimanches." },
    });
    const e = await db.prisma.event.create({
      data: { personId: p.id, authorUserId: awa, kind: "birthday", referenceDate: new Date("2026-09-01") },
      select: { id: true },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId: awa, occurrenceDate: new Date("2026-09-01"), occurrenceYear: 2026 },
      select: { id: true },
    });
    occurrence = o.id;
  });

  describe("le semis", () => {
    it("pose les quatre natures, chacune lisible", async () => {
      const lignes = await db.prisma.studioConfig.findMany({ where: { state: "published" } });
      expect(lignes.map((l) => l.kind).sort())
        .toEqual(["idees", "message", "portrait", "portrait_brief"]);
      for (const l of lignes) expect(configs.estLisible(l)).toBe(true);
    });

    /* LES VALEURS DE DÉPART SONT CELLES DU CODE, au nombre près. Semer autre
       chose changerait le produit au premier démarrage, sans que personne
       n'ait rien publié. */
    it("part des valeurs que le code appliquait déjà", async () => {
      const ligne = await db.prisma.studioConfig.findFirstOrThrow({
        where: { kind: "portrait_brief", state: "published" },
      });
      expect(configs.reglagesBriefPortraitDe(ligne)).toEqual(reglagesBriefPortraitDeDepart());
    });
  });

  describe("les empreintes", () => {
    /* C'EST L'OBJET DU DÉCOUPAGE. Une empreinte commune ferait retomber les
       essais des idées dès qu'on reformule un garde-fou du message — chaque
       réglage rendrait l'autre à éprouver alors qu'il n'a pas bougé. */
    it("sont indépendantes d'une nature à l'autre", async () => {
      const idees: ReglagesIdees = { ...reglagesIdeesDeDepart(), consigneCommune: "Restez concrets." };

      expect(matierePourEmpreinteIdees(idees))
        .not.toBe(matierePourEmpreinteIdees(reglagesIdeesDeDepart()));
      // Le message n'a pas bougé, et son empreinte non plus.
      expect(matierePourEmpreinteMessage(reglagesMessageDeDepart()))
        .toBe(matierePourEmpreinteMessage(reglagesMessageDeDepart()));
      expect(configs.empreinte("idees", idees))
        .not.toBe(configs.empreinte("message", reglagesMessageDeDepart()));
    });
  });

  describe("les idées de cadeau", () => {
    it("portent la consigne et les garde-fous publiés jusqu'au modèle", async () => {
      await publier("idees", {
        ...reglagesIdeesDeDepart(),
        consigneCommune: "Privilégiez ce qui se partage à plusieurs.",
        gardeFous: ["aucun objet connecté"],
      });
      await crediter(5);

      const modele = espion(IDEES_RENDUES(5));
      await fabrique(modele).lancerIdees(awa, occurrence);

      expect(modele.vu[0]).toMatch(/CONSIGNE DE LA MAISON/);
      expect(modele.vu[0]).toMatch(/Privilégiez ce qui se partage à plusieurs\./);
      expect(modele.vu[0]).toMatch(/aucun objet connecté/);
    });

    /* LE NOMBRE DEMANDÉ EST UN RÉGLAGE, et il change la demande elle-même. Le
       laisser en dur obligeait à livrer pour passer de cinq idées à quatre. */
    it("demandent le nombre réglé, et pas celui du code", async () => {
      await publier("idees", { ...reglagesIdeesDeDepart(), nombreDemande: 4 });
      await crediter(5);

      const modele = espion(IDEES_RENDUES(4));
      const jeu = await fabrique(modele).lancerIdees(awa, occurrence);

      expect(modele.vu[0]).toMatch(/EXACTEMENT 4 IDÉES/);
      expect(modele.vu[0]).not.toMatch(/EXACTEMENT 5 IDÉES/);
      expect(jeu.ideas).toHaveLength(4);
    });

    /* RIEN DE PUBLIÉ NE DOIT PAS BLOQUER. Un serveur neuf produit avant qu'un
       administrateur n'ait rien fait : le gabarit retombe sur ses valeurs de
       code. C'est l'inverse du portrait, où un repli composerait une image que
       personne n'a vue tourner. */
    it("produisent encore quand aucune configuration n'est en service", async () => {
      await db.prisma.studioConfig.updateMany({
        where: { kind: "idees" }, data: { state: "superseded" },
      });
      await crediter(5);

      const modele = espion(IDEES_RENDUES(5));
      const jeu = await fabrique(modele).lancerIdees(awa, occurrence);

      expect(jeu.ideas).toHaveLength(5);
      expect(modele.vu[0]).toMatch(/EXACTEMENT 5 IDÉES/);
    });

    /* UNE CONFIGURATION ILLISIBLE NE FAIT PAS TOMBER LA GÉNÉRATION. Le semis la
       répare au démarrage suivant ; d'ici là, on produit comme hier plutôt que
       de rendre 500 à quelqu'un qui a payé. */
    it("produisent encore quand la configuration ne se relit plus", async () => {
      await db.prisma.studioConfig.updateMany({
        where: { kind: "idees", state: "published" },
        data: { settings: { forme: "d'un autre temps" } as never },
      });
      await crediter(5);

      const modele = espion(IDEES_RENDUES(5));
      expect((await fabrique(modele).lancerIdees(awa, occurrence)).ideas).toHaveLength(5);
    });
  });

  describe("le brief du portrait", () => {
    /* Le brief est la garde qui empêche les confidences de partir mot pour mot
       chez un fournisseur d'image. Ses consignes se règlent donc au même titre
       que celles du message — et plus encore. */
    it("porte la consigne publiée jusqu'au modèle de texte", async () => {
      await publier("portrait_brief", {
        ...reglagesBriefPortraitDeDepart(),
        consigneCommune: "Préférez les mots de saison.",
        gardeFous: ["aucun mot qui nomme un métier"],
      });

      const modele = espion(BRIEF_RENDU(5));
      await lancerLeBrief(modele);

      expect(modele.vu[0]).toMatch(/CONSIGNE DE LA MAISON/);
      expect(modele.vu[0]).toMatch(/Préférez les mots de saison\./);
      expect(modele.vu[0]).toMatch(/aucun mot qui nomme un métier/);
    });

    /* LES MÊMES BORNES POUR DEMANDER ET POUR VÉRIFIER.
     *
     * C'est le cas qui compte le plus ici. Les bornes servaient à DEUX choses
     * dans le code — composer la demande, et valider la sortie — depuis la même
     * constante. Ne régler que la première ferait qu'un élargissement produirait
     * une sortie refusée par la garde d'en face : l'utilisateur paierait un
     * portrait qu'on jette, et le journal dirait « length_out_of_range » sans
     * que personne comprenne. */
    it("demande et vérifie sur les mêmes bornes", async () => {
      await publier("portrait_brief", {
        ...reglagesBriefPortraitDeDepart(),
        motsDuPortrait: { min: 8, max: 10 },
      });

      // Neuf mots : au-dessus du plafond du CODE (sept), dans celui réglé.
      const modele = espion(BRIEF_RENDU(9));
      await lancerLeBrief(modele);

      expect(modele.vu[0]).toMatch(/8 à 10 mots/);

      // La sortie de neuf mots est RETENUE : la garde a suivi le réglage.
      const ligne = await db.prisma.portrait.findFirst({ where: { userId: awa } });
      expect(ligne).not.toBeNull();
      expect((JSON.parse(ligne!.content) as { mots: string[] }).mots).toHaveLength(9);
    });
  });
});
