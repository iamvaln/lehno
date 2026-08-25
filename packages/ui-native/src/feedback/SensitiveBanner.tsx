import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { styleDeBandeauSensible } from "./SensitiveBanner.styles.js";

/* Aucune icône, aucun défaut de texte : le produit n'a rien à ajouter à la
   date. Ce que ce composant ne fait pas est ce qui le définit. */
export function SensitiveBanner({ children }: { children: ReactNode }) {
  const couleurs = useCouleurs();
  const s = styleDeBandeauSensible(couleurs);
  return (
    <View style={s.conteneur} accessibilityRole="text">
      <Text style={s.texte}>{children}</Text>
    </View>
  );
}
