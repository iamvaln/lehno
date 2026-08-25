import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useCouleurs } from "@lehno/ui-native";
import { LangueProvider } from "../lib/langue.js";
import { POLICES } from "../polices/index.js";

/* La coquille. Trois choses s'y posent, et l'ordre compte : la zone sûre doit
   envelopper le thème, qui doit envelopper la navigation — sinon un écran lit
   des couleurs ou des marges qui ne sont pas encore là.

   Les polices se chargent avant tout rendu. Rendre pendant le chargement
   montrerait un premier écran dans la police système, puis un saut : c'est le
   défaut le plus visible d'une application qui porte une identité. */
function Coquille() {
  const couleurs = useCouleurs();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: couleurs.surfacePage },
        }}
      />
    </>
  );
}

export default function Racine() {
  const [pretes] = useFonts(POLICES);
  if (!pretes) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* La langue enveloppe la navigation : un écran qui se monte avant elle
            afficherait « undefined » à chaque libellé. */}
        <LangueProvider>
          <Coquille />
        </LangueProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
