import { Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { styleDeDecompte, type TailleDeDecompte } from "./Countdown.styles.js";

export interface CountdownProps {
  // Le libellé vient du dictionnaire : « J−3 » ou « 3 days » ne s'accordent pas
  // pareil, et le zéro prend le singulier en français, le pluriel en anglais.
  label: string;
  today?: boolean;
  size?: TailleDeDecompte;
}

export function Countdown({ label, today = false, size = "m" }: CountdownProps) {
  const couleurs = useCouleurs();
  const s = styleDeDecompte({ couleurs, jourMeme: today, taille: size });

  if (s.pilule) {
    return (
      <View style={s.pilule}>
        <Text style={s.texte}>{label}</Text>
      </View>
    );
  }
  return <Text style={s.texte} numberOfLines={1}>{label}</Text>;
}
