import { Image, Text, View } from "react-native";
import { useCouleurs } from "../ThemeProvider.js";
import { initiale, styleDAvatar } from "./Avatar.styles.js";

export interface AvatarProps {
  name?: string;
  source?: string;
  size?: number;
}

export function Avatar({ name = "", source, size = 48 }: AvatarProps) {
  const couleurs = useCouleurs();
  const s = styleDAvatar({ couleurs, taille: size });

  if (source) {
    return (
      <Image
        source={{ uri: source }}
        style={s.conteneur}
        // Le lecteur d'écran annonce la personne, pas « image ».
        accessibilityLabel={name}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={s.conteneur} accessibilityLabel={name}>
      <Text style={s.initiale}>{initiale(name)}</Text>
    </View>
  );
}
