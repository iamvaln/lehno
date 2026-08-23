import { describe, expect, it } from "vitest";
import {
  adminOverride, resolveAdmin, cssAdmin, contrastRatio,
  typography, shape, density,
} from "./index.js";

describe("surcharge du back-office", () => {
  // Une valeur identique des deux côtés finira par être modifiée d'un seul,
  // et les deux divergeront sans que personne ne l'ait voulu.
  it("ne contient que des écarts, jamais une valeur déjà identique au produit", () => {
    const produit: Record<string, string> = { ...typography, ...shape, ...density };
    for (const [clef, valeur] of Object.entries(adminOverride.tokens))
      expect(produit[clef], `${clef} est identique au produit : à retirer`).not.toBe(valeur);
  });

  it("efface Fraunces : un outil n'a pas à être intime", () => {
    expect(adminOverride.tokens.fontDisplay).toBe(typography.fontBody);
    expect(adminOverride.tokens.fontDisplaySettings).toBe("normal");
  });

  it("descend l'échelle : un tableau de quarante lignes ne se lit pas en 16 px", () => {
    expect(adminOverride.tokens.textBodyM).toBe("14px");
    expect(adminOverride.tokens.textDisplayXl).toBe("30px");
  });

  it("raccourcit les cibles, la souris n'ayant pas besoin du pouce", () => {
    expect(adminOverride.tokens.controlHeight).toBe("32px");
    expect(adminOverride.tokens.rowHeight).toBe("44px");
    expect(density.controlHeight).toBe("40px");
  });

  it("ouvre une surface que le produit n'a pas", () => {
    expect(resolveAdmin("light").surfaceChrome).toBe("#F7F6FA");
    expect(resolveAdmin("dark").surfaceChrome).toBe("#131219");
  });

  // Le back-office hérite des couleurs de texte du produit : ses surfaces
  // propres doivent donc les porter aussi.
  it.each([
    ["textBody", "surfaceChrome"], ["textSecondary", "surfaceChrome"],
    ["textBody", "surfacePanel"], ["textSecondary", "surfacePanel"],
    ["textAccent", "surfaceChrome"], ["textBody", "surfaceCard"],
  ] as const)("%s sur %s atteint 4,5:1 dans les deux thèmes", (fg, bg) => {
    for (const theme of ["light", "dark"] as const) {
      const c = resolveAdmin(theme);
      expect(contrastRatio(c[fg], c[bg]), `${theme} : ${fg} sur ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("le bloc CSS se pose sur la classe de l'outil, et se combine au thème", () => {
    expect(cssAdmin("light")).toContain(".lehno-admin {");
    expect(cssAdmin("dark")).toContain(".lehno-admin.lehno-nuit {");
    expect(cssAdmin("light")).toContain("--surface-chrome: #F7F6FA;");
    expect(cssAdmin("light")).toContain("--control-height: 32px;");
  });

  it("le bloc sombre ne réémet pas ce qui ne dépend pas du thème", () => {
    expect(cssAdmin("dark")).not.toContain("--control-height:");
  });
});
