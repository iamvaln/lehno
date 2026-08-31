import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { ligneDeProvenance, styleDeProvenance } from "./Provenance.styles.js";

describe("la provenance", () => {
  it("joint ce qu'elle a, par un point médian", () => {
    expect(ligneDeProvenance(["noté", "en mars"])).toBe("noté · en mars");
  });

  // Une provenance à moitié connue reste utile : « en mars » seul situe déjà.
  it("se contente d'un seul élément", () => {
    expect(ligneDeProvenance([null, "en mars"])).toBe("en mars");
    expect(ligneDeProvenance(["noté", undefined])).toBe("noté");
  });

  // Rien à dire, rien à afficher : un filet seul sous une note serait un trait
  // sans raison.
  it("ne rend rien quand elle ne sait rien", () => {
    expect(ligneDeProvenance([null, undefined])).toBeNull();
    expect(ligneDeProvenance([])).toBeNull();
  });

  // Elle se sépare de ce qu'elle accompagne par un filet, jamais par une marge
  // seule : c'est ce qui la rattache visuellement à la note du dessus.
  it("se pose sous un filet", () => {
    const c = resolve("light");
    expect(styleDeProvenance(c).conteneur.borderTopColor).toBe(c.borderHairline);
    expect(styleDeProvenance(c).conteneur.borderTopWidth).toBe(1);
  });
});
