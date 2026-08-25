import type { TextStyle } from "react-native";
import { nativeFont, nativeLetterSpacing, nativeSize, nativeTracking } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Le sur-titre tient par ses capitales et son interlettrage : c'est ce qui le
   distingue d'un simple texte gris, à une taille où le gras ne suffirait pas.
   Le gris est celui de la mention, pas celui du texte — il annonce une section,
   il ne se lit pas. */
export function styleDeSurTitre(couleurs: Couleurs): TextStyle {
  return {
    fontFamily: nativeFont.bodySemibold,
    fontSize: nativeSize.kicker,
    letterSpacing: nativeLetterSpacing(nativeSize.kicker, nativeTracking.kicker),
    textTransform: "uppercase",
    color: couleurs.textMention,
  };
}
