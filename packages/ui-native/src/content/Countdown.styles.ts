import type { TextStyle, ViewStyle } from "react-native";
import { nativeFont, nativeLetterSpacing, nativeRadius, nativeTracking } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Le décompte — un traitement typographique, pas un composant de données.
 *
 * AUCUNE COPY ICI. Le design system écrivait « aujourd'hui », « J−N » et
 * « N days » dans le composant ; la règle du projet veut que chaque langue
 * s'écrive en entier dans le dictionnaire, et le pluriel anglais ne s'accorde
 * pas comme le français. Le libellé arrive donc en prop.
 */

export const TAILLES_DE_DECOMPTE = { s: 20, m: 34, l: 76 } as const;
export type TailleDeDecompte = keyof typeof TAILLES_DE_DECOMPTE;

export function styleDeDecompte({
  couleurs, jourMeme = false, taille = "m",
}: {
  couleurs: Couleurs;
  jourMeme?: boolean;
  taille?: TailleDeDecompte;
}): { texte: TextStyle; pilule: ViewStyle | null } {
  const px = TAILLES_DE_DECOMPTE[taille];

  /* Le jour même bascule en pilule abricot — le seul moment où cette couleur
     paraît. Le libellé ne suit pas l'échelle du décompte : à 76, un texte
     proportionnel déborderait de la carte. Il se cale, avec un plancher. */
  if (jourMeme) {
    return {
      texte: {
        fontFamily: nativeFont.bodySemibold,
        fontSize: Math.max(12, Math.round(px * 0.36)),
        color: couleurs.onCelebrate,
      },
      pilule: {
        alignSelf: "flex-start",
        paddingVertical: 5,
        paddingHorizontal: 11,
        borderRadius: nativeRadius.pill,
        backgroundColor: couleurs.celebrate,
      },
    };
  }

  return {
    texte: {
      fontFamily: nativeFont.displayRegular,
      fontSize: px,
      lineHeight: Math.round(px * 0.95),
      letterSpacing: nativeLetterSpacing(px, nativeTracking.display),
      color: couleurs.textAccent,
    },
    pilule: null,
  };
}
