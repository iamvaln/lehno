import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";
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

  useEffect(() => {
    let vivant = true;
    litLesJetons().then((j) => { if (vivant) setSession(j !== null); });
    return () => { vivant = false; };
  }, []);

  if (session === null) return <View style={{ flex: 1, backgroundColor: couleurs.surfacePage }} />;
  if (!session) return <Redirect href="/(connexion)" />;

  // Provisoire : l'écran de contrôle du socle, jusqu'à ce que l'accueil existe.
  return <Redirect href="/controle" />;
}
