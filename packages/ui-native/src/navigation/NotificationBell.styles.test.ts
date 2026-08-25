import { describe, expect, it } from "vitest";
import { nativeTouchMin, resolve } from "@lehno/tokens";
import { pastilleDeCloche, styleDeCloche } from "./NotificationBell.styles.js";

const CLAIR = resolve("light");

describe("la pastille de la cloche", () => {
  it("ne paraît que s'il y a quelque chose à lire", () => {
    expect(pastilleDeCloche(0)).toBeNull();
    expect(pastilleDeCloche(3)).toBe("3");
  });

  /* Au-delà de neuf, le nombre exact ne change plus rien à la décision : on
     ouvre. Et un compteur à trois chiffres déborderait de la pastille. */
  it("plafonne à neuf et plus", () => {
    expect(pastilleDeCloche(9)).toBe("9");
    expect(pastilleDeCloche(10)).toBe("9+");
    expect(pastilleDeCloche(147)).toBe("9+");
  });
});

describe("le style de la cloche", () => {
  // La cloche vit dans un en-tête serré : elle porte ses 44 points par une
  // marge négative, sans pousser les éléments voisins.
  it("porte la cible tactile sans écarter ses voisins", () => {
    const s = styleDeCloche(CLAIR);
    expect(s.bouton.minWidth).toBe(nativeTouchMin);
    expect(s.bouton.minHeight).toBe(nativeTouchMin);
    expect(s.bouton.margin).toBeLessThan(0);
  });

  // La pastille porte l'encre que la charte pose sur l'action — du blanc n'y
  // tiendrait pas le contraste en thème sombre.
  it("écrit la pastille dans l'encre de l'action", () => {
    const s = styleDeCloche(CLAIR);
    expect(s.pastille.backgroundColor).toBe(CLAIR.action);
    expect(s.nombre.color).toBe(CLAIR.textOnAccent);
  });
});
