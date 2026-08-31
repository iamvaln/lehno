import { describe, expect, it } from "vitest";
import { nativeRadius, resolve } from "@lehno/tokens";
import { SURFACES_DE_CARTE, styleDeCarte } from "./Card.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");

describe("la carte", () => {
  /* Une carte Lehno se dessine par une bordure et un fond, jamais par une
     ombre. La règle est plus forte encore en natif : l'ombre diverge entre iOS
     (shadow*) et Android (elevation), donc une carte à l'ombre serait deux
     cartes. */
  it("ne porte aucune ombre, dans aucune surface ni aucun thème", () => {
    for (const couleurs of [CLAIR, SOMBRE]) {
      for (const surface of SURFACES_DE_CARTE) {
        const style = styleDeCarte({ couleurs, surface });
        expect(style, surface).not.toHaveProperty("shadowColor");
        expect(style, surface).not.toHaveProperty("elevation");
      }
    }
  });

  // Le panneau se distingue par son fond, pas par un trait : lui donner les
  // deux le ferait ressortir deux fois.
  it("le panneau se pose par son fond, sans trait visible", () => {
    const style = styleDeCarte({ couleurs: CLAIR, surface: "panel" });
    expect(style.backgroundColor).toBe(CLAIR.surfacePanel);
    expect(style.borderColor).toBe("transparent");
  });

  it("la surface simple se pose par son trait, sans fond", () => {
    const style = styleDeCarte({ couleurs: CLAIR, surface: "plain" });
    expect(style.backgroundColor).toBe("transparent");
    expect(style.borderColor).toBe(CLAIR.borderObject);
  });

  it("prend ses rayons dans la charte", () => {
    expect(styleDeCarte({ couleurs: CLAIR }).borderRadius).toBe(nativeRadius.xl);
    expect(styleDeCarte({ couleurs: CLAIR, rayon: "2xl" }).borderRadius).toBe(nativeRadius["2xl"]);
  });
});
