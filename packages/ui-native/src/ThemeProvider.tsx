import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import type { Theme } from "@lehno/tokens";
import {
  couleursDuSysteme,
  themeDuSysteme,
  type Couleurs,
  type PreferenceDeTheme,
} from "./theme.js";

/* Le thème se transporte, il ne s'hérite pas.
 *
 * React Native n'a pas de cascade : une classe sur <body> n'a pas d'équivalent,
 * et chaque composant doit recevoir ses couleurs. Le contexte est la seule
 * façon de le faire sans passer une prop `nuit` de main en main sur trente-cinq
 * écrans — ce que faisait le pilote, et qui ne tient pas à cette échelle.
 *
 * Les couleurs sont mémorisées : sans cela, chaque rendu de la racine en
 * fabriquerait un objet neuf et rendrait toute l'application. */

/* DEUX CHOSES QUI NE SE CONFONDENT PAS, et le contexte porte les deux.
 *
 * `theme` est celui qui S'APPLIQUE — jamais « system », toujours une des deux
 * palettes, parce qu'aucun composant ne sait peindre « système ».
 *
 * `preference` est ce qui a été RÉGLÉ, et c'est ce que le sélecteur doit
 * montrer. N'exposer que `theme` obligerait l'écran de réglages à cocher
 * « Clair » sur un compte qui suit l'appareil : le réglage semblerait alors
 * explicite, et le passage automatique au sombre le soir paraîtrait un défaut. */
const Contexte = createContext<{
  theme: Theme;
  couleurs: Couleurs;
  preference: PreferenceDeTheme;
  choisis: (preference: PreferenceDeTheme) => void;
} | null>(null);

export function ThemeProvider({
  children,
  choix,
}: {
  children: ReactNode;
  choix?: PreferenceDeTheme;
}) {
  const [choisie, choisis] = useState<PreferenceDeTheme>(choix ?? "system");
  const systeme = useColorScheme();
  const valeur = useMemo(
    () => ({
      theme: themeDuSysteme(systeme, choisie),
      couleurs: couleursDuSysteme(systeme, choisie),
      preference: choisie,
      choisis,
    }),
    /* `systeme` EST une dépendance, et pas par acquit de conscience : tant que
       la préférence vaut « system », c'est lui seul qui décide. L'omettre
       figerait l'application sur le thème qu'avait le téléphone au démarrage. */
    [systeme, choisie],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/* Lever plutôt que rendre un repli : un composant hors fournisseur rendrait
   avec les couleurs du thème clair sur un fond sombre, sans rien signaler. */
export function useTheme() {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error("useTheme hors de ThemeProvider");
  return valeur;
}

export function useCouleurs(): Couleurs {
  return useTheme().couleurs;
}
