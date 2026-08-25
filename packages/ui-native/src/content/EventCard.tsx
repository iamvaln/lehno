import { Pressable, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Button } from "../core/Button.js";
import { Countdown } from "./Countdown.js";
import { styleDeCarteDEcheance } from "./EventCard.styles.js";

export interface EventCardProps {
  name: string;
  what: string;
  // Le décompte arrive composé : « J−3 » et « 3 days » ne s'accordent pas
  // pareil, et le composant n'écrit aucune chaîne.
  countdownLabel: string;
  today?: boolean;
  featured?: boolean;
  onPress?: (() => void) | undefined;
  prepareLabel?: string | undefined;
  onPrepare?: (() => void) | undefined;
  markSentLabel?: string | undefined;
  onMarkSent?: (() => void) | undefined;
}

export function EventCard({
  name, what, countdownLabel, today = false, featured = false,
  onPress, prepareLabel, onPrepare, markSentLabel, onMarkSent,
}: EventCardProps) {
  const couleurs = useCouleurs();
  const s = styleDeCarteDEcheance({ couleurs, enAvant: featured });

  return (
    <View style={s.enveloppe}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${what}, ${countdownLabel}`}
        style={({ pressed }) => [s.ligne, { opacity: pressed ? 0.72 : 1 }]}
      >
        <View style={s.texte}>
          <Text style={s.nom} numberOfLines={1}>{name}</Text>
          <Text style={s.quoi} numberOfLines={1}>{what}</Text>
        </View>
        <Countdown label={countdownLabel} today={today} size="s" />
      </Pressable>

      {/* Deux actions visibles sur la plus imminente, un seul bouton plein :
          celui qui fait avancer. */}
      {s.actions && prepareLabel && markSentLabel ? (
        <View style={s.actions}>
          <Button variant="primary" full onPress={onPrepare}>{prepareLabel}</Button>
          <Button variant="text" full onPress={onMarkSent}>{markSentLabel}</Button>
        </View>
      ) : null}
    </View>
  );
}
