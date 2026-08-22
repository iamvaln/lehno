import { describe, expect, it } from "vitest";
import { themes, contrastRatio, cssVariables, type ColorRole } from "./index.js";

const ROLES: ColorRole[] = [
  "bg", "surface", "panel", "text", "muted", "faint", "line", "line2",
  "edge", "violet", "violetDeep", "onViolet", "apricot", "onApricot",
  "band", "onBand", "card",
];

describe("thèmes", () => {
  it("les deux thèmes portent exactement les mêmes rôles", () => {
    expect(Object.keys(themes.light).sort()).toEqual([...ROLES].sort());
    expect(Object.keys(themes.dark).sort()).toEqual([...ROLES].sort());
  });

  it("toutes les couleurs sont des hexadécimaux à six chiffres", () => {
    for (const theme of [themes.light, themes.dark])
      for (const value of Object.values(theme))
        expect(value).toMatch(/^#[0-9A-F]{6}$/);
  });

  // Le contraste est une propriété du produit, pas une intention : on le mesure.
  it.each([
    ["text", "bg"], ["muted", "bg"], ["faint", "bg"], ["faint", "panel"],
    ["onViolet", "violet"], ["violetDeep", "bg"], ["onApricot", "apricot"], ["onBand", "band"],
  ] as const)("%s sur %s atteint 4,5:1 dans les deux thèmes", (fg, bg) => {
    expect(contrastRatio(themes.light[fg], themes.light[bg])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(themes.dark[fg], themes.dark[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("cssVariables rend une déclaration par rôle", () => {
    const css = cssVariables(themes.light);
    expect(css).toContain("--bg: #FFFFFF;");
    expect(css).toContain("--violet-deep: #5A4B93;");
    expect(css.split(";").filter(Boolean)).toHaveLength(ROLES.length);
  });
});
