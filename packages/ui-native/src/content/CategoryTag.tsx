import { Pressable, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Icon } from "../core/Icon.js";
import { styleDeCategorie } from "./CategoryTag.styles.js";

export interface CategoryTagProps {
  // Le libellé vient du dictionnaire : la table des catégories vivait en
  // français dans le composant du design system.
  label: string;
  unclassified?: boolean;
  reclassLabel?: string | undefined;
  onReclass?: (() => void) | undefined;
}

export function CategoryTag({ label, unclassified = false, reclassLabel, onReclass }: CategoryTagProps) {
  const couleurs = useCouleurs();
  const s = styleDeCategorie({ couleurs, aClasser: unclassified, reclassable: Boolean(onReclass) });

  const pilule = (
    <View style={s.pilule}>
      <Text style={s.libelle}>{label}</Text>
      {onReclass ? <Icon name="chevron-down" size={13} strokeWidth={2} color={s.couleurIcone} /> : null}
    </View>
  );

  if (!onReclass || !s.zoneDAppui) return pilule;

  return (
    <Pressable onPress={onReclass} accessibilityRole="button" accessibilityLabel={reclassLabel} style={s.zoneDAppui}>
      {pilule}
    </Pressable>
  );
}
