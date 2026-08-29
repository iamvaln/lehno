import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { BOITE, ILLUSTRATIONS, ROLES_D_ILLUSTRATION } from "./Illustration.data.js";
import { couleursDIllustration, hauteurDIllustration } from "./Illustration.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");

describe("la table des illustrations", () => {
  it("porte les deux illustrations du parcours d'entrée", () => {
    expect(ILLUSTRATIONS["verification-code"]).toBeDefined();
    expect(ILLUSTRATIONS["bienvenue-credits"]).toBeDefined();
  });

  /* Les tracés traversent du web au natif sans retouche — ce sont des
     coordonnées. Seules les couleurs changent de forme. Si une variable CSS
     avait survécu à la conversion, react-native-svg rendrait du noir sans rien
     signaler : le défaut serait invisible jusqu'à l'écran. */
  it("ne garde aucune couleur, seulement des rôles", () => {
    for (const [nom, formes] of Object.entries(ILLUSTRATIONS)) {
      for (const [, attrs] of formes) {
        expect(ROLES_D_ILLUSTRATION, `${nom} — ${attrs.fill}`).toContain(attrs.fill);
      }
    }
  });

  // Aucun contour, aucune ombre, aucun dégradé : un seul objet par image.
  it("ne pose ni contour ni ombre", () => {
    for (const [nom, formes] of Object.entries(ILLUSTRATIONS)) {
      for (const [, attrs] of formes) {
        expect(attrs, nom).not.toHaveProperty("stroke");
        expect(attrs, nom).not.toHaveProperty("filter");
      }
    }
  });
});

describe("les couleurs d'une illustration", () => {
  // Les trois rôles viennent de la charte. Le thème sombre les rejoue — la
  // masse s'éclaircit, la forme s'assombrit — et l'accent chaud ne bouge pas.
  it("résout les trois rôles depuis le thème", () => {
    expect(couleursDIllustration(CLAIR).mass).toBe(CLAIR.illusMass);
    expect(couleursDIllustration(SOMBRE).form).toBe(SOMBRE.illusForm);
    expect(couleursDIllustration(CLAIR).warm).toBe(couleursDIllustration(SOMBRE).warm);
  });

  // La boîte fait 200 × 160 : la hauteur suit la largeur demandée, sinon
  // l'illustration se déforme.
  it("garde le rapport de la boîte", () => {
    expect(hauteurDIllustration(140)).toBe(140 * (BOITE.hauteur / BOITE.largeur));
  });
});
