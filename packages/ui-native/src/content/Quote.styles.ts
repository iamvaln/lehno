import type { TextStyle } from "react-native";
import { nativeFont } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* La citation — l'italique de titre, et rien d'autre.
 *
 * LES GUILLEMETS SONT DE LA COPY. Le design system posait « … » à la française,
 * espaces insécables comprises ; l'anglais n'en veut pas et prend " ". Ils
 * arrivent donc du dictionnaire, comme le reste.
 */

// Sur une note de trois mots, les guillemets pèsent plus que le mot cité. Le
// seuil vient du design system, où il valait 90 caractères.
const SEUIL = 90;

export function meriteDesGuillemets(texte: string, choix?: boolean): boolean {
  if (choix != null) return choix;
  return texte.length > SEUIL;
}

export function styleDeCitation({
  couleurs, taille = 16, ton = "body",
}: {
  couleurs: Couleurs;
  taille?: number;
  ton?: "body" | "muted";
}): TextStyle {
  return {
    fontFamily: nativeFont.displayItalic,
    fontSize: taille,
    lineHeight: Math.round(taille * 1.45),
    color: ton === "muted" ? couleurs.textSecondary : couleurs.textBody,
  };
}
