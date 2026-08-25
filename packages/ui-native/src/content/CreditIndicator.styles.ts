import type { TextStyle, ViewStyle } from "react-native";
import { nativeFont, nativeLetterSpacing, nativeSize, nativeTracking } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* L'indicateur de crédits — présent à chaque action payante, et le coût
 * s'affiche AVANT de lancer.
 *
 * AUCUNE COPY ICI. « crédit », « crédits », « il vous en reste » vivaient dans
 * le composant, accordés en français seulement.
 */

export function styleDIndicateurDeCredit({
  couleurs, solde, cout, variante = "inline",
}: {
  couleurs: Couleurs;
  solde?: number;
  cout?: number;
  variante?: "inline" | "solde";
}): { conteneur: ViewStyle; texte: TextStyle; nombre: TextStyle | null; couleurIcone: string } {
  // Sans solde connu, rien ne permet de dire qu'il manque quelque chose : la
  // ligne reste neutre plutôt que d'alarmer à tort.
  const insuffisant = cout != null && solde != null && solde < cout;
  // Un avertissement, pas une erreur : rien n'est encore cassé.
  const couleur = insuffisant ? couleurs.feedbackWarning : couleurs.textMention;

  if (variante === "solde") {
    return {
      conteneur: { flexDirection: "row", alignItems: "baseline", gap: 6 },
      // Un chiffre qu'on lit de loin : caractère de titre, unité en petit.
      nombre: {
        fontFamily: nativeFont.displayRegular,
        fontSize: 34,
        lineHeight: 34,
        letterSpacing: nativeLetterSpacing(34, nativeTracking.display),
        color: couleurs.textBody,
      },
      texte: {
        fontFamily: nativeFont.bodyRegular,
        fontSize: nativeSize.bodyS,
        color: couleurs.textSecondary,
      },
      couleurIcone: couleur,
    };
  }

  return {
    conteneur: { flexDirection: "row", alignItems: "center", gap: 6 },
    nombre: null,
    texte: { fontFamily: nativeFont.bodyRegular, fontSize: 12.5, color: couleur },
    couleurIcone: couleur,
  };
}
