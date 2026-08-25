import { ActivityIndicator, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Button } from "../core/Button.js";
import { estQuittable, styleDAttente, type VarianteDAttente } from "./LoadingState.styles.js";

export interface LoadingStateProps {
  variant?: VarianteDAttente | undefined;
  // On ne fait jamais patienter sans dire sur quoi — et le texte vient du
  // dictionnaire, le design system posant « Chargement » et « Envoi en cours »
  // en replis français.
  title: string;
  text?: string | undefined;
  rows?: number | undefined;
  leaveLabel?: string | undefined;
  onLeave?: (() => void) | undefined;
}

export function LoadingState({ variant = "liste", title, text, rows = 3, leaveLabel, onLeave }: LoadingStateProps) {
  const couleurs = useCouleurs();
  const s = styleDAttente({ couleurs, variante: variant });

  if (variant === "liste" && s.carte && s.ligne) {
    return (
      <View style={s.conteneur} accessibilityLabel={title} accessibilityLiveRegion="polite">
        {Array.from({ length: rows }).map((_, rang) => (
          <View key={rang} style={s.carte!}>
            <View style={[s.ligne!, { width: "42%" }]} />
            <View style={[s.ligne!, { height: 12, width: "64%" }]} />
          </View>
        ))}
      </View>
    );
  }

  if (variant === "envoi") {
    return (
      <View style={s.conteneur} accessibilityLiveRegion="polite">
        <ActivityIndicator size="small" color={s.couleurRoue} />
        <Text style={s.titre}>{title}</Text>
      </View>
    );
  }

  return (
    <View style={s.conteneur} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={s.couleurRoue} />
      <Text style={[s.titre, { marginTop: 18 }]} accessibilityRole="header">{title}</Text>
      {text && s.texte ? <Text style={s.texte}>{text}</Text> : null}
      {/* Quitter sans perdre : la promesse ne vaut que pour l'attente longue. */}
      {estQuittable(variant) && leaveLabel ? (
        <Button variant="text" onPress={onLeave} style={{ marginTop: 18 }}>{leaveLabel}</Button>
      ) : null}
    </View>
  );
}
