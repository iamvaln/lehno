import type { ReactNode } from "react";
import { View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import type { NomDeRayon } from "@lehno/tokens";
import { useCouleurs } from "../ThemeProvider.js";
import { styleDeCarte, type SurfaceDeCarte } from "./Card.styles.js";

export interface CardProps {
  children: ReactNode;
  surface?: SurfaceDeCarte;
  radius?: NomDeRayon;
  padding?: number;
  style?: StyleProp<ViewStyle> | undefined;
}

export function Card({ children, surface = "card", radius = "xl", padding = 22, style }: CardProps) {
  const couleurs = useCouleurs();
  return (
    <View style={[styleDeCarte({ couleurs, surface, rayon: radius, rembourrage: padding }), style]}>
      {children}
    </View>
  );
}
