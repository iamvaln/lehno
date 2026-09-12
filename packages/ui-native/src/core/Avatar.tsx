import { Image, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { initiale, styleDAvatar } from "./Avatar.styles.js";

export interface AvatarProps {
  name?: string;
  source?: string | undefined;
  size?: number;
}

export function Avatar({ name = "", source, size = 48 }: AvatarProps) {
  const couleurs = useCouleurs();
  const s = styleDAvatar({ couleurs, taille: size });

  /* L'AVATAR EST DÉCORATIF, et il faut le dire au lecteur d'écran.
   *
   * Il portait une étiquette d'accessibilité valant le nom — « le lecteur
   * annonce la personne, pas image ». L'intention était juste, l'effet non :
   * dans les DIX endroits
   * où cet avatar paraît, le nom est ÉCRIT juste à côté. Le rang du carnet
   * s'annonçait donc « Awa, Awa, rien de noté encore, compléter ».
   *
   * Vu dans la hiérarchie d'accessibilité, pas deviné.
   *
   * Le masquer plutôt que de lui retirer son étiquette : sans cela, l'initiale
   * qu'il dessine — « A » — se lirait à sa place, ce qui est pire qu'un
   * doublon. Le jour où un avatar paraîtra SANS son nom à côté, c'est ce
   * commentaire qu'il faudra contredire, en connaissance de cause. */
  const invisibleAuLecteur = {
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants" as const,
  };

  if (source) {
    return (
      <Image
        source={{ uri: source }}
        style={s.conteneur}
        {...invisibleAuLecteur}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={s.conteneur} {...invisibleAuLecteur}>
      <Text style={s.initiale}>{initiale(name)}</Text>
    </View>
  );
}
