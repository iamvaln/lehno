import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* LE TIRER-POUR-RAFRAÎCHIR, PARTOUT OÙ L'ÉCRAN LIT LE SERVEUR — §8 du relevé
 * des essais. Trois écrans le portaient (accueil, dates, reprises) ; tout le
 * reste en était dépourvu, et l'écart s'est cumulé sans qu'aucun test ne le
 * remarque — chaque écran est correct pris seul, c'est leur ensemble qui ne
 * l'était pas.
 *
 * LA RÈGLE, telle qu'établie dans le relevé : tout écran qui LISTE ce que le
 * serveur détient le porte ; aucun formulaire, aucun écran d'attente qui
 * interroge déjà en boucle (génération, portrait) ne le porte.
 *
 * `react-native` est typé en Flow, un test qui monterait chaque écran ne
 * compilerait pas — cette garde lit donc la SOURCE, comme les autres gardes
 * de ce fichier de relevé.
 */
const ECRANS: readonly string[] = [
  "souhaits", "recharge", "listes", "apercu-liste", "mouvements", "occasion",
  "valider",
  "(app)/reglages/index", "(app)/reglages/securite", "(app)/reglages/paiement",
  "(app)/reglages/rappels", "(app)/accueil/notifications", "(app)/moi/index",
  "(app)/moi/parrainage", "(app)/moi/apercu", "(app)/moi/monmur",
  "(app)/moi/reservations", "(app)/proches/index", "(app)/proches/[id]",
];

const source = (ecran: string): string =>
  readFileSync(new URL(`../app/${ecran}.tsx`, import.meta.url), "utf8");

describe("le tirer-pour-rafraîchir couvre les écrans qui lisent le serveur", () => {
  for (const ecran of ECRANS) {
    it(`app/${ecran}.tsx le porte`, () => {
      const s = source(ecran);
      expect(s).toContain("RefreshControl");
      expect(s).toContain("refreshControl={");
      expect(s).toContain("refreshing={rafraichit}");
    });
  }
});
