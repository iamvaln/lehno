import type { TextStyle, ViewStyle } from "react-native";
import { nativeFont, nativeLineHeight, nativeSize, nativeSpace } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Hors connexion.
 *
 * Ce n'est pas une erreur : rien n'est cassé, la consultation continue depuis
 * le cache, et ce qui a été lancé repartira. Le poser en rouge ferait croire à
 * une panne du produit là où c'est le réseau qui manque. Il prend donc la
 * surface calme, comme le moment grave.
 *
 * AUCUNE COPY ICI. Le design system composait trois phrases françaises avec
 * l'accord du pluriel — « Une action repartira », « N actions repartiront ».
 */
export function styleDeBandeauHorsLigne(couleurs: Couleurs): {
  conteneur: ViewStyle;
  texte: TextStyle;
  couleurIcone: string;
} {
  return {
    conteneur: {
      flexDirection: "row",
      alignItems: "center",
      gap: nativeSpace[10],
      paddingVertical: nativeSpace[10],
      paddingHorizontal: nativeSpace[14],
      borderRadius: 0,
      backgroundColor: couleurs.surfacePanel,
    },
    texte: {
      flex: 1,
      fontFamily: nativeFont.bodyRegular,
      fontSize: nativeSize.mentionS,
      lineHeight: nativeLineHeight(nativeSize.mentionS, 1.45),
      color: couleurs.textBody,
    },
    couleurIcone: couleurs.textSecondary,
  };
}
