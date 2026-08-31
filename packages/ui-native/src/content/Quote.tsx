import { Text } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { meriteDesGuillemets, styleDeCitation } from "./Quote.styles.js";

export interface QuoteProps {
  children: string;
  // Les guillemets sont de la copy : « … » à la française avec ses espaces
  // insécables, " " à l'anglaise. Ils viennent du dictionnaire.
  marks?: readonly [string, string] | undefined;
  quoted?: boolean | undefined;
  size?: number;
  tone?: "body" | "muted";
}

export function Quote({ children, marks, quoted, size = 16, tone = "body" }: QuoteProps) {
  const couleurs = useCouleurs();
  const avec = marks != null && meriteDesGuillemets(children, quoted);
  return (
    <Text style={styleDeCitation({ couleurs, taille: size, ton: tone })}>
      {avec ? marks[0] : ""}{children}{avec ? marks[1] : ""}
    </Text>
  );
}
