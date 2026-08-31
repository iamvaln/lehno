import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeFont, nativeLetterSpacing, nativeSpace, nativeTracking,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Un ornement, pas deux. Une illustration ET une icône feraient deux signes
   pour un écran qui n'a rien à montrer. L'illustration l'emporte : elle
   réchauffe le vide, l'icône ne fait que le signaler. */
export function ornementDeVide(
  { illustration, icone }: { illustration?: string | undefined; icone?: string | undefined },
): { sorte: "illustration" | "icone"; nom: string } | null {
  if (illustration) return { sorte: "illustration", nom: illustration };
  if (icone) return { sorte: "icone", nom: icone };
  return null;
}

export function styleDEtatVide(couleurs: Couleurs): {
  conteneur: ViewStyle;
  titre: TextStyle;
  texte: TextStyle;
  couleurIcone: string;
} {
  return {
    conteneur: {
      alignItems: "center",
      paddingVertical: nativeSpace[40],
      paddingHorizontal: nativeSpace[24],
    },
    titre: {
      fontFamily: nativeFont.displayMedium,
      fontSize: 21,
      letterSpacing: nativeLetterSpacing(21, nativeTracking.title),
      color: couleurs.textBody,
      textAlign: "center",
    },
    texte: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: 14.5,
      lineHeight: 22,
      color: couleurs.textSecondary,
      textAlign: "center",
      marginTop: nativeSpace[8],
    },
    couleurIcone: couleurs.textAccent,
  };
}
