import type { TextStyle, ViewStyle } from "react-native";
import { nativeFont, nativeTouchMin } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Quatre onglets, pas davantage.
 *
 * AUCUNE COPY ICI. Le design system portait ses quatre libellés en dur, en
 * français ; les clés — accueil, dates, proches, moi — sont de la structure et
 * restent, les libellés viennent du dictionnaire.
 */
export function styleDOnglets({
  couleurs, actif = false,
}: { couleurs: Couleurs; actif?: boolean }): {
  barre: ViewStyle;
  onglet: ViewStyle;
  libelle: TextStyle;
  couleurIcone: string;
} {
  return {
    barre: {
      flexDirection: "row",
      // La barre se sépare du contenu par un filet, jamais par une ombre : la
      // même règle que les cartes, et pour la même raison.
      borderTopWidth: 1,
      borderTopColor: couleurs.borderHairline,
      backgroundColor: couleurs.surfacePage,
    },
    onglet: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      minHeight: nativeTouchMin,
      paddingTop: 9,
      paddingBottom: 10,
    },
    libelle: {
      // L'onglet courant se distingue par la couleur ET par la graisse : la
      // couleur seule ne suffit pas à qui la distingue mal.
      fontFamily: actif ? nativeFont.bodySemibold : nativeFont.bodyRegular,
      fontSize: 11,
      color: actif ? couleurs.textAccent : couleurs.textMention,
    },
    couleurIcone: actif ? couleurs.textAccent : couleurs.textMention,
  };
}
