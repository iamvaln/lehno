import type { TextStyle, ViewStyle } from "react-native";
import { nativeFont, nativeLineHeight, nativeSize, nativeSpace } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

export const INTENTIONS = ["info", "success", "warning", "error"] as const;
export type Intention = (typeof INTENTIONS)[number];

const SIGNES: Record<Intention, string> = {
  info: "info",
  success: "circle-check",
  warning: "triangle-alert",
  error: "circle-x",
};

/* Un bandeau tient toute la largeur : ni rayon, ni trait, ni ombre. Ce n'est
   pas une carte posée dans la page, c'est une bande qui la traverse.

   Chaque intention apparie une encre et son fond. Une inversion — l'encre de
   l'avertissement sur le fond de l'erreur — resterait lisible et mentirait sur
   la gravité : c'est le genre de faute qu'aucun œil n'attrape, d'où le test. */
export function styleDeBandeau({
  couleurs, intention = "info",
}: { couleurs: Couleurs; intention?: Intention }): {
  conteneur: ViewStyle;
  texte: TextStyle;
  icone: string;
  couleurIcone: string;
  urgence: "polite" | "assertive";
} {
  const encres: Record<Intention, { fg: string; bg: string }> = {
    info: { fg: couleurs.feedbackInfo, bg: couleurs.feedbackInfoBg },
    success: { fg: couleurs.feedbackSuccess, bg: couleurs.feedbackSuccessBg },
    warning: { fg: couleurs.feedbackWarning, bg: couleurs.feedbackWarningBg },
    error: { fg: couleurs.feedbackError, bg: couleurs.feedbackErrorBg },
  };
  const e = encres[intention];

  return {
    conteneur: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: nativeSpace[10],
      paddingVertical: nativeSpace[12],
      paddingHorizontal: nativeSpace[14],
      borderRadius: 0,
      backgroundColor: e.bg,
    },
    texte: {
      flex: 1,
      fontFamily: nativeFont.bodyRegular,
      fontSize: nativeSize.bodyXs,
      lineHeight: nativeLineHeight(nativeSize.bodyXs, 1.45),
      color: e.fg,
    },
    icone: SIGNES[intention],
    couleurIcone: e.fg,
    /* Une erreur interrompt ; le reste informe. Sans cette distinction, tout
       devient également urgent pour le lecteur d'écran — donc rien ne l'est. */
    urgence: intention === "error" ? "assertive" : "polite",
  };
}
