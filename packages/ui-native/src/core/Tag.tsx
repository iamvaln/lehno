import type { ReactNode } from "react";
import { Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { styleDEtiquette, type TonDEtiquette } from "./Tag.styles.js";

export interface TagProps {
  children: ReactNode;
  tone?: TonDEtiquette;
  style?: StyleProp<ViewStyle> | undefined;
}

export function Tag({ children, tone = "outline", style }: TagProps) {
  const couleurs = useCouleurs();
  const s = styleDEtiquette({ couleurs, ton: tone });
  return (
    <View style={[s.conteneur, style]}>
      <Text style={s.libelle} numberOfLines={1}>{children}</Text>
    </View>
  );
}
