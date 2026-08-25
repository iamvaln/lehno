import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import type { Theme } from "@lehno/tokens";
import { couleursDuSysteme, themeDuSysteme, type Couleurs } from "./theme.js";

/* Le thème se transporte, il ne s'hérite pas.
 *
 * React Native n'a pas de cascade : une classe sur <body> n'a pas d'équivalent,
 * et chaque composant doit recevoir ses couleurs. Le contexte est la seule
 * façon de le faire sans passer une prop `nuit` de main en main sur trente-cinq
 * écrans — ce que faisait le pilote, et qui ne tient pas à cette échelle.
 *
 * Les couleurs sont mémorisées : sans cela, chaque rendu de la racine en
 * fabriquerait un objet neuf et rendrait toute l'application. */

const Contexte = createContext<{ theme: Theme; couleurs: Couleurs } | null>(null);

export function ThemeProvider({ children, choix }: { children: ReactNode; choix?: Theme }) {
  const preference = useColorScheme();
  const valeur = useMemo(
    () => ({
      theme: themeDuSysteme(preference, choix),
      couleurs: couleursDuSysteme(preference, choix),
    }),
    [preference, choix],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/* Lever plutôt que rendre un repli : un composant hors fournisseur rendrait
   avec les couleurs du thème clair sur un fond sombre, sans rien signaler. */
export function useTheme(): { theme: Theme; couleurs: Couleurs } {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error("useTheme hors de ThemeProvider");
  return valeur;
}

export function useCouleurs(): Couleurs {
  return useTheme().couleurs;
}
