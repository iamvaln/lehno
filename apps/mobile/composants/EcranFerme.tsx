import { StyleSheet, View } from "react-native";
import { nativeSpace } from "@lehno/tokens";
import { EmptyState, useCouleurs } from "@lehno/ui-native";
import { useLangue } from "../lib/langue.js";

/* CE QU'ON MONTRE QUAND UN ÉCRAN GOUVERNÉ EST ATTEINT MALGRÉ TOUT.
 *
 * Une route `expo-router` s'atteint par LIEN PROFOND : la retirer de la
 * navigation ne la ferme pas. Sans cet écran, celui qui l'ouvre voit partir un
 * appel vers une route que le serveur a fermée par `@Feature`, revenir un 404,
 * et s'afficher un bandeau rouge — sur un compte parfaitement sain.
 *
 * On ne dit PAS « cette fonctionnalité est désactivée » : la configuration du
 * service ne regarde pas celui qui l'emploie, et l'annoncer ferait attendre
 * quelque chose qui n'arrivera peut-être jamais. « Cette page n'est pas là »
 * est la vérité de son point de vue.
 *
 * PARTAGÉ, et pas recopié dans neuf écrans : une phrase écrite neuf fois
 * finirait par dire neuf choses. Il n'est pas dans `@lehno/ui-native` — le kit
 * ne décrit pas cet état, il naît du portage.
 */
export function EcranFerme() {
  const { t } = useLangue();
  const couleurs = useCouleurs();
  return (
    <View style={[styles.centre, { backgroundColor: couleurs.surfacePage }]}>
      <EmptyState
        illustration="page-introuvable"
        title={t.introuvableTitre}
        text={t.introuvableTexte}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: nativeSpace[16],
  },
});
