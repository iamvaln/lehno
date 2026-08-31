import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeBorder, nativeFont, nativeRadius,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

export const TONS_D_ETIQUETTE = ["outline", "quiet", "celebrate"] as const;
export type TonDEtiquette = (typeof TONS_D_ETIQUETTE)[number];

export function styleDEtiquette({
  couleurs, ton = "outline",
}: { couleurs: Couleurs; ton?: TonDEtiquette }): { conteneur: ViewStyle; libelle: TextStyle } {
  const tons: Record<TonDEtiquette, { fond: string; bord: string; texte: string }> = {
    outline: { fond: "transparent", bord: couleurs.borderObject, texte: couleurs.textBody },
    // Le ton discret se pose par son fond seul.
    quiet: { fond: couleurs.actionQuietBg, bord: "transparent", texte: couleurs.textAccent },
    /* L'abricot est la seule couleur chaude du système et ne paraît qu'au jour
       même. Le texte qui s'y pose est un jeton à part : du blanc n'y tiendrait
       pas le contraste. */
    celebrate: { fond: couleurs.celebrate, bord: "transparent", texte: couleurs.onCelebrate },
  };
  const t = tons[ton];

  return {
    conteneur: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: nativeRadius.pill,
      borderWidth: nativeBorder.width,
      borderColor: t.bord,
      backgroundColor: t.fond,
    },
    libelle: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: 13,
      lineHeight: 17,
      color: t.texte,
    },
  };
}
