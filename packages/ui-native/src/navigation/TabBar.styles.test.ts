import { describe, expect, it } from "vitest";
import { nativeTouchMin, resolve } from "@lehno/tokens";
import { styleDOnglets } from "./TabBar.styles.js";

const CLAIR = resolve("light");

describe("la barre d'onglets", () => {
  // L'onglet courant se distingue par la couleur ET par la graisse : la
  // couleur seule ne suffit pas à qui la distingue mal.
  it("marque l'onglet courant par la couleur et par la graisse", () => {
    const actif = styleDOnglets({ couleurs: CLAIR, actif: true });
    const dormant = styleDOnglets({ couleurs: CLAIR });
    expect(actif.libelle.color).toBe(CLAIR.textAccent);
    expect(dormant.libelle.color).toBe(CLAIR.textMention);
    expect(actif.libelle.fontFamily).not.toBe(dormant.libelle.fontFamily);
  });

  it("garde chaque onglet au-dessus de la cible tactile", () => {
    expect(styleDOnglets({ couleurs: CLAIR }).onglet.minHeight).toBe(nativeTouchMin);
  });

  // La barre se sépare du contenu par un filet, jamais par une ombre : la même
  // règle que les cartes, et pour la même raison.
  it("se sépare du contenu par un filet", () => {
    const s = styleDOnglets({ couleurs: CLAIR });
    expect(s.barre.borderTopColor).toBe(CLAIR.borderHairline);
    expect(s.barre).not.toHaveProperty("shadowColor");
  });
});
