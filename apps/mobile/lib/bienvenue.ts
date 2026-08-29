import type { Messages } from "../messages/index.js";
import { estActive } from "@lehno/contracts";
import type { REFERRAL_OUTCOMES } from "@lehno/contracts";

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


/* CE QUE LE COMPTE A REÇU — une ligne par geste, jamais un total.
 *
 * Trois gestes, et ils ne se valent pas. Le cadeau de bienvenue vient à tout le
 * monde. La liste d'attente se MÉRITAIT : il fallait s'y inscrire, et un total
 * effacerait cette raison. Le parrainage se mérite autrement — quelqu'un a
 * donné son code.
 *
 * Le cas du lancement en porte DEUX : ceux qui recevront le courrier
 * d'ouverture attendaient. Ce n'est pas un cas limite, c'est l'état le plus
 * fréquent des premiers jours.
 *
 * AUCUNE LIGNE À VIDE. Un cadeau nul n'a pas de ligne, un parrainage absent
 * n'a pas de bloc, et l'écran ne garde pas la place de ce qui n'existe pas.
 */
export interface LigneDeBienvenue {
  cle: "cadeau" | "attente" | "parrain";
  libelle: string;
  valeur: string;
  /* L'accent porte le geste qui se mérite. Le sourd porte celui qui n'a pas
     abouti — il se CONSTATE, il ne s'alarme pas. */
  accent?: boolean;
  sourd?: boolean;
}

export interface ParrainageRecu {
  outcome: (typeof REFERRAL_OUTCOMES)[number];
  bonusCredits: number;
}

/* Le parrainage a TROIS issues, et deux n'empêchent rien : un code inconnu ou
   son propre code laissent le compte se créer. La ligne le constate en gris
   sourd — pas de bandeau d'erreur pour un bonus qui n'arrive pas. Alarmer
   quelqu'un sur un compte qui vient de se créer serait lui apprendre à
   s'inquiéter de ce qui a marché. */
function ligneDeParrainage(
  parrainage: ParrainageRecu | null, ouvert: boolean, t: Messages,
): LigneDeBienvenue | null {
  if (!ouvert || !parrainage) return null;
  switch (parrainage.outcome) {
    case "credited":
      return parrainage.bonusCredits
        ? { cle: "parrain", libelle: t.bienvenueParrainage,
            valeur: t.bienvenueCredits(parrainage.bonusCredits), accent: true }
        : null;
    case "unknown":
      return { cle: "parrain", libelle: t.bienvenueParrainageInconnu,
               valeur: t.bienvenueParrainageInconnuVal, sourd: true };
    case "self":
      return { cle: "parrain", libelle: t.bienvenueParrainageSoi,
               valeur: t.bienvenueParrainageSoiVal, sourd: true };
    // Une issue que cette version ne connaît pas ne s'invente pas de ligne :
    // mieux vaut n'en montrer aucune qu'en montrer une fausse.
    default:
      return null;
  }
}

export function lignesDeBienvenue(
  { cadeau, attente, parrainage }: {
    cadeau: number; attente: number; parrainage: ParrainageRecu | null;
  },
  actives: readonly string[],
  t: Messages,
): LigneDeBienvenue[] {
  const ouvert = estActive(actives, "referral");
  return [
    cadeau ? { cle: "cadeau" as const, libelle: t.bienvenueCadeau, valeur: t.bienvenueCredits(cadeau) } : null,
    attente ? { cle: "attente" as const, libelle: t.bienvenueAttente, valeur: t.bienvenueCredits(attente) } : null,
    ligneDeParrainage(parrainage, ouvert, t),
  ].filter((l): l is LigneDeBienvenue => l !== null);
}

/* La phrase qui accompagne un bonus manqué. Elle ne paraît qu'avec lui : sans
   parrainage, il n'y a rien à expliquer. */
export function expliqueLeBonusManque(lignes: readonly LigneDeBienvenue[]): boolean {
  return lignes.some((l) => l.cle === "parrain" && l.sourd === true);
}
