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
    // Le bouton destructeur pressé : son libellé reste lisible pendant l'appui.
    // En sombre il ne mesure que 4,63 — trop juste pour rester hors des tests.
    ["surfacePage", "feedbackErrorPress"],
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

  // Sur un téléphone il n'y a pas de survol : la pression est le seul retour que
  // reçoit le doigt. Le web s'en sortait pour le rang destructeur avec
  // filter: brightness(), qui n'existe pas en natif — d'où un fond pressé propre.
  // Ce test tient parce que le premier port avait donné au rang destructeur un
  // fond pressé identique à son fond au repos : le bouton le plus grave du
  // système ne répondait pas au toucher, et rien ne le signalait.
  it("le fond pressé du rang destructeur se distingue de son fond au repos", () => {
    for (const theme of ["light", "dark"] as const) {
      const c = resolve(theme);
      expect(c.feedbackErrorPress, theme).not.toBe(c.feedbackError);
      expect(contrastRatio(c.feedbackError, c.feedbackErrorPress), theme).toBeGreaterThan(1.3);
    }
  });

  /* Les illustrations ont leurs propres rôles, et ce n'est pas de la
     redondance. En thème clair, la masse tombe sur le même violet que l'action ;
     les confondre ferait repeindre vingt-six illustrations le jour où la couleur
     d'action bouge. Une masse d'illustration n'est pas une action. */
  it("les illustrations nomment leurs trois rôles, dans les deux thèmes", () => {
    for (const theme of ["light", "dark"] as const) {
      const c = resolve(theme);
      for (const role of ["illusMass", "illusForm", "illusWarm"] as const) {
        expect(c[role], `${theme}.${role}`).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  // L'accent chaud de l'illustration est l'abricot, la seule couleur chaude du
  // système — la même dans les deux thèmes, comme partout où elle paraît.
  it("l'accent chaud des illustrations est l'abricot des deux thèmes", () => {
    expect(resolve("light").illusWarm).toBe(resolve("light").celebrate);
    expect(resolve("dark").illusWarm).toBe(resolve("dark").celebrate);
  });

  it("l'anneau de focus se distingue du fond qu'il entoure", () => {
    for (const theme of ["light", "dark"] as const) {
      const c = resolve(theme);
      expect(contrastRatio(c.focusRing, c.surfacePage)).toBeGreaterThanOrEqual(3);
    }
  });
});
