import { Text, TextInput, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { styleDeChamp } from "./TextField.styles.js";

export interface TextFieldProps {
  label?: string | undefined;
  hint?: string | undefined;
  value?: string | undefined;
  placeholder?: string | undefined;
  invalid?: boolean | undefined;
  multiline?: boolean | undefined;
  autoFocus?: boolean | undefined;
  onChangeText?: ((texte: string) => void) | undefined;
}

export function TextField({
  label, hint, value, placeholder, invalid = false, multiline = false, autoFocus, onChangeText,
}: TextFieldProps) {
  const couleurs = useCouleurs();
  const s = styleDeChamp({ couleurs, invalide: invalid, multiligne: multiline });

  return (
    <View style={s.conteneur}>
      {label ? <Text style={s.etiquette}>{label}</Text> : null}
      <TextInput
        style={s.champ}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={s.couleurIndice}
        multiline={multiline}
        autoFocus={autoFocus}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        /* React Native n'a pas d'état « invalide » — ARIA en a un, lui pas. La
           faute doit donc vivre dans le texte d'aide, et c'est pour cela qu'il
           est à la fois annoncé et rougi : sans cela, l'erreur ne se voit que
           pour qui voit le contour. */
        accessibilityHint={hint}
      />
      {hint ? <Text style={s.aide}>{hint}</Text> : null}
    </View>
  );
}
