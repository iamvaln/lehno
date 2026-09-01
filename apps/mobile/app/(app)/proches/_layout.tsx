import { Stack } from "expo-router";

/* LE CARNET EST UN DOSSIER, DONC IL LUI FAUT UN LAYOUT.
 *
 * Sans ce fichier, `expo-router` enregistre chaque écran du dossier comme une
 * route à part — `proches/index`, `proches/[id]`, `proches/identite`,
 * `proches/recherche` — et AUCUNE route ne s'appelle `proches`. La barre
 * d'onglets appelait donc `navigate("proches")` sur un nom qui n'existait pas :
 *
 *     The action 'NAVIGATE' with payload {"name":"proches"} was not handled
 *     by any navigator. Do you have a route named 'proches'?
 *
 * L'onglet ne s'ouvrait pas. Les quatre autres sont des FICHIERS simples, d'où
 * leur route homonyme ; seul celui-ci est un dossier, et c'est ce qui l'a
 * distingué. Aucun test ne pouvait le voir : la table des onglets est juste,
 * les quatre écrans sont justes, c'est leur assemblage qui ne l'était pas.
 *
 * En-têtes masquées : chaque écran porte déjà son titre et son retour, comme
 * partout ailleurs dans l'application.
 */
export default function CarnetLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
