import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeBorder, nativeFont, nativeTouchMin,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Quatre onglets, pas davantage.
 *
 * AUCUNE COPY ICI. Le design system portait ses quatre libellés en dur, en
 * français ; les clés — accueil, dates, proches, moi — sont de la structure et
 * restent, les libellés viennent du dictionnaire.
 */
/* LA BARRE PORTE L'INSET DU BAS, et les écrans ne l'ajoutent pas.
 *
 * Deux insets additionnés donnent le trou blanc au-dessus du menu système
 * qu'on voit dans tant d'applications. La barre peint DESSOUS : son fond
 * descend jusqu'au bord, et seuls les onglets s'arrêtent au-dessus de la
 * poignée. Un fond qui s'arrêterait à la poignée laisserait une bande de page
 * sous une barre qui ne s'y pose plus.
 *
 * Sur un appareil sans encoche ni poignée, l'inset vaut zéro et le
 * rembourrage de l'onglet suffit — c'est le cas ordinaire, pas une exception. */
export function styleDOnglets({
  couleurs, actif = false, insetBas = 0,
}: { couleurs: Couleurs; actif?: boolean; insetBas?: number }): {
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
      borderTopWidth: nativeBorder.width,
      borderTopColor: couleurs.borderHairline,
      backgroundColor: couleurs.surfacePage,
      paddingBottom: insetBas,
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
