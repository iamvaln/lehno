import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AttributsService } from "../src/me/attributs.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";

/* Le topo d'un proche.
 *
 * Un seul comportement compte vraiment ici, et c'est celui qui ne se voit pas :
 * QUELLE valeur gagne quand deux notes parlent de la même chose. */
describe("les attributs extraits des notes", () => {
  let db: TestDb;
  let attributs: AttributsService;
  let awa: string;
  let valery: string;

  const jour = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

  const noteLe = async (iso: string): Promise<string> => {
    const n = await db.prisma.note.create({
      data: { personId: valery, authorUserId: awa, content: "une note", createdAt: jour(iso) },
      select: { id: true },
    });
    return n.id;
  };

  const poser = (kind: string, value: string, iso: string, noteId: string | null = null) =>
    attributs.poser(valery, {
      kind: kind as never, value, noteId, observedAt: jour(iso),
    });

  const lu = async (kind: string): Promise<{ value: string; observedAt: Date } | null> =>
    db.prisma.personAttribute.findFirst({
      where: { personId: valery, kind: kind as never },
      select: { value: true, observedAt: true },
    });

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    attributs = new AttributsService(
      new TenantRepository(db.prisma as never), db.prisma as never,
    );
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
      data: { userId: awa, displayName: "Valery" }, select: { id: true },
    });
    valery = p.id;
  });

  it("pose une valeur sur une fiche vierge", async () => {
    await poser("color", "bleu", "2026-03-01");
    expect((await lu("color"))?.value).toBe("bleu");
  });

  // Le plus récent l'emporte : quelqu'un aime le bleu en mars et le vert en
  // septembre, c'est le vert qu'on retient.
  it("remplace par la valeur d'une note plus récente", async () => {
    await poser("color", "bleu", "2026-03-01");
    await poser("color", "vert", "2026-09-01");
    expect((await lu("color"))?.value).toBe("vert");
  });

  /* LA GARDE DU LOT.
   *
   * Traitée dans le désordre — ce qui arrive au premier rattrapage d'arriéré,
   * où tout un historique se traite d'un coup —, une note de mars ne doit pas
   * écraser celle de septembre. Comparer sur l'ordre d'écriture le laisserait
   * passer, et rien ne le signalerait : la fiche afficherait simplement une
   * couleur périmée. */
  it("n'écrase PAS avec une note plus ancienne, même traitée après", async () => {
    await poser("color", "vert", "2026-09-01");
    await poser("color", "bleu", "2026-03-01");

    const apres = await lu("color");
    expect(apres?.value).toBe("vert");
    expect(apres?.observedAt.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  // Deux notes du même jour : la seconde traitée gagne. Il n'y a rien de mieux
  // à faire — la date est tout ce qu'on a pour les départager.
  it("accepte une note du même jour", async () => {
    await poser("color", "bleu", "2026-03-01");
    await poser("color", "vert", "2026-03-01");
    expect((await lu("color"))?.value).toBe("vert");
  });

  // Une seule valeur par nature, mais autant de natures qu'on veut.
  it("garde une valeur par nature, sans les mélanger", async () => {
    await poser("color", "bleu", "2026-03-01");
    await poser("animal", "chat", "2026-03-01");
    await poser("color", "vert", "2026-09-01");

    expect((await lu("color"))?.value).toBe("vert");
    expect((await lu("animal"))?.value).toBe("chat");
    expect(await db.prisma.personAttribute.count({ where: { personId: valery } })).toBe(2);
  });

  /* La provenance voyage avec la valeur : sans elle, un attribut est une
     affirmation sans source, qu'on ne peut ni vérifier ni corriger. */
  it("retient la note d'où la valeur vient", async () => {
    const n = await noteLe("2026-03-01");
    await poser("color", "bleu", "2026-03-01", n);
    const ligne = await db.prisma.personAttribute.findFirstOrThrow({ where: { personId: valery } });
    expect(ligne.noteId).toBe(n);
  });

  /* La valeur SURVIT à la note effacée. Ce qu'une phrase a appris ne s'efface
     pas avec elle — sinon supprimer une note viderait le topo, alors que
     l'information reste vraie. */
  it("survit à la suppression de la note dont elle vient", async () => {
    const n = await noteLe("2026-03-01");
    await poser("color", "bleu", "2026-03-01", n);
    await db.prisma.note.delete({ where: { id: n } });

    const ligne = await lu("color");
    expect(ligne?.value).toBe("bleu");
    const brut = await db.prisma.personAttribute.findFirstOrThrow({ where: { personId: valery } });
    expect(brut.noteId).toBeNull();
  });

  describe("la lecture", () => {
    it("rend le topo d'un proche", async () => {
      await poser("color", "bleu", "2026-03-01");
      await poser("animal", "chat", "2026-03-01");
      const liste = await attributs.lister(awa, valery);
      expect(liste.map((a) => a.kind).sort()).toEqual(["animal", "color"]);
    });

    // Une fiche neuve n'a rien appris : liste vide, et c'est normal — le client
    // n'affiche alors aucun bloc, jamais une grille de cases vides.
    it("rend une liste vide sur une fiche neuve", async () => {
      expect(await attributs.lister(awa, valery)).toEqual([]);
    });

    /* Le proche d'un autre N'EXISTE PAS pour le demandeur : 404, jamais 403 —
       un 403 confirmerait que la fiche existe. */
    it("ne rend rien sur le proche de quelqu'un d'autre", async () => {
      const autre = await db.prisma.user.create({
        data: {
          email: `${randomBytes(6).toString("hex")}@example.com`,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        select: { id: true },
      });
      await expect(attributs.lister(autre.id, valery))
        .rejects.toMatchObject({ code: "not_found" });
    });
  });
});
