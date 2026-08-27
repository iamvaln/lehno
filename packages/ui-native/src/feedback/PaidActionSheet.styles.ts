import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeBorder, nativeFont, nativeLetterSpacing, nativeSpace, nativeTracking,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Le passage obligé de toute génération : ce que ça donne, ce que ça coûte, ce
 * qu'il reste. Trois informations, toujours les trois.
 *
 * AUCUNE COPY ICI. « crédit » / « crédits », « Lancer », « Recharger », « Pas
 * maintenant » arrivent du dictionnaire — la feuille sert les deux langues, et
 * le refus s'y écrit « Pas maintenant » parce que rien n'a encore commencé.
 */

export const ACTIONS_PAYANTES = ["lancer", "recharger"] as const;
export type ActionPayante = (typeof ACTIONS_PAYANTES)[number];

/* Le solde suffit quand il ATTEINT le coût, pas quand il le dépasse.
 *
 * Le dernier crédit est justement celui qu'on veut dépenser : `solde > cout`
 * l'aurait gelé sur le compte, et la feuille aurait envoyé recharger quelqu'un
 * qui pouvait payer. */
export function soldeSuffisant(
  { cout = 1, solde = 0 }: { cout?: number; solde?: number } = {},
): boolean {
  return solde >= cout;
}

/* Une seule action principale, et jamais celle qui échouerait.
 *
 * Quand le solde ne suffit pas, le bouton devient « Recharger » : proposer
 * « Lancer » puis refuser la génération ferait porter à l'utilisateur une
 * erreur que la feuille connaissait avant lui.
 *
 * Un coût nul passe par « Lancer », même avec un compte vide — une action
 * gratuite n'a rien à recharger, et l'envoyer à la boutique serait absurde. */
export function actionPrincipale(
  { cout = 1, solde = 0 }: { cout?: number; solde?: number } = {},
): ActionPayante {
  return soldeSuffisant({ cout, solde }) ? "lancer" : "recharger";
}

export interface StyleDeFeuillePayante {
  titre: TextStyle;
  resultat: TextStyle;
  ligneDuCout: ViewStyle;
  cout: TextStyle;
}

export function styleDeFeuillePayante(couleurs: Couleurs): StyleDeFeuillePayante {
  return {
    // Le titre suit le sur-titre, qui annonce la section : l'écart les lie
    // sans les coller.
    titre: { marginTop: nativeSpace[8] },
    resultat: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: 14.5,
      lineHeight: 22,
      color: couleurs.textSecondary,
      marginTop: nativeSpace[6],
    },
    /* Le coût se sépare du reste par un filet, jamais par un encadré : ce
       produit n'a pas d'ombre, et une boîte autour du prix en ferait une offre
       commerciale. */
    ligneDuCout: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: nativeSpace[16],
      paddingTop: nativeSpace[14],
      borderTopWidth: nativeBorder.width,
      borderTopColor: couleurs.borderHairline,
    },
    // Un chiffre qu'on lit avant de décider : caractère de titre, comme le
    // solde de l'indicateur de crédits.
    cout: {
      fontFamily: nativeFont.displayMedium,
      fontSize: 19,
      letterSpacing: nativeLetterSpacing(19, nativeTracking.title),
      color: couleurs.textBody,
    },
  };
}
