import type { ReactNode } from "react";
import { Text } from "react-native";
import type { StyleProp, TextStyle } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { styleDeSurTitre } from "./SectionLabel.styles.js";

export interface SectionLabelProps {
  children: ReactNode;
  style?: StyleProp<TextStyle> | undefined;
}

export function SectionLabel({ children, style }: SectionLabelProps) {
  const couleurs = useCouleurs();
  // Un sur-titre annonce une section : le lecteur d'écran doit l'entendre
  // comme tel, pas comme une phrase de plus.
  return <Text accessibilityRole="header" style={[styleDeSurTitre(couleurs), style]}>{children}</Text>;
}
