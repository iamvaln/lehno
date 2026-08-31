import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { INTENTIONS, styleDeBandeau } from "./Banner.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");

describe("le bandeau", () => {
  /* Chaque intention apparie une couleur d'encre et son fond. Une inversion —
     l'encre de l'avertissement sur le fond de l'erreur — resterait lisible et
     mentirait sur la gravité : c'est le genre de faute qu'aucun œil n'attrape. */
  it("apparie chaque encre à son propre fond, dans les deux thèmes", () => {
    for (const couleurs of [CLAIR, SOMBRE]) {
      for (const intention of INTENTIONS) {
        const s = styleDeBandeau({ couleurs, intention });
        const suffixe = intention.slice(0, 1).toUpperCase() + intention.slice(1);
        expect(s.texte.color, intention).toBe(couleurs[`feedback${suffixe}` as keyof typeof couleurs]);
        expect(s.conteneur.backgroundColor, intention).toBe(couleurs[`feedback${suffixe}Bg` as keyof typeof couleurs]);
      }
    }
  });

  /* Un bandeau tient toute la largeur : ni rayon, ni trait, ni ombre. Ce n'est
     pas une carte posée dans la page, c'est une bande qui la traverse. */
  it("traverse la page sans se refermer en carte", () => {
    const s = styleDeBandeau({ couleurs: CLAIR });
    expect(s.conteneur.borderRadius).toBe(0);
    expect(s.conteneur).not.toHaveProperty("borderWidth");
    expect(s.conteneur).not.toHaveProperty("shadowColor");
  });

  // Une erreur interrompt ; le reste informe. Le lecteur d'écran doit faire la
  // différence, sinon tout devient également urgent — donc rien ne l'est.
  it("n'interrompt le lecteur d'écran que pour une erreur", () => {
    expect(styleDeBandeau({ couleurs: CLAIR, intention: "error" }).urgence).toBe("assertive");
    for (const intention of ["info", "success", "warning"] as const) {
      expect(styleDeBandeau({ couleurs: CLAIR, intention }).urgence, intention).toBe("polite");
    }
  });

  it("donne à chaque intention son signe", () => {
    expect(styleDeBandeau({ couleurs: CLAIR, intention: "error" }).icone).toBe("circle-x");
    expect(styleDeBandeau({ couleurs: CLAIR, intention: "success" }).icone).toBe("circle-check");
  });
});
