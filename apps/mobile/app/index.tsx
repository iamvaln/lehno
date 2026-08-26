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
  useFocusEffect(useCallback(() => {
    let vivant = true;
    setSession(null);
    litLesJetons().then((j) => { if (vivant) setSession(j !== null); });
    return () => { vivant = false; };
  }, []));

  if (session === null) return <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }} />;
  if (!session) return <Redirect href="/(connexion)" />;

  /* Le carnet, en attendant l'accueil : c'est la première surface du produit
     qui existe pour de bon. L'écran de contrôle reste joignable à la main,
     il ne se met plus sur le chemin. */
  return <Redirect href="/(app)/proches" />;
}
