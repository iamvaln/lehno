import { Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Icon } from "../core/Icon.js";
import { styleDIndicateurDeCredit } from "./CreditIndicator.styles.js";

export interface CreditIndicatorProps {
  // Les libellés viennent du dictionnaire : « crédit » / « crédits » et « il
  // vous en reste » s'accordaient en français dans le composant.
  label: string;
  balance?: number | undefined;
  cost?: number | undefined;
  variant?: "inline" | "solde";
}

export function CreditIndicator({ label, balance, cost, variant = "inline" }: CreditIndicatorProps) {
  const couleurs = useCouleurs();
  const s = styleDIndicateurDeCredit({
    couleurs,
    ...(balance !== undefined ? { solde: balance } : {}),
    ...(cost !== undefined ? { cout: cost } : {}),
    variante: variant,
  });

  if (variant === "solde" && s.nombre) {
    return (
      <View style={s.conteneur}>
        <Text style={s.nombre}>{balance}</Text>
        <Text style={s.texte}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={s.conteneur}>
      <Icon name="coins" size={14} strokeWidth={2} color={s.couleurIcone} />
      <Text style={s.texte}>{label}</Text>
    </View>
  );
}
