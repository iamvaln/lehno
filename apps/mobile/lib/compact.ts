import { useWindowDimensions } from "react-native";

/* Le kit resserre certains écrans sur un iPhone SE par un sélecteur CSS —
   `[data-modele="se"]`. React Native n'a pas de sélecteur : la question se pose
   à l'exécution, et la fenêtre est la seule qui sache y répondre.
 *
 * Le seuil est la hauteur, pas la largeur : c'est elle qui manquait — l'écran
 * du code dépassait de quatre-vingts points et obligeait à faire défiler pour
 * atteindre « Valider ». Un SE fait 568 de haut, le modèle courant au moins 800.
 *
 * `useWindowDimensions` suit les changements — rotation, fenêtre partagée sur
 * tablette — là où `Dimensions.get` fige la valeur au premier rendu.
 */
export const SEUIL_COMPACT = 600;

export function useCompact(): boolean {
  return useWindowDimensions().height < SEUIL_COMPACT;
}
