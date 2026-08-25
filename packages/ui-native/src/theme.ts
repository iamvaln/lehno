import { nativeColors, type SemanticRole } from "@lehno/tokens";
import type { Theme } from "@lehno/tokens";

/* Ce que useColorScheme rend quand le système ne s'est pas prononcé a changé de
   forme : jusqu'à React Native 0.85 c'était `null`, depuis la 0.86 c'est la
   chaîne « unspecified ». Les deux sont acceptées — le type le dit, plutôt que
   de laisser une montée de version transformer l'absence de préférence en
   valeur inattendue qui traverserait silencieusement. */
export type PreferenceSysteme = "light" | "dark" | "unspecified" | null | undefined;

export type Couleurs = Record<SemanticRole, string>;

/* Le thème se transporte, il ne s'hérite pas : RN n'a pas de cascade, donc une
   classe sur body n'a pas d'équivalent. Cette fonction est le seul endroit où
   se décide lequel des deux s'applique.

   Un choix explicite l'emporte sur le système. La charte porte les deux thèmes
   pour de bon, et quelqu'un peut vouloir l'un des deux quoi que dise l'appareil. */
export function themeDuSysteme(preference: PreferenceSysteme, choix?: Theme): Theme {
  if (choix) return choix;
  return preference === "dark" ? "dark" : "light";
}

export function couleursDuSysteme(preference: PreferenceSysteme, choix?: Theme): Couleurs {
  return nativeColors(themeDuSysteme(preference, choix));
}
