import { describe, expect, it } from "vitest";
import { contrastRatio, nativeColors, resolve } from "@lehno/tokens";
import { LETTRES } from "./Wordmark.data.js";
import {
  FONDS_DE_PASTILLE, TAILLE_MIN_DE_PASTILLE, TRACE_DE_LA_PASTILLE,
  VARIANTES_DE_PASTILLE, styleDePastille,
} from "./BrandMark.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");
const COULEURS = { light: CLAIR, dark: SOMBRE } as const;

describe("la pastille", () => {
  /* Une seule lettre pour deux composants. Le pilote avait recopié le tracé du
     h dans la pastille : deux copies du même dessin, dont l'une serait restée
     en arrière au premier ajustement. Elle prend celui du logotype. */
  it("dessine exactement le h du logotype", () => {
    expect(TRACE_DE_LA_PASTILLE).toBe(LETTRES[2]!.d);
    expect(LETTRES.filter((l) => l.accent).map((l) => l.d)).toEqual([TRACE_DE_LA_PASTILLE]);
  });

  /* LE PIÈGE DE NOMMAGE. « encre » — dite « sombre » dans la charte — désigne
     la couleur de sa PLAQUE, pas celle du fond qu'elle vise : posée sur une
     page sombre, elle mesure 1,11:1. « claire » tombe dans le même piège en
     sens inverse.

     Le test ne nomme aucune variante : il mesure chacune contre chacun des
     fonds qu'elle déclare. Une septième variante ajoutée demain devra passer
     par la même mesure, et la déclaration cessera d'être une phrase. */
  it("tient sur chacun des fonds qu'elle déclare, et sa lettre sur sa plaque", () => {
    for (const variante of VARIANTES_DE_PASTILLE) {
      const fonds = FONDS_DE_PASTILLE[variante];
      expect(fonds.length, variante).toBeGreaterThan(0);
      for (const theme of fonds) {
        const couleurs = COULEURS[theme];
        const s = styleDePastille({ couleurs, variante });
        const page = couleurs.surfacePage;
        if (s.plaque !== null) {
          expect(contrastRatio(s.plaque, page), `${variante}/${theme} plaque`).toBeGreaterThanOrEqual(3);
        }
        expect(contrastRatio(s.lettre, s.plaque ?? page), `${variante}/${theme} lettre`)
          .toBeGreaterThanOrEqual(3);
      }
    }
  });

  /* Et la mesure dit pourquoi la déclaration est ce qu'elle est : sur la page
     qu'elle ne déclare pas, la pastille d'encre s'efface. Sans ce test, la
     déclaration ci-dessus pourrait s'ouvrir à « dark » sans que rien proteste. */
  it("s'efface bel et bien sur le fond qu'elle ne déclare pas", () => {
    const encre = styleDePastille({ couleurs: SOMBRE, variante: "encre" });
    expect(FONDS_DE_PASTILLE.encre).not.toContain("dark");
    expect(contrastRatio(encre.plaque!, SOMBRE.surfacePage)).toBeLessThan(1.5);

    const claire = styleDePastille({ couleurs: CLAIR, variante: "claire" });
    expect(FONDS_DE_PASTILLE.claire).not.toContain("light");
    expect(contrastRatio(claire.plaque!, CLAIR.surfacePage)).toBeLessThan(1.5);
  });

  /* Monochrome veut dire UNE encre, pas CETTE encre. Le fichier du web était
     fixé à l'encre du thème clair : porté tel quel, il aurait donné une lettre
     noire sur une page noire. */
  it("laisse la variante à une encre suivre le thème", () => {
    const clair = styleDePastille({ couleurs: CLAIR, variante: "uneEncre" });
    const sombre = styleDePastille({ couleurs: SOMBRE, variante: "uneEncre" });
    expect(clair.plaque).toBeNull();
    expect(clair.lettre).not.toBe(sombre.lettre);
  });

  // Les autres variantes, elles, ne bougent pas d'un thème à l'autre : un
  // actif de marque ne change pas de couleur parce que le téléphone est sombre.
  it("garde les couleurs de marque quel que soit le thème", () => {
    for (const variante of ["violet", "ronde", "claire", "encre", "favicon"] as const) {
      const clair = styleDePastille({ couleurs: CLAIR, variante });
      const sombre = styleDePastille({ couleurs: SOMBRE, variante });
      expect(sombre.plaque, variante).toBe(clair.plaque);
      expect(sombre.lettre, variante).toBe(clair.lettre);
    }
    expect(styleDePastille({ couleurs: SOMBRE, variante: "violet" }).plaque)
      .toBe(nativeColors("light").action);
  });

  /* Sous 28 points la contre-forme du h se referme et la pastille devient une
     tache. La primitive tient le plancher elle-même : un appel qui demande 20
     ne se relit jamais, et rien à l'écran ne dirait que c'est trop petit. */
  it("ne descend jamais sous son plancher, quoi qu'on lui demande", () => {
    for (const demande of [0, 8, 20, 27]) {
      expect(styleDePastille({ couleurs: CLAIR, taille: demande }).taille, String(demande))
        .toBe(TAILLE_MIN_DE_PASTILLE);
    }
    expect(styleDePastille({ couleurs: CLAIR, taille: 64 }).taille).toBe(64);
  });

  // Le favicon est le seul dessin du système qui porte un contour : il épaissit
  // son tracé pour survivre à 28 points dans un onglet.
  it("n'épaissit le tracé que pour le favicon", () => {
    expect(styleDePastille({ couleurs: CLAIR, variante: "favicon" }).trait).toBeGreaterThan(0);
    for (const variante of ["violet", "ronde", "claire", "encre", "uneEncre"] as const) {
      expect(styleDePastille({ couleurs: CLAIR, variante }).trait, variante).toBe(0);
    }
  });

  // La ronde a son propre repère : le cercle n'a pas les mêmes marges que le
  // carré arrondi, et réutiliser celui du carré décentrerait la lettre.
  it("donne à la pastille ronde son propre repère", () => {
    const ronde = styleDePastille({ couleurs: CLAIR, variante: "ronde" });
    const carre = styleDePastille({ couleurs: CLAIR, variante: "violet" });
    expect(ronde.forme).toBe("ronde");
    expect(ronde.repere).not.toEqual(carre.repere);
  });
});
