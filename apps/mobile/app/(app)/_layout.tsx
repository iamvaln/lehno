import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBar, useCouleurs, type Onglet } from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";
import { useDrapeaux } from "../../lib/DrapeauxProvider.js";
import { moiVisible } from "../../lib/navigation.js";

/* L'application connectée, et sa barre.
 *
 * `Tabs` d'expo-router pour le routage ; notre `TabBar` pour le dessin. Le
 * routage est un problème résolu, l'aplat sous l'onglet ouvert ne l'est pas :
 * la couleur seule est un signal faible à 11 px, et invisible pour qui ne la
 * distingue pas.
 *
 * PAS D'EN-TÊTE NATIF. Les écrans portent leur propre titre — la fiche écrit le
 * nom en grand, la barre reste nue.
 *
 * LA BARRE PORTE L'INSET DU BAS, et les écrans ne l'ajoutent pas : deux insets
 * additionnés donnent le trou blanc au-dessus du menu système.
 */
export default function Application() {
  const { t } = useLangue();
  const { actives } = useDrapeaux();
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();

  /* « Moi » n'est pas un drapeau, c'est une conséquence — l'onglet part quand
     ses cinq sections sont fermées, ce qui est le cas au lancement. La barre
     passe alors à quatre, et se redistribue : aucune largeur figée.

     Les onglets dont l'écran n'existe pas encore ne sont pas ici. Un onglet qui
     mène à une page vide est pire qu'un onglet absent — c'est la règle du
     handoff, et elle vaut aussi pendant qu'on construit. */
  const onglets: Onglet[] = [
    { id: "accueil", label: t.ongletAccueil, icon: "house" },
    { id: "proches", label: t.ongletProches, icon: "heart" },
  ];
  if (moiVisible(actives)) {
    // Réservé : l'écran arrivera avec son lot. La règle est écrite ici pour
    // qu'elle ne s'invente pas ailleurs.
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: couleurs.surfacePage },
      }}
      tabBar={({ state, navigation }) => (
        <TabBar
          tabs={onglets}
          active={state.routeNames[state.index] ?? "accueil"}
          onSelect={(id) => navigation.navigate(id)}
          insetBas={insets.bottom}
        />
      )}
    >
      <Tabs.Screen name="accueil" />
      <Tabs.Screen name="proches" />
    </Tabs>
  );
}
