import { Stack } from "expo-router";
import { useCouleurs } from "@lehno/ui-native";

/* La pile d'entrée, hors des onglets : pendant la connexion il n'y a pas
   d'onglets à montrer — on n'a pas encore de compte à naviguer.

   L'en-tête est masqué : chaque écran porte son propre retour, et la spec veut
   un chevron à 44 points, pas une barre système. */
export default function CoquilleDeConnexion() {
  const couleurs = useCouleurs();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: couleurs.surfacePage },
        // L'ouverture ne se revient pas : une fois passée, le geste de retour
        // ne doit pas rejouer l'animation.
        gestureEnabled: false,
      }}
    />
  );
}
