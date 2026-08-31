import { estActive } from "@lehno/contracts";

/* Ce que les drapeaux font à la NAVIGATION.
 *
 * Deux règles, et elles se CALCULENT — jamais une liste tenue à la main. Le
 * handoff insiste : « deux listes finissent par diverger ». Celle du serveur
 * fermerait un chemin que la nôtre laisserait ouvert, et le geste mènerait à un
 * mur.
 *
 * Transposé de `ecranEteint` et `moiVisible` du prototype, qui les calcule de
 * la même façon pour la même raison.
 */

/* « MOI » RESTE, MÊME QUAND SES SECTIONS FERMENT — décidé le 29/08.
 *
 * Il a d'abord été calculé comme une conséquence : l'onglet partait quand
 * `wall`, `wishlist.own`, `wishes` et `reservation` étaient tous éteints, au
 * motif qu'un onglet menant à un écran vide est pire qu'un onglet absent.
 *
 * Le raisonnement était juste et la prémisse fausse. Moi ne porte pas QUE ces
 * quatre sections : il porte le SOLDE, la recharge et le parrainage, qui ne
 * suivent aucun drapeau. Au lancement — les quatre éteintes — l'onglet partait
 * donc avec eux, et le seul chemin restant vers son solde passait par l'écran
 * de préparation d'un message, via un lien qu'il fallait remarquer.
 *
 * Moi n'est donc jamais vide : il garde son socle et perd ses sections. C'est
 * ce qui distingue un onglet dont le CONTENU varie d'un onglet dont
 * l'EXISTENCE dépend d'un drapeau — les autres écrans gouvernés, eux, sortent
 * toujours de la navigation.
 */
export function moiVisible(_actives: readonly string[]): boolean {
  return true;
}

/* Les sections de Moi qui, elles, suivent leurs drapeaux. L'écran les demande
   pour savoir ce qu'il montre SOUS le socle. */
const SECTIONS_DE_MOI = ["wall", "wishlist.own", "wishes", "reservation"] as const;

export function sectionsDeMoi(actives: readonly string[]): string[] {
  return SECTIONS_DE_MOI.filter((clé) => estActive(actives, clé));
}

/* §3.7 s'ouvre dès qu'UNE des deux natures qu'il propose tient, et chaque piste
   paraît pour son compte. Les trois natures de génération sont trois drapeaux,
   pas un interrupteur : au lancement le message est allumé et les idées non,
   et c'est le cas NOMINAL, pas une variante. */
export function preparationOuverte(actives: readonly string[]): boolean {
  return estActive(actives, "generation.message") || estActive(actives, "generation.ideas");
}

/* Un écran gouverné par un drapeau éteint N'EXISTE PAS : il sort de la
   navigation, et rien n'y mène — pas de bouton grisé, pas de renvoi vers un
   écran vide. Le lien disparaît avec sa destination. */
export function ecranEteint(id: string, actives: readonly string[]): boolean {
  const ouvert = (clé: string): boolean => estActive(actives, clé);
  switch (id) {
    case "souhait": return !ouvert("wishlist");
    case "listes": return !ouvert("wishlist.own");
    case "monmur": return !ouvert("wall");
    case "reservations": return !ouvert("reservation");
    case "valider": case "collecte": return !ouvert("collect");
    case "preparation": case "generation": return !preparationOuverte(actives);
    case "cadrage": return !ouvert("generation.ideas");
    case "portrait": case "studio": return !ouvert("generation.portrait");
    // Les reprises couvrent les trois natures : elles tiennent tant qu'une
    // seule production est possible, message, idées ou portrait.
    case "reprises": return !(preparationOuverte(actives) || ouvert("generation.portrait"));
    case "parrainage": return !ouvert("referral");
    case "paiement": return !ouvert("topup.provider");
    case "moi": return !moiVisible(actives);
    // Tout le reste est du socle. Il ne s'éteint jamais, et le dire par un
    // défaut plutôt que par une liste évite d'oublier un écran neuf.
    default: return false;
  }
}
