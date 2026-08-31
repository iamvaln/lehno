import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { initiale, styleDAvatar } from "./Avatar.styles.js";

const CLAIR = resolve("light");

describe("l'initiale", () => {
  it("prend la première lettre, en capitale", () => {
    expect(initiale("Awa Diop")).toBe("A");
    expect(initiale("valery bah")).toBe("V");
  });

  // Les prénoms du produit ne sont pas tous en ASCII : É doit rester É, et non
  // devenir E ni disparaître.
  it("garde les lettres accentuées", () => {
    expect(initiale("Élodie")).toBe("É");
  });

  // Un nom qui commence par une espace donnerait une pastille vide.
  it("ignore l'espace de tête", () => {
    expect(initiale("  Rose")).toBe("R");
  });

  // Une fiche sans nom ne doit pas rendre une pastille muette : le point
  // d'interrogation dit qu'il manque quelque chose.
  it("retombe sur un point d'interrogation quand il n'y a pas de nom", () => {
    expect(initiale("")).toBe("?");
    expect(initiale("   ")).toBe("?");
  });
});

describe("le style de l'avatar", () => {
  // « borderRadius: 50% » n'a pas d'équivalent fiable en RN : c'est la moitié
  // du côté qui fait le cercle.
  it("fait un cercle par la moitié de son côté", () => {
    expect(styleDAvatar({ couleurs: CLAIR, taille: 48 }).conteneur.borderRadius).toBe(24);
  });

  // L'initiale suit la taille de la pastille : une valeur fixe rendrait
  // minuscule à 64 et débordante à 28.
  it("met l'initiale à l'échelle de la pastille", () => {
    expect(styleDAvatar({ couleurs: CLAIR, taille: 48 }).initiale.fontSize).toBe(19);
    expect(styleDAvatar({ couleurs: CLAIR, taille: 28 }).initiale.fontSize).toBe(11);
  });

  it("écrit l'initiale dans le caractère de titre", () => {
    expect(styleDAvatar({ couleurs: CLAIR, taille: 48 }).initiale.fontFamily).toBe("Fraunces-Medium");
  });
});
