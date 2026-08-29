import { describe, expect, it } from "vitest";
import { contrastRatio, resolve } from "@lehno/tokens";
import { BOITE_DE_GLYPHE, RESEAUX, TRACES_DE_RESEAU } from "./SocialGlyph.data.js";
import { TAILLE_MIN_DE_GLYPHE, styleDeGlyphe } from "./SocialGlyph.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");

describe("les glyphes de réseau", () => {
  it("porte les six réseaux, chacun d'un seul tracé", () => {
    expect(RESEAUX).toHaveLength(6);
    for (const reseau of RESEAUX) {
      const d = TRACES_DE_RESEAU[reseau];
      expect(d.startsWith("M"), reseau).toBe(true);
      expect(d.length, reseau).toBeGreaterThan(80);
    }
  });

  /* AUCUN TRACÉ NE PORTE SA COULEUR. C'est la raison même du masque CSS du
     web : une icône prend la couleur du texte qu'elle accompagne, et un noir
     écrit en dur disparaîtrait sur le thème sombre. C'est aussi la règle des
     marques — on ne les repeint pas dans leur teinte propre.

     Un tracé recopié depuis un fichier de marque arrive presque toujours avec
     son `fill` : le test le refuse à la source, pour les six et pour ceux
     qu'on ajoutera. */
  it("ne laisse aucun tracé emporter sa propre teinte", () => {
    for (const reseau of RESEAUX) {
      const d = TRACES_DE_RESEAU[reseau];
      expect(d, reseau).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(d, reseau).not.toMatch(/fill|rgb|url\(/i);
    }
  });

  // Le glyphe prend l'encre du texte qu'il accompagne, dans les deux thèmes :
  // c'est ce qui le rend lisible sans qu'aucun appel s'en occupe.
  it("prend l'encre du texte courant, et la garde lisible dans les deux thèmes", () => {
    for (const couleurs of [CLAIR, SOMBRE]) {
      const s = styleDeGlyphe({ couleurs, reseau: "instagram" })!;
      expect(s.encre).toBe(couleurs.textBody);
      expect(contrastRatio(s.encre, couleurs.surfacePage)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("laisse l'appel imposer une encre quand la ligne en demande une autre", () => {
    const s = styleDeGlyphe({ couleurs: CLAIR, reseau: "x", encre: CLAIR.textSecondary })!;
    expect(s.encre).toBe(CLAIR.textSecondary);
  });

  /* Sous 16 points, le X et le TikTok se referment sur eux-mêmes. Le plancher
     tient dans la primitive : un `size={12}` écrit dans un écran ne se relit
     jamais, et rien à l'affichage ne dirait que c'est trop petit. */
  it("ne descend jamais sous le palier du système", () => {
    for (const demande of [0, 10, 12, 16]) {
      expect(styleDeGlyphe({ couleurs: CLAIR, reseau: "tiktok", taille: demande })!.taille, String(demande))
        .toBe(TAILLE_MIN_DE_GLYPHE);
    }
    expect(styleDeGlyphe({ couleurs: CLAIR, reseau: "tiktok", taille: 24 })!.taille).toBe(24);
  });

  // Un réseau inconnu ne rend rien plutôt que de faire tomber l'écran — la
  // même règle que l'icône et l'illustration.
  it("ne rend rien pour un réseau qu'il ne connaît pas", () => {
    expect(styleDeGlyphe({ couleurs: CLAIR, reseau: "mastodon" })).toBeNull();
    expect(styleDeGlyphe({ couleurs: CLAIR, reseau: "" })).toBeNull();
  });

  // Les six tracés viennent d'une grille 24 × 24 : les mêler à une autre boîte
  // les déformerait, ce que la licence des marques interdit.
  it("garde la grille de 24 des fichiers de marque", () => {
    expect(BOITE_DE_GLYPHE).toBe(24);
  });
});
