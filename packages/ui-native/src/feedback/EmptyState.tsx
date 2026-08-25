import { Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Button } from "../core/Button.js";
import { Icon } from "../core/Icon.js";
import { ornementDeVide, styleDEtatVide } from "./EmptyState.styles.js";

export interface EmptyStateProps {
  title: string;
  text?: string | undefined;
  illustration?: string | undefined;
  icon?: string | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}

export function EmptyState({ title, text, illustration, icon, actionLabel, onAction }: EmptyStateProps) {
  const couleurs = useCouleurs();
  const s = styleDEtatVide(couleurs);
  const ornement = ornementDeVide({ illustration, icone: icon });

  return (
    <View style={s.conteneur}>
      {/* L'illustration attend son porteur — voir Illustration, à venir. En
          attendant, l'icône tient la place sans faire semblant. */}
      {ornement?.sorte === "icone" ? (
        <Icon name={ornement.nom} size={28} color={s.couleurIcone} />
      ) : null}
      <Text style={s.titre} accessibilityRole="header">{title}</Text>
      {text ? <Text style={s.texte}>{text}</Text> : null}
      {actionLabel ? (
        <Button variant="primary" onPress={onAction} style={{ marginTop: 20 }}>{actionLabel}</Button>
      ) : null}
    </View>
  );
}
