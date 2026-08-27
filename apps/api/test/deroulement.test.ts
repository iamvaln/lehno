import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { DeroulementService } from "../src/me/deroulement.service.js";

/* Le déroulement des échéances dans le temps.
 *
 * C'est le défaut le plus coûteux du produit parce qu'il ne se voit pas : une
 * seule échéance s'ouvrait à la création, et passée, rien n'ouvrait la suivante.
 * L'application se taisait au bout d'un an, sans erreur nulle part. */
describe("le déroulement des échéances", () => {
  let db: TestDb;
  let deroulement: DeroulementService;
  let awa: string;
  let personne: string;

  const jour = (dans: number): string =>
    new Date(Date.now() + dans * 86_400_000).toISOString().slice(0, 10);

  const dateDe = (d: string): Date => new Date(`${d}T00:00:00Z`);

  // Un événement nu, sans passer par EventService : ce cas éprouve le
  // déroulement, pas la création.
  const evenement = async (
    reference: string,
    regles: { type: string; unit?: string; interval?: number; offsetUnit?: string; offsetAmount?: number }[] = [],
  ): Promise<string> => {
    const e = await db.prisma.event.create({
      data: {
        personId: personne,
        authorUserId: awa,
        kind: "other",
        label: "Jalon",
        referenceDate: dateDe(reference),
        schedules: { create: regles.map((r) => ({ ...r })) as never },
      },
      select: { id: true },
    });
    return e.id;
  };

  const echeancesDe = async (eventId: string): Promise<string[]> => {
    const l = await db.prisma.eventOccurrence.findMany({
      where: { eventId }, orderBy: { occurrenceDate: "asc" },
      select: { occurrenceDate: true },
    });
    return l.map((o) => o.occurrenceDate.toISOString().slice(0, 10));
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    deroulement = new DeroulementService(db.prisma as never);
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    awa = u.id;
    const p = await db.prisma.person.create({
      data: { userId: awa, displayName: "Valery" }, select: { id: true },
    });
    personne = p.id;
  });

  /* LE cas. Un anniversaire dont l'échéance vient de passer doit en recevoir
     une nouvelle — sinon l'application se tait, et personne ne le remarque
     avant le prochain anniversaire manqué. */
  it("rouvre une échéance quand la précédente est passée", async () => {
    const id = await evenement(jour(-10), [{ type: "recurrent", unit: "year", interval: 1 }]);
    expect(await echeancesDe(id)).toEqual([]);

    await deroulement.derouler();

    const apres = await echeancesDe(id);
    expect(apres.length).toBeGreaterThan(0);
    // Toutes à venir : dérouler ne ressuscite pas le passé.
    for (const d of apres) expect(d >= jour(0)).toBe(true);
  });

  /* La propriété qui compte le plus : un ordonnanceur se relance — au
     redémarrage, après une panne, ou parce que deux instances tournent. */
  it("est idempotent : deux passages ne doublent rien", async () => {
    const id = await evenement(jour(-10), [{ type: "recurrent", unit: "year", interval: 1 }]);

    await deroulement.derouler();
    const apresUn = await echeancesDe(id);
    await deroulement.derouler();
    const apresDeux = await echeancesDe(id);

    expect(apresDeux).toEqual(apresUn);
  });

  // Même sous concurrence : la garantie vient de la contrainte d'unicité, pas
  // d'un verrou applicatif — un verrou se perdrait au redémarrage.
  it("ne double pas non plus quand deux passages se croisent", async () => {
    const id = await evenement(jour(-10), [{ type: "recurrent", unit: "year", interval: 1 }]);
    await Promise.all([deroulement.derouler(), deroulement.derouler(), deroulement.derouler()]);
    const dates = await echeancesDe(id);
    expect(new Set(dates).size).toBe(dates.length);
  });

  /* Un événement libre SANS règle n'a qu'une date : la sienne. Passée, il n'y a
     plus rien à ouvrir — un mariage ne se répète pas tous les ans. C'est le
     comportement que la constante en dur masquait jusqu'ici. */
  it("n'invente aucune récurrence pour un événement qui n'en a pas", async () => {
    const id = await evenement(jour(-10));
    await deroulement.derouler();
    expect(await echeancesDe(id)).toEqual([]);
  });

  it("ouvre son unique échéance à un événement sans règle mais à venir", async () => {
    const id = await evenement(jour(20));
    await deroulement.derouler();
    expect(await echeancesDe(id)).toEqual([jour(20)]);
  });

  /* Le calendrier montre douze mois : sans profondeur, février paraîtrait vide
     alors qu'il porte trois anniversaires. */
  it("garde plusieurs échéances ouvertes devant, pas une seule", async () => {
    const id = await evenement(jour(-10), [{ type: "recurrent", unit: "month", interval: 1 }]);
    await deroulement.derouler();
    expect((await echeancesDe(id)).length).toBeGreaterThanOrEqual(3);
  });

  // Les plus PROCHES d'abord : le plafond ne doit pas ouvrir 2029 en laissant
  // 2027 de côté.
  it("ouvre les échéances les plus proches, jamais les plus lointaines", async () => {
    const id = await evenement(jour(-10), [{ type: "recurrent", unit: "month", interval: 1 }]);
    await deroulement.derouler();
    const dates = await echeancesDe(id);
    const triees = [...dates].sort();
    expect(dates).toEqual(triees);
    // La première tombe dans le mois qui vient, pas dans un an.
    expect(dates[0]! <= jour(35)).toBe(true);
  });

  /* La dérive, encore : chaque échéance se calcule depuis la RÉFÉRENCE. Le
     déroulement rouvre à partir de la référence d'origine, jamais à partir de
     la dernière échéance ouverte — sinon le décalage s'accumule à chaque
     passage de l'ordonnanceur, ce qui est pire que dans le calcul initial. */
  it("recalcule depuis la référence, jamais depuis la dernière ouverte", async () => {
    // Le 31 d'un mois : c'est là que le rabattage sur le dernier jour révèle
    // la dérive. Trois mois plus tard le 30 ; encore trois, le 30 au lieu du 31
    // si l'on repartait de la précédente.
    const reference = "2020-01-31";
    const id = await evenement(reference, [{ type: "recurrent", unit: "quarter", interval: 1 }]);
    await deroulement.derouler();
    const dates = await echeancesDe(id);

    // Chaque date ouverte doit retomber sur un 31, ou sur le dernier jour du
    // mois quand il n'a pas de 31 — jamais sur un 30 d'un mois qui en a 31.
    for (const d of dates) {
      const [a, m] = d.split("-").map(Number) as [number, number];
      const dernierDuMois = new Date(Date.UTC(a, m, 0)).getUTCDate();
      const attendu = Math.min(31, dernierDuMois);
      expect(Number(d.slice(8)), `${d} a dérivé`).toBe(attendu);
    }
  });

  // Un événement déjà pourvu n'est pas retouché : le déroulement ne doit pas
  // coûter une écriture par événement à chaque passage.
  it("ne touche pas un événement qui a déjà sa profondeur", async () => {
    const id = await evenement(jour(-10), [{ type: "recurrent", unit: "year", interval: 1 }]);
    await deroulement.derouler();
    const bilan = await deroulement.derouler();
    expect(bilan.ouvertes).toBe(0);
    expect(bilan.evenements).toBe(0);
    void id;
  });
});
