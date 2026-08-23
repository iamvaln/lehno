import { describe, expect, it } from "vitest";
import { cssVariables, cssTokens, typography, spacing, shape, motion, density } from "./index.js";

describe("émission CSS", () => {
  it("nomme les rôles en tirets, pas en casse chameau", () => {
    const css = cssVariables("light");
    expect(css).toContain("--surface-page: #FFFFFF;");
    expect(css).toContain("--text-on-accent: #FFFFFF;");
    expect(css).not.toMatch(/--[a-z]+[A-Z]/);
  });

  it("le thème sombre rend d'autres valeurs pour les mêmes rôles", () => {
    expect(cssVariables("dark")).toContain("--surface-page: #17161F;");
    expect(cssVariables("dark")).toContain("--text-on-accent: #15131D;");
  });

  it("les jetons hors thème sortent une seule fois", () => {
    const css = cssTokens();
    expect(css).toContain("--radius-sm: 10px;");
    expect(css).toContain("--space-16: 16px;");
    expect(css).toContain("--duration-state: 120ms;");
    expect(css).toContain('--font-display-settings: "SOFT" 40, "WONK" 1;');
  });

  // La seule ombre admise par le système, pour le cadre de téléphone des aperçus.
  it("une seule ombre existe, et elle est nommée", () => {
    expect(Object.keys(shape).filter((k) => k.startsWith("shadow"))).toEqual(["shadowDevice"]);
  });

  it("les échelles ont les valeurs du système", () => {
    expect(typography.textDisplayXl).toBe("76px");
    expect(typography.textMentionS).toBe("11.5px");
    expect(spacing.pageMax).toBe("1160px");
    expect(spacing.touchMin).toBe("44px");
    expect(shape.radiusPill).toBe("999px");
    expect(motion.durationScreen).toBe("340ms");
    expect(density.controlHeight).toBe("40px");
  });
});
