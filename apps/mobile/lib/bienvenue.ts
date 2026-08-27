import type { Messages } from "../messages/index.js";
import { estActive } from "@lehno/contracts";

/* Ce que la bienvenue promet — composé de ce qui est OUVERT.
 *
 * Trois endroits du produit énumèrent des fonctionnalités en prose ; celui-ci
 * est le premier. La phrase dit ce que les crédits achètent AUJOURD'HUI, pas ce
 * que le produit saura faire un jour : citer « un portrait » quand
 * `generation.portrait` est fermé promettrait ce qu'on ne livre pas, à la
 * seconde même où quelqu'un arrive.
 *
 * Aucune nature ouverte, la phrase s'arrête au carnet. D'où deux tournures et
 * non une phrase à trous : « De quoi préparer vos premières célébrations : »
 * suivi de rien se lirait comme un défaut d'affichage.
 *
 * L'ORDRE EST CELUI DU KIT — portrait, idées, message — et pas celui des
 * drapeaux : c'est une phrase, elle se lit, et l'ordre d'une énumération est
 * une décision de langue.
 */
const NATURES = [
  { drapeau: "generation.portrait", cle: "bienvenueNaturePortrait" },
  { drapeau: "generation.ideas", cle: "bienvenueNatureIdees" },
  { drapeau: "generation.message", cle: "bienvenueNatureMessage" },
] as const;

export function phraseDeBienvenue(actives: readonly string[], t: Messages): string {
  const natures = NATURES
    .filter(({ drapeau }) => estActive(actives, drapeau))
    .map(({ cle }) => t[cle]);
  return natures.length ? t.bienvenueDeQuoi(natures.join(", ")) : t.bienvenueOuvre;
}
