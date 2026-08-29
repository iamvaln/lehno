import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeColors, nativeFont, nativeLetterSpacing, nativeRadius, nativeSpace, nativeTracking,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Le châssis des feuilles — ce que `ConfirmSheet` et `PaidActionSheet` ont en
 * commun : le voile, la poignée, les deux coins hauts, le retrait du bas.
 *
 * Il vit à part parce que ces décisions-là ne sont celles d'aucune des deux :
 * recopiées dans chacune, elles auraient divergé au premier réglage — c'est
 * déjà arrivé au filet des cartes, avant que les jetons existent.
 */

/* Le voile éteint l'écran ; il ne prend pas de thème.
 *
 * `surfaceBand` vire au violet en sombre : un voile violet TEINTERAIT l'écran
 * au lieu de l'éteindre, et la question posée par-dessus paraîtrait sur un
 * fond de fête. C'est donc l'encre de la charte, la même dans les deux thèmes,
 * comme la variante inverse du logotype. */
const ENCRE_DU_VOILE = nativeColors("light").surfaceBand;

/* Assez opaque pour que l'en-tête cesse d'exister. Le web montait la feuille
   au niveau de l'appareil pour la même raison : sans quoi le bouton retour
   reste cliquable pendant qu'on répond à la question. */
const OPACITE_DU_VOILE = 0.55;

// Le retrait minimal sous les boutons, quand l'appareil n'a pas d'indicateur
// d'accueil. Avec, c'est l'encoche qui commande — elle est plus grande.
const RETRAIT_DU_BAS = nativeSpace[16];

// Le voile couvre son parent entier. `StyleSheet.absoluteFill` viendrait de
// react-native, que ce module ne charge pas : quatre nombres disent la même
// chose et restent lisibles sous Vitest.
const REMPLISSAGE = {
  position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
} as const satisfies ViewStyle;

export interface ChassisDeFeuille {
  scene: ViewStyle;
  voile: ViewStyle;
  feuille: ViewStyle;
  poignee: ViewStyle;
  titre: TextStyle;
  texte: TextStyle;
  actions: ViewStyle;
}

export function chassisDeFeuille({
  couleurs, insetBas = 0,
}: { couleurs: Couleurs; insetBas?: number }): ChassisDeFeuille {
  return {
    /* La feuille se plaque au bas de l'écran entier, voile compris : montée
       dans l'écran, elle laisserait l'en-tête au-dessus du voile, et le bouton
       retour resterait touchable pendant la question. */
    scene: {
      flex: 1,
      justifyContent: "flex-end",
    },
    voile: {
      ...REMPLISSAGE,
      backgroundColor: ENCRE_DU_VOILE,
      opacity: OPACITE_DU_VOILE,
    },
    feuille: {
      backgroundColor: couleurs.surfaceCard,
      /* Elle monte du bord bas de l'écran : seuls les deux coins hauts
         s'arrondissent. Les quatre en feraient une carte posée, et le liseré de
         page qu'on verrait dessous démentirait le mouvement. */
      borderTopLeftRadius: nativeRadius["2xl"],
      borderTopRightRadius: nativeRadius["2xl"],
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      paddingTop: nativeSpace[20],
      paddingHorizontal: nativeSpace[20],
      /* L'indicateur d'accueil mange le bas de l'écran : le bouton de refus s'y
         glissait dessous, et le doigt qui le visait renvoyait à l'accueil. */
      paddingBottom: Math.max(insetBas, RETRAIT_DU_BAS),
    },
    /* La poignée dit d'où vient la feuille. Elle ne se touche pas — quatre
       points de haut, très loin de la cible tactile — donc elle ne porte ni
       rôle ni action : c'est le refus qui ferme, et le voile. */
    poignee: {
      alignSelf: "center",
      width: nativeSpace[44],
      height: nativeSpace[4],
      borderRadius: nativeRadius.pill,
      backgroundColor: couleurs.borderObject,
      marginTop: -nativeSpace[10],
      marginBottom: nativeSpace[16],
    },
    titre: {
      fontFamily: nativeFont.displayMedium,
      fontSize: 21,
      lineHeight: 27,
      letterSpacing: nativeLetterSpacing(21, nativeTracking.title),
      color: couleurs.textBody,
    },
    texte: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: 14.5,
      lineHeight: 22,
      color: couleurs.textSecondary,
      marginTop: nativeSpace[8],
    },
    actions: {
      gap: nativeSpace[8],
      marginTop: nativeSpace[20],
    },
  };
}
