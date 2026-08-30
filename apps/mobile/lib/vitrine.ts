import { estActive, type MyReservation, type Wall, type WishLink } from "@lehno/contracts";

/* Les surfaces publiques de « Moi » — §3.17.
 *
 * DEUX GROUPES, et ils ne se lisent pas de la même façon : ce qu'on MONTRE de
 * soi, et ce qui en REVIENT. Le premier se règle, le second s'attend.
 *
 * Chacune suit son drapeau, et toutes sont éteintes au lancement — l'onglet se
 * réduit alors à son socle, ce qui est le cas nominal et non une variante
 * appauvrie.
 */

/* Un titre de section sans contenu annonce ce qui ne vient pas : les deux
   groupes disparaissent entiers quand aucune de leurs surfaces ne tient. */
export function montreLaVitrine(actives: readonly string[]): boolean {
  return ["wall", "wishlist.own", "wishes"].some((c) => estActive(actives, c));
}

export function montreCeQuiRevient(actives: readonly string[]): boolean {
  return ["wishes", "reservation"].some((c) => estActive(actives, c));
}

export type EtatDuMur = "publie" | "prive";

/* PUBLIÉ OU PRIVÉ, et rien entre les deux. `isEnabled` est la seule vérité :
   un mur qui a une adresse mais reste éteint n'est pas « à moitié public », il
   est privé — et l'annoncer autrement ferait croire à quelqu'un que ses dates
   circulent. */
export function etatDuMur(mur: Wall): EtatDuMur {
  return mur.isEnabled ? "publie" : "prive";
}

/* L'ADRESSE NE SE PARTAGE QUE SI LE MUR EST OUVERT. `publicUrl` existe même
   éteint — c'est l'adresse qu'il AURA — et la proposer alors enverrait des gens
   sur une page qui refuse de répondre. */
export function adresseAPartager(mur: Wall): string | null {
  return mur.isEnabled ? mur.publicUrl : null;
}

export type EtatDuLien = "ouvert" | "ferme";

/* LE LIEN DE VŒUX SE FERME TOUT SEUL, à une date.
 *
 * `closesOn` est une date civile, pas un instant : elle se compare au jour
 * courant, pas à l'heure. Comparer des instants fermerait le lien à minuit
 * pile pour qui vit à l'ouest, alors que la journée n'y est pas finie.
 *
 * Le jour de fermeture est INCLUS — on peut encore écrire ce jour-là. « Jusqu'au
 * 3 septembre » qui se fermerait le 3 au matin serait une promesse rompue d'un
 * jour, et c'est le genre d'écart qu'on ne pardonne pas sur un anniversaire.
 */
export function etatDuLien(lien: WishLink, aujourdhui: string): EtatDuLien {
  return lien.closesOn >= aujourdhui ? "ouvert" : "ferme";
}

/* CE QUI ATTEND VRAIMENT UNE RÉPONSE.
 *
 * Une réservation retirée par son auteur n'attend plus rien. Le décompte annoncé
 * ne compte donc pas ce qui a été rendu — sinon la ligne promettrait des cadeaux
 * qui ne viendront pas, et le jour venu il en manquerait.
 *
 * Le contrat ne porte pas d'état de retrait sur `myReservationSchema` :
 * `confirmedAt` marque une réservation tenue, et toutes celles qui sont servies
 * le sont. On compte donc tout ce qui arrive — la fonction existe pour porter
 * cette lecture à un seul endroit, et pour changer le jour où un retrait se
 * dira.
 */
export function reservationsQuiTiennent(
  reservations: readonly MyReservation[],
): MyReservation[] {
  return [...reservations].sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
}
