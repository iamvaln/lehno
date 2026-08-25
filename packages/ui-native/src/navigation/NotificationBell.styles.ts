import type { TextStyle, ViewStyle } from "react-native";
import { nativeFont, nativeRadius, nativeTouchMin } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

/* Au-delà de neuf, le nombre exact ne change plus la décision : on ouvre. Et un
   compteur à trois chiffres déborderait de la pastille. */
export function pastilleDeCloche(nonLus: number): string | null {
  if (nonLus <= 0) return null;
  return nonLus > 9 ? "9+" : String(nonLus);
}

export function styleDeCloche(couleurs: Couleurs): {
  bouton: ViewStyle;
  pastille: ViewStyle;
  nombre: TextStyle;
  couleurIcone: string;
} {
  return {
    bouton: {
      alignItems: "center",
      justifyContent: "center",
      padding: 6,
      // La cloche vit dans un en-tête serré : elle porte ses 44 points par une
      // marge négative, sans pousser les éléments voisins.
      margin: -6,
      minWidth: nativeTouchMin,
      minHeight: nativeTouchMin,
    },
    pastille: {
      position: "absolute",
      top: 6,
      right: 6,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: nativeRadius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: couleurs.action,
    },
    nombre: {
      fontFamily: nativeFont.bodyBold,
      fontSize: 10,
      // L'encre que la charte pose sur l'action : du blanc n'y tiendrait pas le
      // contraste en thème sombre.
      color: couleurs.textOnAccent,
    },
    couleurIcone: couleurs.textSecondary,
  };
}
