import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { CatalogueIAService } from "../src/ia/catalogue.service.js";
import { CHAINES_PAR_DEFAUT, CLES_MODELES, MODELES_IA, TACHES_IA } from "@lehno/contracts";

/* Le catalogue au démarrage.
 *
 * Ces cas visent une seule propriété, et c'est celle qui coûte cher : un
 * redémarrage ne doit RIEN écraser de ce qu'un humain a réglé. Le défaut
 * classique de ces mécaniques est le semis qui « remet les valeurs par défaut »
 * à chaque déploiement — on cherche alors longtemps pourquoi le réglage ne
 * tient pas, et on accuse la base. */
describe("le catalogue des modèles d'IA", () => {
  let db: TestDb;
  let catalogue: CatalogueIAService;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    catalogue = new CatalogueIAService(db.prisma as never);
  });

  it("sème le catalogue et les chaînes sur une base vide", async () => {
    await catalogue.reconcilier();

    expect(await db.prisma.aIModel.count()).toBe(CLES_MODELES.length);
    for (const tache of TACHES_IA) {
      const n = await db.prisma.aITaskRoute.count({ where: { task: tache } });
      expect(n).toBe(CHAINES_PAR_DEFAUT[tache].length);
    }
  });

  it("range les rangs dans l'ordre du registre", async () => {
    await catalogue.reconcilier();
    const rangs = await db.prisma.aITaskRoute.findMany({
      where: { task: "message" }, orderBy: { rank: "asc" }, include: { model: true },
    });
    expect(rangs.map((r) => `${r.model.provider}:${r.model.modelKey}`))
      .toEqual([...CHAINES_PAR_DEFAUT.message]);
  });

  it("n'ouvre que des chaînes dont la capacité correspond à la tâche", async () => {
    await catalogue.reconcilier();
    const images = await db.prisma.aITaskRoute.findMany({
      where: { task: { in: ["illustration", "photo_style"] } }, include: { model: true },
    });
    expect(images.length).toBeGreaterThan(0);
    for (const r of images) expect(r.model.capability).toBe("image");
  });

  it("est idempotente : deux passages ne doublent rien", async () => {
    await catalogue.reconcilier();
    await catalogue.reconcilier();
    expect(await db.prisma.aIModel.count()).toBe(CLES_MODELES.length);
    expect(await db.prisma.aITaskRoute.count({ where: { task: "message" } }))
      .toBe(CHAINES_PAR_DEFAUT.message.length);
  });

  /* LA propriété. Sans elle, chaque déploiement rallume un modèle qu'on avait
     coupé, ou efface le tarif qu'on venait de saisir. */
  it("ne touche jamais un modèle déjà en base", async () => {
    await catalogue.reconcilier();
    const un = await db.prisma.aIModel.findFirstOrThrow({ where: { provider: "anthropic" } });
    await db.prisma.aIModel.update({
      where: { id: un.id }, data: { enabled: false, costInput: "1.5" },
    });

    await catalogue.reconcilier();

    const apres = await db.prisma.aIModel.findUniqueOrThrow({ where: { id: un.id } });
    expect(apres.enabled).toBe(false);
    expect(Number(apres.costInput)).toBe(1.5);
  });

  /* Une chaîne est un ORDRE, pas une collection de lignes indépendantes.
     Compléter rang par rang remettrait en tête, dans un trou laissé par un
     déclassement, le modèle qu'on venait justement d'écarter. */
  it("ne recompose pas une chaîne que l'administration a réduite", async () => {
    await catalogue.reconcilier();
    const rangs = await db.prisma.aITaskRoute.findMany({
      where: { task: "message" }, orderBy: { rank: "asc" },
    });
    await db.prisma.aITaskRoute.deleteMany({ where: { id: rangs[0]!.id } });

    await catalogue.reconcilier();

    const apres = await db.prisma.aITaskRoute.findMany({ where: { task: "message" } });
    expect(apres).toHaveLength(rangs.length - 1);
  });

  it("ne réordonne pas une chaîne que l'administration a inversée", async () => {
    await catalogue.reconcilier();
    const rangs = await db.prisma.aITaskRoute.findMany({
      where: { task: "message" }, orderBy: { rank: "asc" }, select: { id: true, modelId: true },
    });
    const inverse = [...rangs].reverse();
    await db.prisma.$transaction([
      db.prisma.aITaskRoute.deleteMany({ where: { task: "message" } }),
      db.prisma.aITaskRoute.createMany({
        data: inverse.map((r, i) => ({ task: "message" as const, modelId: r.modelId, rank: i + 1 })),
      }),
    ]);

    await catalogue.reconcilier();

    const apres = await db.prisma.aITaskRoute.findMany({
      where: { task: "message" }, orderBy: { rank: "asc" }, select: { modelId: true },
    });
    expect(apres.map((r) => r.modelId)).toEqual(inverse.map((r) => r.modelId));
  });

  /* Un modèle retiré du registre ne se SUPPRIME pas : l'historique d'usage le
     référence, et la facturation d'hier doit rester lisible. Le retirer du
     catalogue est un geste d'administration, pas un effet de bord du semis. */
  it("ne supprime pas un modèle absent du registre", async () => {
    await catalogue.reconcilier();
    const intrus = await db.prisma.aIModel.create({
      data: { provider: "fournisseur-retire", modelKey: "vieux-modele" },
    });

    await catalogue.reconcilier();

    expect(await db.prisma.aIModel.findUnique({ where: { id: intrus.id } })).not.toBeNull();
  });

  // Le registre et la base doivent parler de la même chose. Une clé du registre
  // qui ne désigne aucun modèle laisserait un trou dans les rangs, et l'écran
  // afficherait « rang 3 » sur ce qui est en réalité le second essai.
  it("chaque chaîne du registre ne cite que des modèles du registre", () => {
    for (const tache of TACHES_IA)
      for (const cle of CHAINES_PAR_DEFAUT[tache])
        expect(MODELES_IA[cle], `${tache} cite ${cle}`).toBeDefined();
  });
});
