/* LE CACHE DE LECTURE — « Vos notes et vos dates restent consultables ».
 *
 * LA DÉCISION QUI SIMPLIFIE TOUT LE RESTE : le cache n'est JAMAIS lu quand le
 * réseau va. En ligne, on demande au serveur, toujours. Le cache est un repli,
 * pas une couche de performance.
 *
 * Ça change tout. Un cache lu en ligne devrait s'invalider — savoir qu'une
 * note vient d'être écrite ailleurs, qu'une fiche a changé — et c'est ce
 * problème-là qui rend les caches difficiles. Ici il ne se pose pas : ce qu'on
 * montre hors connexion est daté par l'évidence, et ce qu'on montre en ligne
 * vient du serveur.
 */

/* CE QU'ON GARDE : une liste NOMMÉE, jamais une exclusion.
 *
 * Une liste d'exclusions garderait par défaut tout ce qui n'y figure pas — donc
 * la prochaine route qu'on ajoute, sans que personne l'ait décidé. Un
 * `/me/balance` neuf serait mis en cache et montrerait un solde d'hier à
 * quelqu'un qui s'apprête à acheter.
 *
 * Ici, une route neuve n'est pas gardée tant qu'on ne l'a pas inscrite. Le
 * défaut est le silence, et il faut agir pour garder — pas l'inverse.
 *
 * Ce qu'on inscrit répond à la promesse et rien de plus : « vos NOTES et vos
 * DATES ». Pas de solde, pas de montant, pas de méthode de paiement — les
 * montrer périmés ferait décider sur un chiffre faux, et l'argent est
 * précisément ce qu'on ne rattrape pas.
 */
const GARDÉS: readonly RegExp[] = [
  /^\/me\/home$/,
  /^\/me\/persons(\?|$)/,
  /^\/me\/persons\/[^/?]+$/,
  /^\/me\/persons\/[^/?]+\/notes(\?|$)/,
  /^\/me\/persons\/[^/?]+\/attributes$/,
  /^\/me\/occurrences(\?|$)/,
  /^\/me\/occurrences\/[^/?]+$/,
  /^\/me\/profile$/,
];

export function estGarde(chemin: string, methode = "GET"): boolean {
  /* Seules les lectures. Une écriture n'a pas de réponse à garder — et la
     garder ferait rejouer un résultat, pas un état. */
  if (methode.toUpperCase() !== "GET") return false;
  return GARDÉS.some((m) => m.test(chemin));
}

/* LA CLÉ EST LE CHEMIN ENTIER, chaîne de requête comprise.
 *
 * `/me/occurrences?from=A&to=B` et `?from=C&to=D` sont deux réponses
 * différentes : les confondre montrerait les échéances d'un autre mois. La
 * chaîne de requête fait partie de la question, donc de la réponse. */
export function cleDuCache(chemin: string): string {
  return "cache:" + chemin;
}

export interface Entree {
  /* LE CORPS BRUT, jamais l'objet analysé.
   *
   * On le repasse par le schéma à la relecture : un corps gardé par une version
   * précédente de l'application, que le contrat ne décrit plus, TOMBE au
   * parsage et se jette. Stocker l'objet déjà analysé ferait sauter cette garde
   * exactement le jour où elle sert — au lendemain d'une montée de version, sur
   * le téléphone de quelqu'un qui n'a pas de réseau pour recharger. */
  corps: string;
  enregistreLe: string;
}

/* COMBIEN DE TEMPS ON GARDE.
 *
 * Trente jours, et le nombre compte moins que la raison. Le cache ne sert que
 * hors connexion : sa péremption ne borne pas la fraîcheur de ce qu'on voit en
 * ligne, elle borne l'ancienneté de ce qu'on accepte de montrer en repli.
 *
 * Trop court, il est vide quand il servirait — quelqu'un qui ouvre
 * l'application une fois par mois n'aurait jamais rien. Trop long, on montre un
 * carnet d'il y a un an comme s'il était d'aujourd'hui.
 *
 * Un mois couvre le rythme réel de l'application — on l'ouvre quand un
 * anniversaire approche — sans franchir la limite où les fiches ont
 * matériellement changé. */
export const PEREMPTION_MS = 30 * 24 * 60 * 60 * 1000;

export function estPerimee(entree: Entree, maintenant: number): boolean {
  const pose = Date.parse(entree.enregistreLe);
  /* Une date illisible est traitée comme périmée : garder ce qu'on ne sait pas
     dater reviendrait à garder pour toujours. */
  if (Number.isNaN(pose)) return true;
  return maintenant - pose > PEREMPTION_MS;
}
