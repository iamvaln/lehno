import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { styleDeBandeauSensible } from "./SensitiveBanner.styles.js";

const CLAIR = resolve("light");

describe("le bandeau d'un moment grave", () => {
  /* Le doc de ton est net : « sobre, court, sans compassion affichée. On
     accompagne en se taisant. » D'où l'absence d'icône — un cœur ou des mains
     jointes seraient précisément la compassion affichée — et l'absence de
     couleur d'intention : la gravité n'est pas un avertissement. */
  it("ne porte aucun signe et aucune couleur d'intention", () => {
    const s = styleDeBandeauSensible(CLAIR);
    expect(s).not.toHaveProperty("icone");
    expect(s.texte.color).toBe(CLAIR.textBody);
    expect(s.conteneur.backgroundColor).toBe(CLAIR.surfacePanel);
  });

  it("traverse la page comme les autres bandeaux", () => {
    expect(styleDeBandeauSensible(CLAIR).conteneur.borderRadius).toBe(0);
  });
});
