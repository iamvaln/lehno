import { estActive } from "@lehno/contracts";
import type {
  ReceivedWish, UpdateWallInput, Wall, WallInterest,
} from "@lehno/contracts";

/* Mon Mur — §3.10.
 *
 * DEUX MOITIÉS DISTINCTES : ce que la page MONTRE, et ce qu'elle a REÇU. Les
 * empiler ferait défiler tout un panneau de réglages pour lire un mot.
 */

// ── Les deux moitiés, et l'onglet qui les sépare ────────────────────────────

export type OngletDuMur = "page" | "mots";

/* LES MOTS SUIVENT `wishes`, PAS `wall`.
 *
 * `GET /me/received-wishes` est gardé par `@Feature("wishes")` : demandé avec
 * le drapeau éteint, il rend un refus qu'on afficherait comme une panne — sur
 * un compte parfaitement sain. Un onglet qui mène à une erreur est pire qu'un
 * onglet absent, donc il n'existe pas. L'écran, lui, reste ouvert : il est
 * gouverné par `wall`, et régler sa page n'a rien à voir avec en recevoir des
 * mots.
 */
export function ongletsDuMur(actives: readonly string[]): OngletDuMur[] {
  return estActive(actives, "wishes") ? ["page", "mots"] : ["page"];
}

/* CE QUE LA NAVIGATION DEMANDE N'EST PAS CE QU'ON OUVRE.
 *
 * Les routes d'expo-router s'atteignent par LIEN PROFOND : `…/monmur?onglet=`
 * accepte n'importe quoi, y compris un tableau — un paramètre répété en rend
 * un. On ne lui fait donc pas plus confiance qu'à un corps de requête : tout
 * ce qui n'est pas un onglet OUVERT retombe sur « page », qui existe toujours.
 *
 * Le drapeau entre dans le calcul pour une seconde raison : la liste des
 * actives arrive de façon asynchrone. Résoudre l'onglet UNE fois à
 * l'initialisation ouvrirait « page » à qui a demandé « mots », simplement
 * parce que les drapeaux n'étaient pas encore là.
 */
export function ongletDemande(
  parametre: unknown,
  actives: readonly string[],
): OngletDuMur {
  const ouverts: readonly string[] = ongletsDuMur(actives);
  return typeof parametre === "string" && ouverts.includes(parametre)
    ? (parametre as OngletDuMur)
    : "page";
}

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

/* RIEN D'EXPOSÉ EST UN ÉTAT, PAS UNE PANNE.
 *
 * Un Mur publié dont aucune ligne n'est cochée ouvre une adresse qui ne dit
 * rien de soi. L'écran doit pouvoir le dire — « Choisissez ce que vos proches
 * verront » — plutôt que d'aligner des interrupteurs éteints en silence.
 *
 * On lit `showBirthdayDate` ET les goûts : ne regarder que les goûts ferait
 * passer pour vide une page qui annonce encore une date d'anniversaire.
 */
export function rienDExpose(mur: Wall, interets: readonly WallInterest[]): boolean {
  return !mur.showBirthdayDate && !interets.some((i) => i.isPublic);
}

// ── Les mots reçus ──────────────────────────────────────────────────────────

/* DU PLUS RÉCENT AU PLUS ANCIEN, et rien de filtré.
 *
 * `status` tranche la CONSIDÉRATION dans le sas de §3.8 — « retenir veut dire
 * qu'on considère ce qui est arrivé, écarter c'est ne pas le considérer, pas
 * le cacher ». Masquer ici ce qui a été écarté ferait disparaître un mot qu'on
 * a bel et bien reçu, et le seul endroit où on peut le relire avec lui.
 *
 * On COPIE avant de trier : `sort` mute, et la liste vient du serveur — la
 * réordonner sur place ferait diverger l'écran de ce qu'on a lu.
 */
export function motsRecus(mots: readonly ReceivedWish[]): ReceivedWish[] {
  return [...mots].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* UN MOT SANS SIGNATURE GARDE SA PLACE, et le dit.
 *
 * `authorName` est « nul si la contribution était anonyme » — mais un nom
 * réduit à des espaces vient du même formulaire public, et laisserait la ligne
 * s'ouvrir sur une virgule. Les deux se replient donc sur le même libellé
 * plutôt que de traiter le vide comme un nom.
 */
export function signatureDuMot(
  mot: ReceivedWish,
  sansNom: string,
  quand: string,
): string {
  return `${mot.authorName?.trim() || sansNom}, ${quand}`;
}
