import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* LE SÉLECTEUR NATIF DE DATE, PAS TROIS RÉINVENTIONS — §2 du relevé des
 * essais. Trois écrans (identité d'un proche, profil, événement) posaient
 * chacun leur propre rangée de jours + grille de mois, et aucun ne bornait le
 * jour au mois choisi : on pouvait y saisir le 31 février. Direct
 * instruction : « Fais un datepicker standard alors » — plus de réinvention,
 * le contrôle de la plateforme.
 *
 * ÉVÉNEMENT N'EST PAS CONCERNÉ : il ne saisit pas une naissance, il choisit
 * la date d'une occasion libre, et borne déjà le jour au mois via
 * `borneLeJour`/`joursDuMois` (voir lib/evenement.ts). Seuls les deux écrans
 * qui saisissaient une naissance migrent.
 */
const ECRANS: readonly string[] = ["(app)/proches/identite", "profil"];

const source = (ecran: string): string =>
  readFileSync(new URL(`../app/${ecran}.tsx`, import.meta.url), "utf8");

describe("la naissance se saisit au sélecteur natif, pas à la main", () => {
  for (const ecran of ECRANS) {
    it(`app/${ecran}.tsx porte le sélecteur natif`, () => {
      const s = source(ecran);
      expect(s).toContain("BirthDatePicker");
    });

    it(`app/${ecran}.tsx n'a plus la rangée de jours ni la grille de mois faites main`, () => {
      const s = source(ecran);
      expect(s).not.toContain("RangeeDeJours");
      expect(s).not.toContain("<Pastille");
    });
  }
});
