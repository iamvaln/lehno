import { nativeColors, type Theme } from "@lehno/tokens";
import { LETTRES } from "./Wordmark.data.js";
import type { Couleurs } from "../theme.js";

/* La pastille — le h seul, la même lettre partout.
 *
 * Elle ne recopie pas son tracé : elle prend celui du logotype. C'est la même
 * lettre, et deux copies auraient divergé au premier ajustement du dessin. La
 * lettre accentuée est le h, et le test du logotype garantit qu'il n'y en a
 * qu'une.
 *
 * Le web posait six fichiers SVG et une balise <img>. En natif, embarquer des
 * fichiers demanderait un transformateur à l'empaqueteur, pour six dessins qui
 * ne diffèrent que par deux couleurs et une forme de plaque : la pastille se
 * dessine donc, comme le logotype.
 */

const H = LETTRES.find((lettre) => lettre.accent)!;

export const TRACE_DE_LA_PASTILLE = H.d;

// La boîte du dessin d'origine, et le repère hérité de lui : l'axe des
// ordonnées est inversé, d'où l'échelle négative appliquée au groupe.
export const BOITE_PASTILLE = 512;
export const RAYON_PASTILLE = 113;
export const REPERES_DE_PASTILLE = {
  carre: { x: 146.428, y: 407.495, echelle: 0.205 },
  ronde: { x: 149.1, y: 403.8, echelle: 0.2 },
} as const;

// Sous 28 points, la contre-forme du h se referme et la pastille devient une
// tache violette. La charte pose le plancher ; la primitive le tient elle-même,
// parce qu'un appel qui demande 20 ne se relit jamais.
export const TAILLE_MIN_DE_PASTILLE = 28;

// Le favicon épaissit son tracé pour survivre aux petites tailles — le seul
// dessin du système qui porte un contour.
export const EPAISSEUR_DU_FAVICON = 63;

export const VARIANTES_DE_PASTILLE = [
  "violet", "ronde", "claire", "encre", "uneEncre", "favicon",
] as const;
export type VarianteDePastille = (typeof VARIANTES_DE_PASTILLE)[number];

export type FormeDePastille = "carre" | "ronde" | "aucune";

/* LES FONDS QUE CHAQUE VARIANTE TIENT.
 *
 * Le piège est dans les noms. La variante « encre » — dite « sombre » dans la
 * charte — est faite pour un fond CLAIR : c'est sa plaque qui est sombre, pas
 * le fond qu'elle vise. Posée sur une page sombre, elle mesure 1,11:1, soit
 * rien. « claire » tombe dans le même piège en sens inverse : plaque lilas,
 * donc page sombre.
 *
 * Ce tableau n'est pas un commentaire : le test mesure chaque variante contre
 * chacun des fonds qu'elle déclare. */
export const FONDS_DE_PASTILLE: Record<VarianteDePastille, readonly Theme[]> = {
  violet: ["light", "dark"],
  ronde: ["light", "dark"],
  favicon: ["light", "dark"],
  encre: ["light"],
  claire: ["dark"],
  // Monochrome : elle prend l'encre du texte courant, donc elle suit le thème.
  uneEncre: ["light", "dark"],
};

const FORMES: Record<VarianteDePastille, FormeDePastille> = {
  violet: "carre",
  ronde: "ronde",
  claire: "carre",
  encre: "carre",
  favicon: "carre",
  // Pas de plaque : la lettre seule, pour une impression à une encre.
  uneEncre: "aucune",
};

/* Les couleurs de la pastille ne suivent PAS le thème — sauf « uneEncre ».
 *
 * C'est un actif de marque : il paraît sur un écran d'ouverture, dans un
 * partage, sur une boutique. Comme la variante inverse du logotype, il ne
 * change pas de couleur parce que le téléphone est en sombre. Les valeurs
 * viennent des rôles du thème clair, jamais d'hexadécimaux écrits ici.
 *
 * « uneEncre » fait exception, et c'est la même exception que le logotype :
 * monochrome veut dire UNE encre, pas CETTE encre. Fixée à l'encre du thème
 * clair, elle disparaîtrait sur une page sombre — 1,11:1. */
export function couleursDePastille(
  variante: VarianteDePastille, couleurs: Couleurs,
): { plaque: string | null; lettre: string } {
  const marque = nativeColors("light");
  switch (variante) {
    case "claire":
      return { plaque: marque.actionQuietBg, lettre: marque.textAccent };
    case "encre":
      return { plaque: marque.surfaceBand, lettre: marque.celebrate };
    case "uneEncre":
      return { plaque: null, lettre: couleurs.textBody };
    default:
      return { plaque: marque.action, lettre: marque.textOnAccent };
  }
}

export interface StyleDePastille {
  taille: number;
  forme: FormeDePastille;
  plaque: string | null;
  lettre: string;
  trait: number;
  repere: { x: number; y: number; echelle: number };
}

export function styleDePastille({
  couleurs, variante = "violet", taille = 32,
}: {
  couleurs: Couleurs;
  variante?: VarianteDePastille;
  taille?: number;
}): StyleDePastille {
  const forme = FORMES[variante];
  return {
    taille: Math.max(taille, TAILLE_MIN_DE_PASTILLE),
    forme,
    ...couleursDePastille(variante, couleurs),
    trait: variante === "favicon" ? EPAISSEUR_DU_FAVICON : 0,
    repere: forme === "ronde" ? REPERES_DE_PASTILLE.ronde : REPERES_DE_PASTILLE.carre,
  };
}
