import { describe, expect, it } from "vitest";
import { primitives, semantic, resolve, contrastRatio, SEMANTIC_ROLES } from "./index.js";

describe("couleurs", () => {
  it("les deux thèmes portent exactement les mêmes rôles", () => {
    expect(Object.keys(semantic.light).sort()).toEqual([...SEMANTIC_ROLES].sort());
    expect(Object.keys(semantic.dark).sort()).toEqual([...SEMANTIC_ROLES].sort());
  });

  // Un alias qui désignerait une primitive absente ne se verrait qu'à l'exécution,
  // et seulement dans le thème concerné.
  it("chaque alias pointe sur une primitive qui existe, dans les deux thèmes", () => {
    for (const theme of ["light", "dark"] as const)
      for (const [role, primitive] of Object.entries(semantic[theme]))
        expect(primitives[theme], `${theme}.${role} → ${primitive}`).toHaveProperty(primitive);
  });

  it("resolve rend des couleurs, pas des noms", () => {
    expect(resolve("light").action).toBe("#7B6BB7");
    expect(resolve("dark").action).toBe("#9C8BD8");
    expect(resolve("light").textBody).toBe("#221F2B");
  });

  // Le contraste est une propriété du produit : on le mesure, on ne l'espère pas.
  it.each([
    ["textBody", "surfacePage"], ["textSecondary", "surfacePage"], ["textMention", "surfacePage"],
    ["textMention", "surfacePanel"], ["textBody", "surfaceCard"], ["textAccent", "surfacePage"],
    ["textOnAccent", "action"], ["onBand", "surfaceBand"], ["onCelebrate", "celebrate"],
    ["feedbackInfo", "feedbackInfoBg"], ["feedbackSuccess", "feedbackSuccessBg"],
    ["feedbackWarning", "feedbackWarningBg"], ["feedbackError", "feedbackErrorBg"],
  ] as const)("%s sur %s atteint 4,5:1 dans les deux thèmes", (fg, bg) => {
    for (const theme of ["light", "dark"] as const) {
      const c = resolve(theme);
      expect(contrastRatio(c[fg], c[bg]), `${theme} : ${fg} sur ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Règle du système : du blanc sur violet clair ne mesure que 2,96:1.
  it("en thème sombre, le texte d'un bouton plein est de l'encre, pas du blanc", () => {
    expect(resolve("dark").textOnAccent).toBe("#15131D");
    expect(contrastRatio("#FFFFFF", resolve("dark").action)).toBeLessThan(4.5);
  });

  it("l'anneau de focus se distingue du fond qu'il entoure", () => {
    for (const theme of ["light", "dark"] as const) {
      const c = resolve(theme);
      expect(contrastRatio(c.focusRing, c.surfacePage)).toBeGreaterThanOrEqual(3);
    }
  });
});
