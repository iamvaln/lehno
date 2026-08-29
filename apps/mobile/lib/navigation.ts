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

/* « Moi » N'EST PAS UN DRAPEAU, c'est une conséquence. Le serveur n'enverra
   jamais `moi` — l'onglet part quand ses cinq sections sont toutes fermées.
   Un onglet qui ne mène qu'à un écran vide est pire qu'un onglet absent. */
const SECTIONS_DE_MOI = ["wall", "wishlist.own", "wishes", "reservation"] as const;

export function moiVisible(actives: readonly string[]): boolean {
  return SECTIONS_DE_MOI.some((clé) => estActive(actives, clé));
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
