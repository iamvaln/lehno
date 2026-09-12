import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { StudioPerformanceService } from "../src/admin/studio-performance.service.js";

/**
 * CE QUE LES VERSIONS ONT PRODUIT.
 *
 * La lecture qui donne son sens à tout l'atelier. Jusqu'au 12 septembre on
 * publiait sans jamais savoir si on avait amélioré quoi que ce soit : aucune
 * production ne portait d'avis négatif, et aucune ne disait quelle version
 * l'avait produite. Les deux manquaient ENSEMBLE — un pouce en bas sans savoir
 * quelle version l'a produit ne mesure rien, et une version publiée sans avis
 * ne dit pas si elle vaut mieux que la précédente.
 */
describe("ce que les versions ont produit", () => {
  let db: TestDb;
  let service: StudioPerformanceService;
  let awa: string;
  let occurrence: string;

  /* UNE SEULE PUBLIÉE PAR NATURE — un index unique partiel le tient, et c'est
     ce qui fait qu'« en service » désigne toujours une ligne et une seule. Les
     versions précédentes passent en `superseded` : elles restent lisibles, et
     ce sont justement celles qu'on compare. */
  const config = async (
    kind: string, version: number, etat: "published" | "superseded" = "published",
  ): Promise<string> => {
    const l = await db.prisma.studioConfig.create({
      data: {
        kind: kind as never, state: etat, version,
        settings: {} as never, fingerprint: randomBytes(8).toString("hex"),
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    return l.id;
  };

  /* Une exécution nue : ces cas éprouvent le COMPTAGE, pas la production. Les
     faire passer par le service de génération demanderait un modèle, un crédit
     et une configuration lisible pour vérifier une addition. */
  let action: string;

  const execution = async (): Promise<string> => {
    const r = await db.prisma.actionRun.create({
      data: { userId: awa, premiumActionId: action, creditsSpent: 1, status: "success" },
      select: { id: true },
    });
    return r.id;
  };

  const message = async (configId: string | null, status: string): Promise<void> => {
    await db.prisma.generatedMessage.create({
      data: {
        actionRunId: await execution(), userId: awa, eventOccurrenceId: occurrence,
        content: "Un texte", status: status as never,
        ...(configId === null ? {} : { studioConfigId: configId }),
      },
    });
  };

  const portrait = async (
    catalogue: string | null, brief: string | null, status: string,
  ): Promise<void> => {
    const p = await db.prisma.person.create({
      data: { userId: awa, displayName: "Célarine" }, select: { id: true },
    });
    /* L'IMAGE EXISTE DÈS LA COMPOSITION — une contrainte en base le tient :
       `(status = 'generated') = (image_key IS NULL)`. Le brief seul n'a pas
       d'image, tout le reste en a une, avis ou non. La fixture la respecte
       plutôt que de la contourner. */
    await db.prisma.portrait.create({
      data: {
        actionRunId: await execution(), userId: awa, personId: p.id,
        content: "des mots", visualPath: "illustration", compositionId: "papier",
        status: status as never,
        ...(status === "generated" ? {} : { imageKey: `portraits/${randomBytes(6).toString("hex")}.png` }),
        ...(catalogue === null ? {} : { studioConfigId: catalogue }),
        ...(brief === null ? {} : { briefStudioConfigId: brief }),
      },
    });
  };

  const jeu = async (configId: string | null, avis: (string | null)[]): Promise<void> => {
    await db.prisma.generatedIdeaSet.create({
      data: {
        actionRunId: await execution(), userId: awa, eventOccurrenceId: occurrence,
        ...(configId === null ? {} : { studioConfigId: configId }),
        ideas: {
          create: avis.map((a, rang) => ({
            label: `Idée ${rang}`, position: rang,
            ...(a === null ? {} : { feedback: a as never, feedbackAt: new Date() }),
          })),
        },
      },
    });
  };

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });

  beforeEach(async () => {
    await resetDatabase(db.prisma);
    service = new StudioPerformanceService(db.prisma as never);
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
      select: { id: true },
    });
    awa = u.id;
    /* Le catalogue des actions payantes n'est PAS une donnée de référence que
       `resetDatabase` préserve : il se sème par migration puis se vide entre
       deux cas. On le pose donc ici, comme les autres fichiers. */
    const a = await db.prisma.premiumAction.create({
      data: { code: `act_${randomBytes(4).toString("hex")}`, label: "Génération", creditCost: 1 },
      select: { id: true },
    });
    action = a.id;
    const p = await db.prisma.person.create({
      data: { userId: awa, displayName: "Karim" }, select: { id: true },
    });
    const e = await db.prisma.event.create({
      data: { personId: p.id, kind: "birthday", referenceDate: new Date("2027-03-12") },
      select: { id: true },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId: awa, occurrenceDate: new Date("2027-03-12") },
      select: { id: true },
    });
    occurrence = o.id;
  });

  describe("le message", () => {
    it("range chaque avis du bon côté", async () => {
      const v1 = await config("message", 1);
      await message(v1, "sent");
      await message(v1, "sent");
      await message(v1, "rejected");
      await message(v1, "generated");

      const lu = await service.lire("message");
      expect(lu.unite).toBe("message");
      expect(lu.versions[0]).toMatchObject({
        configId: v1, version: 1, produites: 4,
        gestes: { pour: 2, contre: 1, sans: 1 },
        /* AUCUN AVIS N'A ÉTÉ POSÉ : quatre messages traités, zéro pouce. C'est
           ce que la première rédaction ne pouvait pas dire — elle rangeait
           « envoyé » dans la même case qu'un pouce en haut. */
        avis: { pour: 0, contre: 0, sans: 4 },
      });
    });

    /* `edited` COMPTE SANS AVIS, et ce n'est pas un oubli : il dit « je l'ai
       arrangé », pas « il ne va pas ». Un message corrigé puis envoyé porte
       `sent` ; `edited` seul désigne donc un texte touché et jamais confirmé.
       Le ranger du côté négatif mesurerait la retouche au lieu du ratage. */
    it("ne tient pas une retouche pour un rejet", async () => {
      const v1 = await config("message", 1);
      await message(v1, "edited");

      const lu = await service.lire("message");
      expect(lu.versions[0]).toMatchObject({ gestes: { pour: 0, contre: 0, sans: 1 } });
    });

    /* CE QUI N'A PAS DE VERSION SE COMPTE À PART. Une production du gabarit du
       code n'appartient à aucune configuration, et lui en attribuer une ferait
       porter un mérite ou un blâme qui ne sont pas les siens. */
    it("compte à part ce que le code a produit", async () => {
      const v1 = await config("message", 1);
      await message(v1, "sent");
      await message(null, "rejected");

      const lu = await service.lire("message");
      expect(lu.versions[0]).toMatchObject({ produites: 1, gestes: { pour: 1, contre: 0, sans: 0 } });
      expect(lu.horsVersion).toMatchObject({ produites: 1, gestes: { pour: 0, contre: 1, sans: 0 } });
    });

    /* UNE VERSION QUI N'A RIEN PRODUIT PARAÎT QUAND MÊME. Publiée puis
       remplacée le lendemain, elle a zéro production — et c'est un fait à voir :
       la masquer laisserait croire à un trou dans la numérotation, ou pire, à
       une version qu'on aurait oublié de mesurer. */
    it("montre les versions restées sans production", async () => {
      const v1 = await config("message", 1, "superseded");
      const v2 = await config("message", 2);
      await message(v2, "sent");

      const lu = await service.lire("message");
      // De la plus récente à la plus ancienne : « comparée à la précédente »
      // se lit de haut en bas.
      expect(lu.versions.map((v) => v.configId)).toEqual([v2, v1]);
      expect(lu.versions[1]).toMatchObject({
        produites: 0,
        gestes: { pour: 0, contre: 0, sans: 0 },
        avis: { pour: 0, contre: 0, sans: 0 },
      });
    });

    /* LA NATURE SÉPARE. Sans ce cas, on pourrait compter toutes les
       configurations ensemble et ne jamais s'en apercevoir tant qu'une seule
       nature a des productions. */
    it("ne mêle pas les natures", async () => {
      const message1 = await config("message", 1);
      await config("idees", 1);
      await message(message1, "sent");

      const lu = await service.lire("message");
      expect(lu.versions).toHaveLength(1);
      expect(lu.versions[0]?.configId).toBe(message1);
    });
  });

  describe("le portrait", () => {
    /* DEUX COLONNES, DEUX NATURES. `studio_config_id` est le CATALOGUE —
       ambiances, compositions, modèle d'image ; `brief_studio_config_id` est la
       consigne qui a choisi les mots. Un même portrait compte une fois de
       chaque côté, et c'est juste : les deux ont contribué à ce qu'on rejette. */
    it("compte le catalogue et le brief séparément", async () => {
      const catalogue = await config("portrait", 1);
      const brief = await config("portrait_brief", 1);
      await portrait(catalogue, brief, "rejected");
      await portrait(catalogue, brief, "approved");

      const parCatalogue = await service.lire("portrait");
      const parBrief = await service.lire("portrait_brief");

      expect(parCatalogue.versions[0]).toMatchObject({
        configId: catalogue, produites: 2, gestes: { pour: 1, contre: 1, sans: 0 },
      });
      expect(parBrief.versions[0]).toMatchObject({
        configId: brief, produites: 2, gestes: { pour: 1, contre: 1, sans: 0 },
      });
      // L'unité est la même des deux côtés : on compte des portraits.
      expect(parCatalogue.unite).toBe("portrait");
      expect(parBrief.unite).toBe("portrait");
    });

    /* UN BRIEF VENU DU CODE N'EMPÊCHE PAS DE MESURER LE CATALOGUE. Les deux
       liens sont indépendants, et les confondre ferait disparaître la moitié
       des chiffres dès qu'une seule des deux natures est publiée. */
    it("mesure le catalogue même quand le brief vient du code", async () => {
      const catalogue = await config("portrait", 1);
      await portrait(catalogue, null, "rejected");

      expect((await service.lire("portrait")).versions[0])
        .toMatchObject({ produites: 1, gestes: { pour: 0, contre: 1, sans: 0 } });
      expect((await service.lire("portrait_brief")).horsVersion)
        .toMatchObject({ produites: 1, gestes: { pour: 0, contre: 1, sans: 0 } });
    });

    /* LES DEUX ÉTATS SANS AVIS, et le second est le cas le plus fréquent : une
       image composée que personne n'a jugée. La plupart des portraits y
       resteront, puisque refaire n'est pas rejeter et que rien n'oblige à se
       prononcer. Les ranger d'un côté ou de l'autre ferait dire à la moyenne
       l'inverse de ce qui s'est passé. */
    it("laisse le brief et l'image non jugée du côté sans avis", async () => {
      const catalogue = await config("portrait", 1);
      await portrait(catalogue, null, "generated");
      await portrait(catalogue, null, "composed");

      expect((await service.lire("portrait")).versions[0])
        .toMatchObject({ produites: 2, gestes: { pour: 0, contre: 0, sans: 2 } });
    });
  });

  describe("les idées", () => {
    /* L'UNITÉ N'EST PAS LE JEU, C'EST L'IDÉE. Le jeu porte la version, mais
       l'avis se pose idée par idée : compter les jeux dirait « une production »
       là où cinq avis ont été rendus. C'est le piège que `unite` rend visible. */
    it("compte les idées, pas les jeux", async () => {
      const v1 = await config("idees", 1);
      await jeu(v1, ["up", "up", "down", null, null]);

      const lu = await service.lire("idees");
      expect(lu.unite).toBe("idee");
      expect(lu.versions[0]).toMatchObject({
        produites: 5, avis: { pour: 2, contre: 1, sans: 2 },
      });
    });

    it("additionne plusieurs jeux d'une même version", async () => {
      const v1 = await config("idees", 1);
      await jeu(v1, ["up", "down"]);
      await jeu(v1, ["up", null]);

      expect((await service.lire("idees")).versions[0])
        .toMatchObject({ produites: 4, avis: { pour: 2, contre: 1, sans: 1 } });
    });

    it("compte à part les jeux produits sans configuration", async () => {
      const v1 = await config("idees", 1);
      await jeu(v1, ["up"]);
      await jeu(null, ["down", "down"]);

      const lu = await service.lire("idees");
      expect(lu.versions[0]).toMatchObject({ produites: 1, avis: { pour: 1, contre: 0, sans: 0 } });
      expect(lu.horsVersion).toMatchObject({ produites: 2, avis: { pour: 0, contre: 2, sans: 0 } });
    });
  });

  /* RIEN N'EST UN ÉTAT LÉGITIME, pas une panne : c'est celui d'un atelier neuf,
     et le panneau doit savoir l'afficher plutôt que de tomber. */
  it("rend des compteurs à zéro quand rien n'a été produit", async () => {
    const lu = await service.lire("message");
    expect(lu.versions).toEqual([]);
    expect(lu.horsVersion).toEqual({
      produites: 0,
      gestes: { pour: 0, contre: 0, sans: 0 },
      avis: { pour: 0, contre: 0, sans: 0 },
    });
  });
  /* ─── Les deux axes ne se fondent pas ────────────────────────────────────── */

  /* ON PEUT GARDER SANS AIMER, et c'est le cas que la première rédaction ne
   * pouvait pas rendre : elle tenait UN seul couple, et la même colonne ne
   * comptait pas la même chose selon la nature — le STATUT pour le message et
   * le portrait, l'AVIS pour les idées. « Envoyé » et « pouce en haut »
   * tombaient dans la même case, sous un schéma unique, dans un écran fait
   * pour comparer les trois.
   *
   * Le brief mobile de l'avis s'ouvre pourtant là-dessus : « le statut dit ce
   * qu'on FAIT de l'objet, l'avis ce qu'on en PENSE, et c'est un pas de plus ». */
  describe("le geste et l'avis", () => {
    it("distingue un message envoyé d'un message aimé", async () => {
      const v1 = await config("message", 1);
      // Envoyé sans un mot : le geste est franchi, l'avis jamais donné.
      await message(v1, "sent");
      /* Gardé en brouillon, et jugé mauvais : l'inverse exact. Écrit
         directement, l'aide ne rendant pas d'identifiant. */
      await db.prisma.generatedMessage.create({
        data: {
          actionRunId: await execution(), userId: awa, eventOccurrenceId: occurrence,
          content: "Un texte", status: "generated", studioConfigId: v1,
          feedback: "down", feedbackAt: new Date(),
        },
      });

      const lu = await service.lire("message");

      expect(lu.versions[0]).toMatchObject({
        produites: 2,
        gestes: { pour: 1, contre: 0, sans: 1 },
        avis: { pour: 0, contre: 1, sans: 1 },
      });
    });

    /* LE GESTE D'UNE IDÉE EST D'ÊTRE RETENUE — elle devient un souhait —, et
     * la première rédaction prenait son AVIS pour son geste. Le service des
     * idées le dit depuis toujours : « parmi ce que le modèle a proposé,
     * qu'est-ce qui a été retenu, qui est la seconde mesure de pertinence après
     * l'avis ». */
    it("compte la retenue d'une idée comme un geste, et son pouce comme un avis", async () => {
      const v1 = await config("idees", 1);
      const jeu = await db.prisma.generatedIdeaSet.create({
        data: {
          actionRunId: await execution(), userId: awa, studioConfigId: v1,
          ideas: {
            create: [
              /* LE DÉCOR EST ASYMÉTRIQUE À DESSEIN : deux retenues, un seul
                 pouce. Avec une de chaque, les deux axes rendent les mêmes
                 nombres et le cas ne distingue plus rien — il passait au vert
                 alors même que le geste d'une idée redevenait son avis. */
              // Retenue, et jamais notée.
              { label: "Un carnet", position: 0, acceptedAt: new Date() },
              // Notée bonne, et jamais retenue.
              { label: "Un vinyle", position: 1, feedback: "up", feedbackAt: new Date() },
              // Retenue elle aussi, et muette.
              { label: "Des gants", position: 2, acceptedAt: new Date() },
            ],
          },
        },
        select: { id: true },
      });
      expect(jeu.id).toBeTruthy();

      const lu = await service.lire("idees");

      expect(lu.versions[0]).toMatchObject({
        produites: 3,
        gestes: { pour: 2, contre: 0, sans: 1 },
        avis: { pour: 1, contre: 0, sans: 2 },
      });
    });
  });
});
