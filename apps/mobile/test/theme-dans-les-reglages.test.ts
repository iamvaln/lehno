import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* LE THÈME VIT DANS LES RÉGLAGES, ET S'APPLIQUE SOUS LE DOIGT — §9 du relevé
 * des essais. Il vivait dans le profil, et n'agissait qu'à l'enregistrement :
 * deux défauts distincts, la même correction.
 *
 * LE PROFIL PORTE QUI L'ON EST ; LES RÉGLAGES PORTENT CE QUI RÈGLE LE PRODUIT.
 * La langue avait déjà fait ce chemin — le thème le fait à son tour.
 */
const profil = (): string =>
  readFileSync(new URL("../app/profil.tsx", import.meta.url), "utf8");

const reglages = (): string =>
  readFileSync(new URL("../app/(app)/reglages/index.tsx", import.meta.url), "utf8");

describe("le thème quitte le profil pour les réglages", () => {
  it("le profil n'offre plus de sélecteur de thème", () => {
    expect(profil()).not.toContain("THEMES_ORDONNES");
  });

  it("les réglages portent le sélecteur de thème", () => {
    const s = reglages();
    expect(s).toContain("THEMES_ORDONNES");
    expect(s).toContain("champTheme");
  });

  // Immédiat : `changeLeTheme` doit s'appeler depuis le `onPress` de la
  // bascule elle-même, jamais depuis un geste d'enregistrement — et cet
  // écran n'a d'ailleurs pas de bouton « Enregistrer ».
  it("les réglages n'ont pas de bouton d'enregistrement", () => {
    expect(reglages()).not.toContain("t.enregistrer");
  });

  it("le choix de thème appelle le changement au premier appui", () => {
    const s = reglages();
    expect(s).toContain("onPress={() => changeLeTheme(cle)}");
  });
});
