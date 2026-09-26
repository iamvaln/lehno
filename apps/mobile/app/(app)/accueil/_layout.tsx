import { Stack } from "expo-router";

/* UN ONGLET EST UNE PILE, et sans ce fichier il n'en est pas une.
 *
 * Tant que cet onglet fut un FICHIER, tout écran ouvert depuis lui se posait à
 * côté de lui dans le navigateur d'onglets — expo-router enregistre comme
 * onglet tout ce que contient le dossier du layout, déclaré ou non. Vingt-quatre
 * écrans étaient ainsi des onglets sans qu'on l'ait voulu, invisibles seulement
 * parce que notre `TabBar` dessine une liste fixe de cinq.
 *
 * Deux conséquences, vues à l'appareil et toutes deux muettes :
 *
 * — `back()` n'y dépilait rien. Sur un navigateur d'onglets il applique
 *   `backBehavior`, dont le défaut est `firstRoute` : le retour ramenait donc
 *   TOUJOURS à l'accueil, depuis les réglages comme depuis « Moi ».
 * — un onglet ne se démonte pas, donc aucun de ces écrans ne remettait jamais
 *   son état à zéro. La fermeture de compte rouvrait au troisième temps, code
 *   déjà demandé, sans autre moyen de recommencer que de tuer l'application.
 *
 * Rien n'échouait, la barre paraissait juste, et aucun test ne pouvait le voir :
 * la table des onglets était juste, les écrans étaient justes — c'est leur
 * assemblage qui ne l'était pas.
 *
 * En-têtes masquées : chaque écran porte déjà son titre et son retour.
 */
export default function PileDOnglet() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
