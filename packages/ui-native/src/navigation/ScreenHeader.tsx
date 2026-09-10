import { Pressable, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { Icon } from "../core/Icon.js";
import { styleDEntete } from "./ScreenHeader.styles.js";

export interface ScreenHeaderProps {
  /* LE NOM DE L'ÉCRAN, obligatoire. C'est toute la raison d'être du composant :
     un en-tête sans nom est la flèche seule, et c'est précisément ce que huit
     écrans dessinaient déjà à la main. */
  titre: string;
  /** Le libellé du bouton de retour, accordé par le dictionnaire. */
  retour: string;
  onRetour?: (() => void) | undefined;
  /* Ce qui se pose à droite — la cloche, le plus souvent. Le composant ne la
     charge pas lui-même : elle a besoin d'un compteur et d'une destination que
     seul l'écran connaît. */
  fin?: React.ReactNode | undefined;
}

export function ScreenHeader({ titre, retour, onRetour, fin }: ScreenHeaderProps) {
  const couleurs = useCouleurs();
  const s = styleDEntete(couleurs);

  return (
    <View style={s.rangee}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={retour}
        onPress={onRetour}
        style={s.retour}
      >
        <Icon name="chevron-left" size={22} color={couleurs.textBody} />
      </Pressable>
      {/* `header` plutôt que rien : c'est le repère par lequel un lecteur
          d'écran saute d'une section à l'autre, et l'écran n'en avait aucun. */}
      <Text style={s.titre} numberOfLines={1} accessibilityRole="header">{titre}</Text>
      {fin ?? null}
    </View>
  );
}
