import type { TextStyle, ViewStyle } from "react-native";
import {
  nativeColors, nativeFont, nativeLineHeight, nativeRadius, nativeSize, nativeSpace, nativeTouchMin,
} from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* L'accusé — le geste est parti d'une liste ou d'une feuille, l'accusé le
 * confirme en bas de l'écran, puis s'efface. `Banner` décrit l'état d'une page
 * et reste ; un accusé ne se lit pas deux fois.
 *
 * Il se pose sur la BANDE, jamais sur la page : c'est ce qui le fait flotter
 * au-dessus du contenu sans ombre — la profondeur vient du contraste, comme
 * partout ailleurs dans ce produit.
 */

export const INTENTIONS_D_ACCUSE = ["success", "info", "error"] as const;
export type IntentionDAccuse = (typeof INTENTIONS_D_ACCUSE)[number];

const SIGNES: Record<IntentionDAccuse, string> = {
  success: "circle-check",
  info: "info",
  error: "circle-x",
};

/* Les encres du thème SOMBRE, quel que soit le thème courant.
 *
 * La bande est foncée dans les deux thèmes — encre en clair, violet profond en
 * sombre. Le web posait `var(--feedback-error)` sur `--surface-inverse`, ce qui
 * traduit mot à mot donnerait le rouge du thème clair (#B3261E) sur l'encre :
 * 2,47:1, un signe qu'on ne voit pas. Les couleurs de retour du thème sombre
 * sont celles que la charte destine à un fond foncé, et elles tiennent sur les
 * deux bandes — c'est le test qui le vérifie, pas cette phrase. */
const ENCRES_SUR_BANDE = nativeColors("dark");

export function encreDuSigne(intention: IntentionDAccuse): string {
  switch (intention) {
    case "success":
      return ENCRES_SUR_BANDE.feedbackSuccess;
    case "error":
      return ENCRES_SUR_BANDE.feedbackError;
    default:
      return ENCRES_SUR_BANDE.feedbackInfo;
  }
}

// Six secondes : le temps de lire une ligne et d'atteindre la sortie qu'elle
// offre. La valeur vient du design system.
export const DUREE_PAR_DEFAUT = 6000;

/* Deux façons de ne pas s'effacer, et une seule s'écrit à l'appel.
 *
 * Sans `onDismiss`, l'accusé n'a personne à prévenir : poser un minuteur qui
 * n'appelle rien laisserait croire qu'il disparaît. Une durée nulle le fige
 * exprès — c'est ce que veut une erreur, qui reste sous les yeux. */
export function delaiDEffacement(
  { duree = DUREE_PAR_DEFAUT, effacable }: { duree?: number; effacable: boolean },
): number | null {
  if (!effacable) return null;
  if (duree <= 0) return null;
  return duree;
}

export interface StyleDAccuse {
  conteneur: ViewStyle;
  texte: TextStyle;
  action: TextStyle;
  commande: ViewStyle;
  fermeture: ViewStyle;
  signe: string;
  couleurSigne: string;
  couleurEncre: string;
  tailleSigne: number;
  tailleFermeture: number;
  urgence: "polite" | "assertive";
}

export function styleDAccuse({
  couleurs, intention = "success", insetBas = 0,
}: { couleurs: Couleurs; intention?: IntentionDAccuse; insetBas?: number }): StyleDAccuse {
  // L'encre que la charte pose sur la bande. Le texte ne prend jamais la
  // couleur de l'intention : le signe porte la nuance, le texte porte le sens.
  const encre = couleurs.onBand;

  return {
    conteneur: {
      // `position: fixed` n'existe pas en natif : l'accusé se pose en absolu
      // dans la racine de l'écran, et c'est l'appelant qui le monte là.
      position: "absolute",
      left: nativeSpace[16],
      right: nativeSpace[16],
      /* Le creux du bas — barre d'accueil, barre d'onglets — se dégage comme
         sous les feuilles : posé à seize points du bord, l'accusé passe sous
         l'indicateur d'accueil et sa fermeture devient intouchable. */
      bottom: Math.max(insetBas, nativeSpace[16]),
      flexDirection: "row",
      alignItems: "center",
      gap: nativeSpace[10],
      paddingVertical: nativeSpace[8],
      paddingHorizontal: nativeSpace[14],
      borderRadius: nativeRadius.md,
      backgroundColor: couleurs.surfaceBand,
    },
    texte: {
      flex: 1,
      fontFamily: nativeFont.bodyRegular,
      fontSize: nativeSize.bodyXs,
      lineHeight: nativeLineHeight(nativeSize.bodyXs, 1.45),
      color: encre,
    },
    action: {
      fontFamily: nativeFont.bodySemibold,
      fontSize: nativeSize.bodyXs,
      color: encre,
      // Le web soulignait la sortie pour la distinguer du texte d'accusé. Sur
      // une bande foncée, la graisse seule ne suffit pas à dire « ceci se
      // touche » : le trait reste.
      textDecorationLine: "underline",
    },
    /* Les deux commandes atteignent la cible tactile par elles-mêmes. Un
       hitSlop les ferait se recouvrir — elles sont voisines dans la même
       ligne, et le doigt tomberait sur « Fermer » en visant « Annuler ». */
    commande: {
      minHeight: nativeTouchMin,
      justifyContent: "center",
    },
    fermeture: {
      minHeight: nativeTouchMin,
      minWidth: nativeTouchMin,
      alignItems: "flex-end",
      justifyContent: "center",
      // La fermeture s'efface derrière la sortie qu'offre l'accusé : elle est
      // là pour chasser, pas pour attirer.
      opacity: 0.7,
    },
    signe: SIGNES[intention],
    couleurSigne: encreDuSigne(intention),
    couleurEncre: encre,
    tailleSigne: 17,
    tailleFermeture: 15,
    /* Une erreur interrompt ; le reste informe. La même règle que le bandeau —
       sans elle, tout devient également urgent, donc rien ne l'est. */
    urgence: intention === "error" ? "assertive" : "polite",
  };
}
