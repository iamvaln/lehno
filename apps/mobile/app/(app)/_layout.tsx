import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabBar, useCouleurs, type Onglet } from "@lehno/ui-native";
import { useLangue } from "../../lib/langue.js";

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
  const couleurs = useCouleurs();
  const insets = useSafeAreaInsets();

  /* Les onglets dont l'écran n'existe pas encore ne sont pas ici : un onglet
     qui mène à une page vide est pire qu'un onglet absent, et la règle vaut
     aussi pendant qu'on construit.

     Aucune largeur n'est figée — la barre se redistribue de trois à cinq. */
  const onglets: Onglet[] = [
    { id: "accueil", label: t.ongletAccueil, icon: "house" },
    { id: "dates", label: t.ongletDates, icon: "calendar" },
    { id: "proches", label: t.ongletProches, icon: "heart" },
    /* CINQ ONGLETS, ET AUCUN NE SUIT DE DRAPEAU.
     
       « Moi » reste au lancement, ses sections éteintes retirées : il porte le
       nom, l'adresse publique et le solde, dont rien ne s'éteint. Réglages
       porte ce qui règle le produit. La barre tient donc toujours à cinq —
       « et à cinq elle tient sans trou », dit la charte.
     
       C'est la liste elle-même qui n'a plus de condition : les écrans gouvernés
       sortent par `ecranEteint`, jamais par un onglet qu'on retire. */
    { id: "moi", label: t.ongletMoi, icon: "user" },
    { id: "reglages", label: t.ongletReglages, icon: "settings" },
  ];

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
      <Tabs.Screen name="dates" />
      <Tabs.Screen name="proches" />
      <Tabs.Screen name="moi" />
      <Tabs.Screen name="reglages" />
    </Tabs>
  );
}
