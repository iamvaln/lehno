import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useCouleurs } from "@lehno/ui-native";
import { LangueProvider } from "../lib/langue.js";
import { DrapeauxProvider } from "../lib/DrapeauxProvider.js";
import { MetadonneesProvider } from "../lib/MetadonneesProvider.js";
import { ArretProvider, useArret } from "../lib/ArretProvider.js";
import Maintenance from "./maintenance.js";
import { POLICES } from "../polices/index.js";

/* La coquille. Trois choses s'y posent, et l'ordre compte : la zone sûre doit
   envelopper le thème, qui doit envelopper la navigation — sinon un écran lit
   des couleurs ou des marges qui ne sont pas encore là.

   Les polices se chargent avant tout rendu. Rendre pendant le chargement
   montrerait un premier écran dans la police système, puis un saut : c'est le
   défaut le plus visible d'une application qui porte une identité. */
/* L'écran d'attente REMPLACE l'application, il ne s'y superpose pas : ni
   en-tête, ni barre d'onglets. Et il ne déconnecte personne — un arrêt n'est
   pas une invalidation de session, on reprend où l'on était. */
function SousArret() {
  const { enCours } = useArret();
  return enCours ? <Maintenance /> : <Coquille />;
}

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
          {/* Les drapeaux enveloppent la navigation : un écran qui se monte
              avant eux montrerait ce que le serveur refuse. Sans session, la
              liste vient de `/public/features` : le parcours d'entrée a la
              sienne, il n'appelle pas un chemin authentifié pour rien. */}
          {/* L'arrêt enveloppe TOUT, drapeaux compris : pendant une
              intervention, /auth/* et /public/config répondent 503 eux aussi.
              Un écran d'attente posé seulement après la connexion laisserait
              quelqu'un devant un formulaire qui échoue sans dire pourquoi. */}
          <ArretProvider>
            <DrapeauxProvider>
              {/* Les listes de valeurs et leur SENS : ce qu'aucune énumération
                  ne porte. Elles se lisent une fois, après la connexion. */}
              <MetadonneesProvider>
                <SousArret />
              </MetadonneesProvider>
            </DrapeauxProvider>
          </ArretProvider>
        </LangueProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
