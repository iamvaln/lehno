import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withDatabase, type TestDb } from "./db.js";

/* La semence des motifs, éprouvée SUR SA BASE À ELLE.
 *
 * Ce fichier ne crée aucun motif et n'appelle pas `resetDatabase` : il regarde
 * ce que la migration a posé, rien d'autre.
 *
 * C'est structurel, pas de la prudence. `audit_reason` est une table de
 * référence, que `resetDatabase` PRÉSERVE — un test qui ajoute un motif le
 * laisse derrière lui pour tous les suivants. Compter la semence dans un
 * fichier qui en fabrique donnerait un total juste au premier passage et faux
 * ensuite, sans que l'ordre d'exécution ne se voie nulle part. */
describe("la semence des motifs", () => {
  let db: TestDb;

  beforeAll(async () => { db = await withDatabase(); }, 180_000);
  afterAll(async () => { await db.close(); });

    it("porte les cent un motifs du kit, dans les deux langues", async () => {
    expect(await db.prisma.auditReason.count({ where: { isActive: true } })).toBe(101);
    const g = await db.prisma.auditReason.findUniqueOrThrow({ where: { code: "goodwill" } });
    expect(g.labelFr).toBe("Geste commercial");
    expect(g.labelEn).toBe("Goodwill");
  });

  /* Le kit et le serveur écrivaient deux jeux de codes sans un seul en
     commun. Ce cas garde la trace de l'arbitrage : les codes sont anglais,
     comme tout identifiant du dépôt. */
  it("n'a aucun code tiré du français", async () => {
    const francais = await db.prisma.auditReason.count({
      where: { isActive: true, code: { in: ["abus_constate", "acces_compromis", "demande_titulaire"] } },
    });
    expect(francais).toBe(0);
  });

  /* Retirés, jamais effacés : ils n'ont rien justifié à ce jour, mais la
     règle ne dépend pas de ça — c'est elle qui rend un historique relisible
     quand elle s'applique au cas où ça compte. */
  it("retire les doublons anglais sans les effacer", async () => {
    for (const code of ["goodwill_gesture", "fixing_a_mistake", "account_holder_s_request"]) {
      const m = await db.prisma.auditReason.findUnique({ where: { code } });
      expect(m).not.toBeNull();
      expect(m!.isActive).toBe(false);
    }
  });

  // Un motif retiré ne se propose plus, quelque geste que ce soit.
  it("ne propose aucun motif retiré", async () => {
    const propose = await db.prisma.auditReasonScope.count({
      where: { reason: { isActive: false } },
    });
    expect(propose).toBe(0);
  });
});
