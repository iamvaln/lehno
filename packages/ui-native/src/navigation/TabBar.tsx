import { Pressable, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Icon } from "../core/Icon.js";
import { styleDOnglets } from "./TabBar.styles.js";

export interface Onglet {
  id: string;
  // Le libellé vient du dictionnaire ; la clé est de la structure.
  label: string;
  icon: string;
}

export interface TabBarProps {
  tabs: readonly Onglet[];
  active: string;
  onSelect?: ((id: string) => void) | undefined;
  /* Le retrait du bas — encoche, poignée. Il appartient à la BARRE : un écran
     qui l'ajouterait aussi laisserait un trou blanc au-dessus du menu système. */
  insetBas?: number | undefined;
}

export function TabBar({ tabs, active, onSelect, insetBas = 0 }: TabBarProps) {
  const couleurs = useCouleurs();
  const barre = styleDOnglets({ couleurs, insetBas }).barre;

  return (
    <View style={barre} accessibilityRole="tablist">
      {tabs.map((onglet) => {
        const courant = onglet.id === active;
        const s = styleDOnglets({ couleurs, actif: courant });
        return (
          <Pressable
            key={onglet.id}
            onPress={onSelect ? () => onSelect(onglet.id) : undefined}
            accessibilityRole="tab"
            accessibilityState={{ selected: courant }}
            style={s.onglet}
          >
            <Icon name={onglet.icon} size={20} color={s.couleurIcone} />
            <Text style={s.libelle}>{onglet.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
