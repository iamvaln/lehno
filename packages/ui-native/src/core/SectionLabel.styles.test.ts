import { describe, expect, it } from "vitest";
import { nativeSize, resolve } from "@lehno/tokens";
import { styleDeSurTitre } from "./SectionLabel.styles.js";

const CLAIR = resolve("light");

describe("le sur-titre", () => {
  // Il tient par ses capitales et son interlettrage : c'est ce qui le distingue
  // d'un simple texte gris, à une taille où le gras ne suffirait pas.
  it("écrit en capitales, espacé", () => {
    const style = styleDeSurTitre(CLAIR);
    expect(style.textTransform).toBe("uppercase");
    expect(style.letterSpacing).toBeCloseTo(1.54, 2);
    expect(style.fontSize).toBe(nativeSize.kicker);
  });

  // Le gris de mention, pas celui du texte : il annonce une section, il ne se
  // lit pas.
  it("prend le gris de mention", () => {
    expect(styleDeSurTitre(CLAIR).color).toBe(CLAIR.textMention);
  });
});
