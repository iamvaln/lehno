import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeFont, nativeLeading, nativeLetterSpacing, nativeLineHeight, nativeRadius,
  nativeSize, nativeSpace, nativeTouchMin, nativeTracking,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* La brique la plus réutilisée du kit — accueil et fiches.
 *
 * La plus imminente porte un fond teinté et ses DEUX actions visibles :
 * préparer, marquer envoyé. Les suivantes restent des lignes calmes, parce que
 * « ce qui est rare vit ailleurs ». Le fond teinté remplace le trait — les deux
 * ensemble la feraient ressortir deux fois.
 */
export function styleDeCarteDEcheance({
  couleurs, enAvant = false,
}: { couleurs: Couleurs; enAvant?: boolean }): {
  enveloppe: ViewStyle;
  ligne: ViewStyle;
  texte: ViewStyle;
  nom: TextStyle;
  quoi: TextStyle;
  actions: ViewStyle | null;
} {
  return {
    enveloppe: {
      borderRadius: nativeRadius.lg,
      borderWidth: 1,
      borderColor: enAvant ? "transparent" : couleurs.borderObject,
      backgroundColor: enAvant ? couleurs.surfacePanel : couleurs.surfaceCard,
    },
    ligne: {
      flexDirection: "row",
      alignItems: "center",
      gap: nativeSpace[12],
      // Une carte se touche : la ligne ne descend pas sous la cible tactile,
      // même quand le nom et l'occasion tiennent sur peu de hauteur.
      minHeight: nativeTouchMin,
      paddingVertical: nativeSpace[14],
      paddingHorizontal: 15,
    },
    // flexShrink, pas minWidth: 0 — qui n'existe pas en RN. C'est lui qui
    // empêche un nom long de pousser le décompte hors de la carte.
    texte: { flex: 1, flexShrink: 1 },
    nom: {
      fontFamily: nativeFont.displayMedium,
      fontSize: nativeSize.displayXs,
      lineHeight: nativeLineHeight(nativeSize.displayXs, nativeLeading.title),
      letterSpacing: nativeLetterSpacing(nativeSize.displayXs, nativeTracking.title),
      color: couleurs.textBody,
    },
    quoi: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: nativeSize.bodyXs,
      lineHeight: nativeLineHeight(nativeSize.bodyXs, 1.4),
      color: couleurs.textSecondary,
    },
    actions: enAvant
      ? { gap: nativeSpace[6], paddingHorizontal: 15, paddingBottom: nativeSpace[14], paddingTop: nativeSpace[2] }
      : null,
  };
}
