import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { nativeFont } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* L'initiale, quand il n'y a pas de photo. Le point d'interrogation dit qu'il
   manque un nom — une pastille muette laisserait croire à un défaut d'affichage.
   `trim` compte : un nom qui commence par une espace rendrait vide. */
export function initiale(nom: string): string {
  return String(nom).trim().charAt(0).toUpperCase() || "?";
}

/* La pastille se pose indifféremment sur une View — l'initiale — ou sur une
   Image — la photo. L'intersection des deux types dit exactement cela, et
   resserre au passage `overflow`, qu'une Image n'accepte pas en « scroll ». */
export function styleDAvatar({ couleurs, taille }: { couleurs: Couleurs; taille: number }): {
  conteneur: ViewStyle & ImageStyle;
  initiale: TextStyle;
} {
  return {
    conteneur: {
      width: taille,
      height: taille,
      // « borderRadius: 50% » n'a pas d'équivalent fiable en RN : c'est la
      // moitié du côté qui fait le cercle.
      borderRadius: taille / 2,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
      backgroundColor: couleurs.actionQuietBg,
    },
    initiale: {
      fontFamily: nativeFont.displayMedium,
      // L'initiale suit la taille de la pastille : une valeur fixe rendrait
      // minuscule à 64 et débordante à 28.
      fontSize: Math.round(taille * 0.4),
      color: couleurs.textAccent,
    },
  };
}
