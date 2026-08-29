import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeBorder, nativeFont, nativeRadius, nativeSize, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

export function styleDeChamp({
  couleurs, invalide = false, multiligne = false,
}: { couleurs: Couleurs; invalide?: boolean; multiligne?: boolean }): {
  conteneur: ViewStyle;
  etiquette: TextStyle;
  champ: TextStyle;
  aide: TextStyle;
  couleurIndice: string;
} {
  return {
    conteneur: { gap: nativeSpace[6] },
    etiquette: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: nativeSize.bodyXs,
      color: couleurs.textSecondary,
    },
    champ: {
      fontFamily: nativeFont.bodyRegular,
      // 16 points : la taille de corps mobile de la charte, et celle en dessous
      // de laquelle un champ devient pénible à relire au pouce.
      fontSize: nativeSize.bodyM,
      color: couleurs.textBody,
      backgroundColor: couleurs.surfaceCard,
      borderWidth: nativeBorder.width,
      // L'erreur se voit sur le contour ET sur l'aide : le contour seul ne dit
      // pas ce qui ne va pas, l'aide seule se lit trop tard.
      borderColor: invalide ? couleurs.feedbackError : couleurs.borderObject,
      borderRadius: nativeRadius.sm,
      paddingVertical: nativeSpace[14],
      paddingHorizontal: 15,
      // Un champ se touche : il ne descend pas sous la cible tactile, même vide.
      minHeight: multiligne ? nativeTouchMin * 3 : nativeTouchMin,
      /* En multiligne le texte part du haut. Sans cela, Android centre
         verticalement : on tape une note de six lignes dans un champ où la
         première phrase flotte au milieu. */
      ...(multiligne ? { textAlignVertical: "top" as const, lineHeight: 24 } : {}),
    },
    aide: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: nativeSize.mentionS,
      color: invalide ? couleurs.feedbackError : couleurs.textMention,
    },
    couleurIndice: couleurs.textMention,
  };
}
