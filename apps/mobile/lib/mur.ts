import type { UpdateWallInput, Wall, WallInterest, ReceivedWish } from "@lehno/contracts";

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

export type EtatDuMot = "attend" | "affiche" | "garde";

/* CE QU'UN MOT REÇU DEVIENT.
 *
 * Le contrat tranche en `approved` / `rejected` ; la maquette dit « épinglé » et
 * « détaché ». C'est le même geste sous deux noms — et c'est celui de la
 * maquette qui parle à qui lit l'écran : « un mot épinglé s'affiche sur votre
 * Mur, les autres ne sortent pas d'ici ».
 *
 * `pending` n'est pas un refus : c'est un mot qu'on n'a pas encore lu. Le
 * confondre avec « gardé » ferait disparaître de la file ce qui attend une
 * décision.
 */
export function etatDuMot(mot: ReceivedWish): EtatDuMot {
  if (mot.status === "approved") return "affiche";
  if (mot.status === "rejected") return "garde";
  return "attend";
}

/* CE QUI ATTEND UNE DÉCISION D'ABORD.
 *
 * On ouvre cet écran pour trancher ce qui est arrivé, pas pour relire ce qu'on
 * a déjà rangé. Les mots en attente montent donc en tête, et le reste suit du
 * plus récent au plus ancien.
 */
export function motsARegarder(mots: readonly ReceivedWish[]): ReceivedWish[] {
  const rang = (m: ReceivedWish): number => (etatDuMot(m) === "attend" ? 0 : 1);
  return [...mots].sort(
    (a, b) => rang(a) - rang(b) || b.createdAt.localeCompare(a.createdAt),
  );
}

/* La décision inverse de l'état courant — c'est ce que le bouton propose.
   Un mot en attente s'affiche ; un mot affiché se retire. */
export function decisionInverse(mot: ReceivedWish): "approved" | "rejected" {
  return etatDuMot(mot) === "affiche" ? "rejected" : "approved";
}
