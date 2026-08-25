import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeFont, nativeRadius, nativeSize, nativeSpace,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* L'attente. Trois familles, et une seule règle commune : on ne fait jamais
   patienter sans dire sur quoi. */
export const VARIANTES_D_ATTENTE = ["liste", "envoi", "generation"] as const;
export type VarianteDAttente = (typeof VARIANTES_D_ATTENTE)[number];

/* « Quitter sans perdre » n'est une promesse que pour l'attente longue. La
   tenir sur un envoi de trois secondes n'aurait pas de sens, et l'offrir sur un
   squelette de liste apprendrait que le bouton ne veut rien dire. */
export function estQuittable(variante: VarianteDAttente): boolean {
  return variante === "generation";
}

export function styleDAttente({
  couleurs, variante,
}: { couleurs: Couleurs; variante: VarianteDAttente }): {
  conteneur: ViewStyle;
  carte: ViewStyle | null;
  ligne: ViewStyle | null;
  titre: TextStyle;
  texte: TextStyle | null;
  couleurRoue: string;
} {
  if (variante === "liste") {
    return {
      conteneur: { gap: nativeSpace[10] },
      /* Les lignes du squelette se posent sur un filet, pas sur un fond : un
         bloc gris plein annoncerait du contenu là où il n'y en a pas encore. */
      carte: {
        borderWidth: 1,
        borderColor: couleurs.borderHairline,
        borderRadius: nativeRadius.lg,
        padding: 15,
        gap: nativeSpace[8],
      },
      /* Le rayon vient de la charte : le design system posait 4, qui n'est
         aucun de ses jetons — et le lint d'adhérence l'a rattrapé. Sur une
         barre de 15 points, la pilule rend la même chose. */
      ligne: { height: 15, borderRadius: nativeRadius.pill, backgroundColor: couleurs.borderHairline },
      titre: { fontFamily: nativeFont.bodyRegular, fontSize: nativeSize.bodyXs, color: couleurs.textSecondary },
      texte: null,
      couleurRoue: couleurs.textAccent,
    };
  }

  if (variante === "envoi") {
    return {
      conteneur: {
        flexDirection: "row",
        alignItems: "center",
        gap: nativeSpace[10],
        paddingVertical: nativeSpace[12],
        paddingHorizontal: nativeSpace[14],
        backgroundColor: couleurs.surfacePanel,
      },
      carte: null,
      ligne: null,
      titre: { fontFamily: nativeFont.bodyRegular, fontSize: nativeSize.bodyXs, color: couleurs.textAccent },
      texte: null,
      couleurRoue: couleurs.textAccent,
    };
  }

  return {
    conteneur: { alignItems: "center", paddingVertical: nativeSpace[40], paddingHorizontal: nativeSpace[24] },
    carte: null,
    ligne: null,
    titre: { fontFamily: nativeFont.displayMedium, fontSize: 20, color: couleurs.textBody, textAlign: "center" },
    texte: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: 14.5,
      lineHeight: 22,
      color: couleurs.textSecondary,
      textAlign: "center",
      marginTop: nativeSpace[8],
    },
    couleurRoue: couleurs.textAccent,
  };
}
