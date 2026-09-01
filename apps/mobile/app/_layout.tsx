import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OfflineBanner, ThemeProvider, useCouleurs } from "@lehno/ui-native";
import { LangueProvider } from "../lib/langue.js";
import { DrapeauxProvider } from "../lib/DrapeauxProvider.js";
import { MetadonneesProvider } from "../lib/MetadonneesProvider.js";
import { ArretProvider, useArret } from "../lib/ArretProvider.js";
import { PousseeProvider } from "../lib/PousseeProvider.js";
import { ReseauProvider, useReseau } from "../lib/ReseauProvider.js";
import { messageDuBandeau } from "../lib/file.js";
import { useLangue } from "../lib/langue.js";
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

/* LE BANDEAU SE POSE AU-DESSUS DE LA ZONE SÛRE, pas dans un écran.
 *
 * Dans un écran, il faudrait le recopier quarante fois — et il manquerait
 * précisément là où on aurait oublié. Au-dessus de la pile, il tient quel que
 * soit l'écran, y compris pendant une navigation.
 *
 * Il ne recouvre RIEN : il pousse le contenu vers le bas. Un bandeau flottant
 * masquerait une ligne de liste, et c'est la ligne du haut — celle qu'on
 * regarde. */
function BandeauReseau() {
  const { horsLigne, enAttente } = useReseau();
  const { t } = useLangue();
  if (!horsLigne) return null;
  return (
    <OfflineBanner
      message={messageDuBandeau(enAttente, t.horsConnexion, t.horsConnexionFile)}
    />
  );
}

function Coquille() {
  const couleurs = useCouleurs();
  return (
    <>
      <StatusBar style="auto" />
      <BandeauReseau />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: couleurs.surfacePage },
        }}
      >
        {/* CE QUI POUSSE, ET CE QUI MONTE — décisions natives, §1.
            Une SAISIE qui revient d'où elle vient monte en feuille : elle
            s'écrit à propos de ce qu'on a sous les yeux, la feuille laisse voir
            l'écran derrière, et le geste qui la ferme est celui qui l'annule.
            Une DESTINATION, elle, remplace ce qu'on regardait.

            La note et l'ajout d'une date sont des saisies. Elles vivent donc
            au-dessus des onglets, pas dedans : un onglet les rendrait
            atteignables sans qu'on ait rien à écrire. */}
        <Stack.Screen
          name="note"
          options={{ presentation: "transparentModal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="evenement"
          options={{ presentation: "transparentModal", animation: "slide_from_bottom" }}
        />
      </Stack>
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
          {/* Le réseau enveloppe l'arrêt : sans lui, une application ouverte
              hors connexion interrogerait `/public/maintenance` en boucle et
              conclurait à une intervention là où il n'y a qu'un tunnel. Les
              deux états se ressemblent et ne se disent pas pareil. */}
          <ReseauProvider>
            <ArretProvider>
            <DrapeauxProvider>
              {/* Les listes de valeurs et leur SENS : ce qu'aucune énumération
                  ne porte. Elles se lisent une fois, après la connexion. */}
              {/* LES NOTIFICATIONS POUSSÉES sont DEDANS, tout au fond : elles
                  n'affichent rien et ne gouvernent rien — elles ont seulement
                  besoin d'une session, et cet endroit est le plus profond où
                  elle est établie. Les poser plus haut les ferait s'initialiser
                  pendant un arrêt pour intervention, où rien ne peut aboutir. */}
              <PousseeProvider>
                <MetadonneesProvider>
                <SousArret />
                </MetadonneesProvider>
              </PousseeProvider>
            </DrapeauxProvider>
            </ArretProvider>
          </ReseauProvider>
        </LangueProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
