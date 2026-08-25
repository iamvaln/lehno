import { Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Icon } from "../core/Icon.js";
import { styleDeBandeauHorsLigne } from "./OfflineBanner.styles.js";

export interface OfflineBannerProps {
  // Le message vient du dictionnaire : le design system composait trois phrases
  // françaises avec l'accord du pluriel.
  message: string;
}

export function OfflineBanner({ message }: OfflineBannerProps) {
  const couleurs = useCouleurs();
  const s = styleDeBandeauHorsLigne(couleurs);
  return (
    <View style={s.conteneur} accessibilityRole="text" accessibilityLiveRegion="polite">
      <Icon name="cloud-off" size={15} color={s.couleurIcone} />
      <Text style={s.texte}>{message}</Text>
    </View>
  );
}
