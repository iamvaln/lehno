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

describe("le retrait du bas appartient à la barre", () => {
  /* Deux insets additionnés — celui de l'écran et celui de la barre — donnent
     le trou blanc au-dessus du menu système. La barre le porte, seule. */
  it("descend son fond jusqu'au bord", () => {
    const barre = styleDOnglets({ couleurs: CLAIR, insetBas: 34 }).barre;
    expect(barre.paddingBottom).toBe(34);
    expect(barre.backgroundColor).toBe(CLAIR.surfacePage);
  });

  /* Sans encoche ni poignée, l'inset vaut zéro : c'est le cas ORDINAIRE, et le
     rembourrage de l'onglet suffit alors. La barre ne doit pas s'épaissir
     d'elle-même pour un retrait qui n'existe pas. */
  it("ne s'épaissit pas quand il n'y a rien à contourner", () => {
    expect(styleDOnglets({ couleurs: CLAIR }).barre.paddingBottom).toBe(0);
  });

  // La cible tactile ne dépend pas du retrait : elle vaut 44 avec ou sans.
  it("garde sa cible tactile quel que soit le retrait", () => {
    for (const inset of [0, 34]) {
      const s = styleDOnglets({ couleurs: CLAIR, insetBas: inset });
      expect(s.onglet.minHeight, `inset ${inset}`).toBe(nativeTouchMin);
    }
  });
});
