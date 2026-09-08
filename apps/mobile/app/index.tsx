import { useCallback, useState } from "react";
import { View } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { useCouleurs } from "@lehno/ui-native";
import { litLesJetons } from "../lib/jetons.js";

/* La porte. Elle ne montre rien : elle regarde s'il y a une session et envoie
 * où il faut. L'accueil viendra la remplacer au lot des onglets.
 *
 * Rien ne s'affiche pendant la lecture du trousseau — elle prend quelques
 * millisecondes, et faire clignoter un écran d'attente pour cela coûterait plus
 * que d'attendre.
 */
export default function Porte() {
  const couleurs = useCouleurs();
  const [session, setSession] = useState<boolean | null>(null);

  /* À CHAQUE FOIS qu'elle reprend la main, pas seulement au montage.
     La porte est la première route de la pile : elle reste montée pendant tout
     le parcours d'entrée. Une lecture au montage seul lui laissait sa réponse
     d'alors — « pas de session » — et le `replace("/")` de l'écran de bienvenue
     retombait aussitôt sur la connexion, compte créé et jetons en poche. */
  /* ON OUBLIE EN PARTANT, PAS EN REVENANT — et c'est toute la correction.
   *
   * Remettre `session` à `null` DANS l'effet de focus arrive trop tard :
   * l'effet s'exécute APRÈS le rendu, et ce rendu-là emploie encore la réponse
   * de la fois d'avant. Au retour de l'inscription, cette réponse est « pas de
   * session » — celle du démarrage, avant que le compte existe. La porte
   * émettait donc son `<Redirect>` vers la connexion et partait AVANT que la
   * lecture du trousseau n'aboutisse : compte créé, jetons en poche, et l'on
   * se retrouvait devant le formulaire de connexion.
   *
   * En oubliant au moment de PERDRE le focus, la porte ne peut plus rendre
   * qu'avec une réponse fraîche ou avec `null` — l'écran d'attente, qui ne
   * redirige nulle part. */
  useFocusEffect(useCallback(() => {
    let vivant = true;
    litLesJetons().then((j) => { if (vivant) setSession(j !== null); });
    return () => { vivant = false; setSession(null); };
  }, []));

  if (session === null) return <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }} />;
  if (!session) return <Redirect href="/(connexion)" />;

  // La coquille, et l'accueil qui l'ouvre. La porte ne connaît qu'elle : quels
  // onglets s'y montrent est une affaire de drapeaux, décidée là-bas.
  return <Redirect href="/(app)/accueil" />;
}
