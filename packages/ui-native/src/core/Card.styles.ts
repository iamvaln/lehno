import type { ViewStyle } from "react-native";
import { nativeRadius, type NomDeRayon } from "@lehno/tokens";
import type { Couleurs } from "../theme.js";

export const SURFACES_DE_CARTE = ["card", "panel", "plain"] as const;
export type SurfaceDeCarte = (typeof SURFACES_DE_CARTE)[number];

/* Une carte Lehno se dessine par UNE BORDURE ET UN FOND, jamais par une ombre.
   La règle est plus forte encore en natif : l'ombre diverge entre iOS
   (shadow*) et Android (elevation), donc une carte à l'ombre serait deux
   cartes. Le test le vérifie sur toutes les surfaces et les deux thèmes. */
export function styleDeCarte({
  couleurs, surface = "card", rayon = "xl", rembourrage = 22,
}: {
  couleurs: Couleurs;
  surface?: SurfaceDeCarte;
  rayon?: NomDeRayon;
  rembourrage?: number;
}): ViewStyle {
  const surfaces: Record<SurfaceDeCarte, { fond: string; bord: string }> = {
    card: { fond: couleurs.surfaceCard, bord: couleurs.borderObject },
    // Le panneau se distingue par son fond, pas par un trait : lui donner les
    // deux le ferait ressortir deux fois.
    panel: { fond: couleurs.surfacePanel, bord: "transparent" },
    plain: { fond: "transparent", bord: couleurs.borderObject },
  };
  const s = surfaces[surface];

  return {
    padding: rembourrage,
    borderRadius: nativeRadius[rayon],
    borderWidth: 1,
    borderColor: s.bord,
    backgroundColor: s.fond,
  };
}
