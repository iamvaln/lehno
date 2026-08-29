import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeBorder, nativeFont, nativeLeading, nativeLineHeight, nativeRadius, nativeSize, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Les décisions du bouton, séparées de son JSX.
 *
 * React Native est écrit en Flow : esbuild ne le parse pas, et le charger sous
 * Vitest échoue avant même le premier test. Introduire Jest pour ce seul paquet
 * fracturerait la chaîne du dépôt, qui tient sur Vitest partout.
 *
 * D'où la règle du port : ce qu'un composant DÉCIDE vit dans un fichier pur,
 * testé sans moteur de rendu ; le JSX se réduit à l'appliquer. Les types de RN
 * restent disponibles par `import type`, effacé à la compilation et donc jamais
 * chargé. Ce qui échappe aux tests est l'application elle-même — quelques
 * lignes évidentes par composant, que l'écran de contrôle donne à voir.
 */

export const RANGS_DE_BOUTON = [
  "primary", "outline", "text", "destructive", "destructiveOutline", "neutral",
] as const;
export type RangDeBouton = (typeof RANGS_DE_BOUTON)[number];

export interface Rang {
  fond: string;
  fondPresse: string;
  texte: string;
  bord: string;
}

/* Le survol n'existe pas sur un téléphone : l'état pressé est le seul retour
   que reçoit le doigt, donc chaque rang doit en avoir un qui se voit. Le web
   s'en sortait pour le rang destructeur avec filter: brightness(), absent de
   RN — d'où le jeton feedbackErrorPress, ajouté à la charte pour lui. */
export function rangsDuBouton(c: Couleurs): Record<RangDeBouton, Rang> {
  return {
    primary: {
      fond: c.action, fondPresse: c.actionPress,
      texte: c.textOnAccent, bord: "transparent",
    },
    outline: {
      fond: "transparent", fondPresse: c.actionQuietBg,
      texte: c.textAccent, bord: c.actionEdge,
    },
    // Ni fond ni contour au repos : sans quoi il ne se distinguerait plus du
    // rang outline.
    text: {
      fond: "transparent", fondPresse: c.actionQuietBg,
      texte: c.textAccent, bord: "transparent",
    },
    destructive: {
      fond: c.feedbackError, fondPresse: c.feedbackErrorPress,
      texte: c.surfacePage, bord: "transparent",
    },
    destructiveOutline: {
      fond: "transparent", fondPresse: c.feedbackErrorBg,
      texte: c.feedbackError, bord: c.feedbackError,
    },
    neutral: {
      fond: "transparent", fondPresse: c.actionQuietBg,
      texte: c.textSecondary, bord: c.borderObject,
    },
  };
}

export interface EtatDuBouton {
  couleurs: Couleurs;
  rang?: RangDeBouton;
  presse?: boolean;
  desactive?: boolean;
  pleineLargeur?: boolean;
}

export interface StyleDuBouton {
  conteneur: ViewStyle;
  libelle: TextStyle;
  couleurIcone: string;
  tailleIcone: number;
}

export function styleDuBouton({
  couleurs, rang = "primary", presse = false, desactive = false, pleineLargeur = false,
}: EtatDuBouton): StyleDuBouton {
  const r = rangsDuBouton(couleurs)[rang];
  // Un bouton désactivé ne réagit pas au doigt : lui laisser son état pressé
  // promettrait une action qui n'arrivera pas.
  const enfonce = presse && !desactive;

  return {
    conteneur: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: nativeSpace[8],
      // 44, comme le bouton mobile du web et comme la charte. Le hitSlop du
      // composant élargit la zone touchable sans grossir le dessin.
      minHeight: nativeTouchMin,
      paddingVertical: 13,
      paddingHorizontal: rang === "text" ? nativeSpace[14] : 18,
      borderRadius: nativeRadius.md,
      // 1 pt, pas hairlineWidth × 2 : celui-ci rend 0,67 sur un écran 3x et 1
      // sur un 2x, donc la bordure changerait d'épaisseur selon l'appareil.
      borderWidth: nativeBorder.width,
      borderColor: r.bord,
      backgroundColor: enfonce ? r.fondPresse : r.fond,
      opacity: desactive ? 0.45 : 1,
      // Sans alignSelf, un bouton dans une colonne s'étire toujours.
      alignSelf: pleineLargeur ? "stretch" : "flex-start",
    },
    libelle: {
      fontFamily: nativeFont.bodySemibold,
      fontSize: nativeSize.bodyM,
      lineHeight: nativeLineHeight(nativeSize.bodyM, nativeLeading.title),
      color: r.texte,
      textAlign: "center",
      // Le libellé s'étend sur deux lignes plutôt que de se tronquer : le
      // châssis iPhone SE existe pour révéler les libellés trop longs, pas pour
      // les cacher, et l'anglais les allonge d'un tiers.
      flexShrink: 1,
    },
    // Le web l'obtenait par currentColor, notion absente de RN. Sans injection,
    // une icône reste noire dans un bouton violet.
    couleurIcone: r.texte,
    tailleIcone: 18,
  };
}
