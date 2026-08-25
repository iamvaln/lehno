import { Pressable, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Icon } from "../core/Icon.js";
import { pastilleDeCloche, styleDeCloche } from "./NotificationBell.styles.js";

export interface NotificationBellProps {
  unread?: number | undefined;
  // Le libellé vient du dictionnaire : le design system composait
  // « Notifications — N non lue / lues », accordé en français.
  label: string;
  onPress?: (() => void) | undefined;
}

export function NotificationBell({ unread = 0, label, onPress }: NotificationBellProps) {
  const couleurs = useCouleurs();
  const s = styleDeCloche(couleurs);
  const pastille = pastilleDeCloche(unread);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.bouton}>
      <Icon name="bell" size={20} color={s.couleurIcone} />
      {pastille ? (
        // Le nombre est déjà dans le libellé du bouton : le lecteur d'écran
        // l'entendrait deux fois s'il lisait aussi la pastille.
        <View style={s.pastille} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={s.nombre}>{pastille}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
