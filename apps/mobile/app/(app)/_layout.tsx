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
    { id: "dates", label: t.ongletDates, icon: "calendar" },
    { id: "proches", label: t.ongletProches, icon: "heart" },
    /* RÉGLAGES NE SUIT AUCUN DRAPEAU, et c'est tout l'intérêt. Il porte ce que
       la disparition de « Moi » emportait — le solde, le profil, la sécurité,
       et se déconnecter : rien de tout cela n'est une fonctionnalité qu'on
       allume. C'est le quatrième onglet du lancement, celui qui rend la barre
       complète quand « Moi » n'est pas là. */
    { id: "reglages", label: t.ongletReglages, icon: "settings" },
  ];
  /* « MOI » RESTE AU LANCEMENT — décidé le 29/08 — et son onglet arrive avec
     son écran, pas avant : un onglet qui ne mène nulle part est exactement le
     geste muet qu'on refuse partout ailleurs.

     Il attend §3.9 : Moi porte « Recharger » et le parrainage, et les poser
     sans destination ferait deux impasses sur l'écran qu'on ouvre le plus
     souvent. D'ici là, c'est le hub des Réglages qui porte le solde — sans
     quoi il ne serait atteignable nulle part. */
  if (moiVisible(actives)) {
    // Réservé.
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
      <Tabs.Screen name="dates" />
      <Tabs.Screen name="proches" />
      <Tabs.Screen name="reglages" />
    </Tabs>
  );
}
