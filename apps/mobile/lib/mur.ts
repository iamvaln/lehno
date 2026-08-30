import type { UpdateWallInput, Wall, WallInterest } from "@lehno/contracts";

/* Mon Mur — §3.10.
 *
 * DEUX MOITIÉS DISTINCTES : ce que la page MONTRE, et ce qu'elle a REÇU. Les
 * empiler ferait défiler tout un panneau de réglages pour lire un mot.
 */

/* CE QUI EST EXPOSÉ S'ENVOIE EN ENTIER, jamais par ajout ni par retrait.
 *
 * Le contrat le demande : « un patch élément par élément laisserait une case
 * décochée à l'écran rester cochée EN BASE si l'appel qui la retirait s'est
 * perdu ». Après l'appel, ce qui est public est exactement ce qu'on a envoyé.
 *
 * Un tableau VIDE est un geste légitime — « plus rien d'exposé » — et non une
 * absence de choix. C'est pourquoi on le compose toujours, même vide.
 */
export function corpsDExposition(interets: readonly WallInterest[]): UpdateWallInput {
  return { publicInterestIds: interets.filter((i) => i.isPublic).map((i) => i.id) };
}

/* Basculer un goût ne touche QUE lui, et rend la liste entière — c'est elle
   qu'on enverra. Muter la liste reçue ferait diverger l'écran de ce que le
   serveur a confirmé, le jour où l'appel échoue. */
export function basculeLInteret(
  interets: readonly WallInterest[],
  id: string,
): WallInterest[] {
  return interets.map((i) => (i.id === id ? { ...i, isPublic: !i.isPublic } : i));
}

/* L'ADRESSE SE MONTRE AVANT LA PUBLICATION, et ne se partage qu'après.
 *
 * Le contrat le dit : « l'adresse existe avant la publication — l'écran la
 * montre pour qu'on sache ce qu'on s'apprête à ouvrir ». La montrer rassure ;
 * la faire circuler avant que la page ne réponde enverrait des gens sur un
 * refus.
 */
export function peutPartager(mur: Wall): boolean {
  return mur.isEnabled;
}
