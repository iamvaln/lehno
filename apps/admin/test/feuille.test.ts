import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { feuilleDesJetons } from "../src/styles/variables.js";

const css = feuilleDesJetons();

describe("la feuille des jetons", () => {
  it("pose les quatre blocs, dans l'ordre", () => {
    const racine = css.indexOf(":root {");
    const nuit = css.indexOf(".lehno-nuit");
    const admin = css.indexOf(".lehno-admin {");
    const adminNuit = css.indexOf(".lehno-admin.lehno-nuit");
    expect(racine).toBeGreaterThanOrEqual(0);
    expect(nuit).toBeGreaterThan(racine);
    expect(admin).toBeGreaterThan(nuit);
    expect(adminNuit).toBeGreaterThan(admin);
  });

  it("porte la densité de l'outil, pas celle du produit", () => {
    const bloc = css.slice(css.indexOf(".lehno-admin {"), css.indexOf(".lehno-admin.lehno-nuit"));
    expect(bloc).toContain("--control-height: 32px");
    expect(bloc).toContain("--row-height: 44px");
    expect(bloc).toContain("--sidebar-width: 232px");
  });

  it("porte les couleurs de barre dans les deux thèmes", () => {
    expect(css).toContain("--surface-chrome: #F7F6FA");
    expect(css).toContain("--surface-chrome: #131219");
  });

  // Le bloc sombre du back-office ne porte que des couleurs : la densité est
  // posée une fois, en clair. L'oublier donnerait un outil à la densité du
  // produit dès qu'on bascule le thème.
  it("ne repose pas la densité dans le bloc sombre", () => {
    const bloc = css.slice(css.indexOf(".lehno-admin.lehno-nuit"));
    expect(bloc).not.toContain("--control-height");
  });
});

describe("la feuille de structure", () => {
  it("n'écrit aucune couleur en dur", () => {
    const global = readFileSync("src/styles/global.css", "utf-8");
    expect(global).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(global).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
  });
});
