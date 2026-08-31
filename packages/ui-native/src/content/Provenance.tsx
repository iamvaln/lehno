import { Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Icon } from "../core/Icon.js";
import { ligneDeProvenance, styleDeProvenance } from "./Provenance.styles.js";

export interface ProvenanceProps {
  origin?: string | null | undefined;
  date?: string | null | undefined;
}

export function Provenance({ origin, date }: ProvenanceProps) {
  const couleurs = useCouleurs();
  const ligne = ligneDeProvenance([origin, date]);
  // Rien à dire, rien à afficher : un filet seul serait un trait sans raison.
  if (!ligne) return null;

  const s = styleDeProvenance(couleurs);
  return (
    <View style={s.conteneur}>
      <Icon name="corner-up-left" size={13} strokeWidth={2} color={couleurs.textMention} />
      <Text style={s.texte}>{ligne}</Text>
    </View>
  );
}
