import type { TextStyle, ViewStyle } from "react-native";
import { nativeFont, nativeLineHeight, nativeSize } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Un moment grave.
 *
 * Le doc de ton est net : « sobre, court, sans compassion affichée. On
 * accompagne en se taisant. » D'où l'absence d'icône — un cœur ou des mains
 * jointes seraient précisément la compassion affichée — et l'absence de couleur
 * d'intention : la gravité n'est pas un avertissement. Ce que ce composant ne
 * fait pas est ce qui le définit, et c'est ce que son test vérifie.
 */
export function styleDeBandeauSensible(couleurs: Couleurs): {
  conteneur: ViewStyle;
  texte: TextStyle;
} {
  return {
    conteneur: {
      paddingVertical: 13,
      paddingHorizontal: 15,
      borderRadius: 0,
      backgroundColor: couleurs.surfacePanel,
    },
    texte: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: nativeSize.bodyXs,
      lineHeight: nativeLineHeight(nativeSize.bodyXs, 1.5),
      color: couleurs.textBody,
    },
  };
}
