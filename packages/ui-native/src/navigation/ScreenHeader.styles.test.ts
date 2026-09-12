import { describe, expect, it } from "vitest";
import { nativeTouchMin, resolve } from "@lehno/tokens";
import { styleDEntete } from "./ScreenHeader.styles.js";

const THEMES = [["clair", resolve("light")], ["sombre", resolve("dark")]] as const;

describe("l'en-tête d'un écran empilé", () => {
  /* LA FLÈCHE GARDE SES 44 POINTS. Chaque écran la dessinait à la main, et la
     cible tactile était la première chose qu'une réécriture perdait — on ne le
     voit pas à l'œil, seulement au doigt qui rate. */
  it("garde la cible tactile de la flèche", () => {
    const s = styleDEntete(resolve("light"));
    expect(s.retour.width).toBe(nativeTouchMin);
    expect(s.retour.height).toBe(nativeTouchMin);
  });

  /* La cible déborde du bord de onze points ; la marge négative la ramène, sans
     quoi l'icône paraîtrait rentrée par rapport au contenu dessous. */
  it("recale la flèche sur le bord malgré sa cible", () => {
    const s = styleDEntete(resolve("light"));
    expect(s.rangee.marginLeft).toBeLessThan(0);
    expect(Math.abs(Number(s.rangee.marginLeft))).toBeLessThan(nativeTouchMin);
  });

  /* LE TITRE S'ÉLIDE, LA RANGÉE NE GRANDIT PAS. Sans `flex: 1` sur le texte,
     un nom long pousserait la rangée sur deux lignes et la flèche se
     retrouverait centrée entre elles. */
  it("laisse le titre s'élider plutôt que grandir la rangée", () => {
    const s = styleDEntete(resolve("light"));
    expect(s.titre.flex).toBe(1);
    expect(s.rangee.minHeight).toBe(nativeTouchMin);
  });

  for (const [nom, couleurs] of THEMES) {
    it(`prend l'encre du corps de texte en ${nom}`, () => {
      expect(styleDEntete(couleurs).titre.color).toBe(couleurs.textBody);
    });
  }
});
