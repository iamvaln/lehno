import { BOITE, type RoleDIllustration } from "./Illustration.data.js";
import type { Couleurs } from "../theme.js";

/* Les trois rôles que les tracés nomment, résolus depuis le thème. Le sombre
   les rejoue plutôt que de les inverser : la masse s'éclaircit, la forme
   s'assombrit, et l'accent chaud ne bouge pas — l'abricot est le même partout
   où il paraît. */
export function couleursDIllustration(couleurs: Couleurs): Record<RoleDIllustration, string> {
  return {
    mass: couleurs.illusMass,
    form: couleurs.illusForm,
    warm: couleurs.illusWarm,
  };
}

// La boîte fait 200 × 160 : la hauteur suit la largeur demandée, sinon
// l'illustration se déforme.
export function hauteurDIllustration(largeur: number): number {
  return largeur * (BOITE.hauteur / BOITE.largeur);
}
