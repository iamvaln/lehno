import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeBorder, nativeFont, nativeRadius, nativeTouchMin,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* L'étiquette de catégorie d'une note.
 *
 * AUCUNE COPY ICI. Le design system portait la table des libellés — « Goût »,
 * « No-go », « À classer » — dans le composant, en français seulement. Ils
 * arrivent maintenant du dictionnaire.
 */

export function styleDeCategorie({
  couleurs, aClasser = false, reclassable = false,
}: {
  couleurs: Couleurs;
  aClasser?: boolean;
  reclassable?: boolean;
}): { pilule: ViewStyle; libelle: TextStyle; couleurIcone: string; zoneDAppui: ViewStyle | null } {
  return {
    pilule: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      paddingVertical: reclassable ? 6 : 5,
      paddingLeft: 12,
      paddingRight: reclassable ? 10 : 12,
      borderRadius: nativeRadius.pill,
      borderWidth: nativeBorder.width,
      // Une note non classée se signale par un trait interrompu : elle attend
      // une décision, elle n'affirme rien.
      borderStyle: aClasser ? "dashed" : "solid",
      borderColor: aClasser ? couleurs.borderObject : "transparent",
      backgroundColor: aClasser ? "transparent" : couleurs.actionQuietBg,
    },
    libelle: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: 12.5,
      lineHeight: 16,
      color: aClasser ? couleurs.textMention : couleurs.textAccent,
    },
    // Comme pour le bouton : RN n'a pas de currentColor, la couleur de l'icône
    // se transporte donc explicitement.
    couleurIcone: aClasser ? couleurs.textMention : couleurs.textAccent,
    /* La pilule reste compacte ; c'est la zone d'appui qui porte les 44 points,
       par une marge négative. Une zone d'appui ne se lit pas, elle se touche —
       et une pilule à 44 de haut serait un pavé au milieu d'une note. */
    zoneDAppui: reclassable
      ? { alignSelf: "flex-start", justifyContent: "center", minHeight: nativeTouchMin, marginVertical: -6 }
      : null,
  };
}
