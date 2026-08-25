import type { TextStyle, ViewStyle } from "react-native";
import { nativeFont, nativeSize, nativeSpace } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* D'où vient une note, et quand. Une provenance à moitié connue reste utile —
   « en mars » seul situe déjà — mais rien à dire veut dire rien à afficher :
   un filet seul sous une note serait un trait sans raison. */
export function ligneDeProvenance(parties: readonly (string | null | undefined)[]): string | null {
  const retenues = parties.filter((p): p is string => Boolean(p));
  return retenues.length > 0 ? retenues.join(" · ") : null;
}

export function styleDeProvenance(couleurs: Couleurs): { conteneur: ViewStyle; texte: TextStyle } {
  return {
    conteneur: {
      flexDirection: "row",
      alignItems: "center",
      gap: nativeSpace[6],
      marginTop: nativeSpace[10],
      paddingTop: nativeSpace[8],
      // Elle se rattache à la note du dessus par un filet, jamais par une marge
      // seule.
      borderTopWidth: 1,
      borderTopColor: couleurs.borderHairline,
    },
    texte: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: nativeSize.mentionS,
      color: couleurs.textMention,
    },
  };
}
