import type { ErrorCode, MaintenanceStatus } from "@lehno/contracts";

/* L'arrêt pour intervention, et ce qui le distingue d'un drapeau éteint.
 *
 * Les deux se ressemblent — le serveur refuse — et tout les sépare :
 *
 *   drapeau éteint : 404, une surface, lu au démarrage  → masquer l'écran
 *   arrêt          : 503, toutes,      tombe en séance  → écran d'attente
 *
 * Traiter un arrêt comme un drapeau ferait lire une fenêtre de deux heures
 * comme une suppression définitive : l'écran disparaîtrait, et ne reviendrait
 * qu'à la réinstallation.
 */

export function estUnArret(statut: number, code: ErrorCode | null): boolean {
  // Un 503 sans ce code vient d'ailleurs — une passerelle, un répartiteur. On
  // ne montre pas l'écran d'attente pour une panne qu'on ne sait pas nommer.
  return statut === 503 && code === "maintenance";
}

/* Le délai vient du serveur, pour que tout le parc applique la même règle et
   qu'on puisse l'allonger si l'intervention dure. Le recalculer de son côté
   ferait revenir mille téléphones à la même seconde. */
export const DELAI_MINIMAL = 15;

export function delaiDAttente(etat: MaintenanceStatus): number {
  // Sans délai annoncé on attend quand même, mais peu : personne ne doit rester
  // devant un écran figé si l'intervention s'achève tout de suite.
  return Math.max(DELAI_MINIMAL, etat.retryAfterSeconds ?? 0);
}

/* « Un chemin gouverné par un drapeau éteint rend 404. Le recevoir là où vous
   attendiez une réponse veut dire relis la liste, pas affiche une erreur. »

   Le drapeau s'est éteint pendant la session : la liste est périmée, et c'est
   elle qu'il faut rafraîchir. Montrer une erreur laisserait l'écran ouvert sur
   une surface qui n'existe plus.

   Un 404 sur une ressource nommée est ordinaire — une note supprimée, un proche
   effacé — et relire les drapeaux à chaque fois serait du bruit. C'est
   l'appelant qui sait s'il visait une surface gouvernée. */
export function exigeDeRelireLesDrapeaux(
  statut: number,
  code: ErrorCode | null,
  options: { gouvernee?: boolean } = {},
): boolean {
  const { gouvernee = true } = options;
  return gouvernee && statut === 404 && code === "not_found";
}

/* L'heure de retour, calculée depuis le délai que le SERVEUR annonce.
 *
 * Le kit donnait « 14 h 30 » en exemple, et l'afficher tel quel annonçait une
 * heure inventée : quelqu'un serait revenu à 14 h 30 pour trouver la même page.
 * Une page d'attente qui ment sur l'attente est pire qu'une page qui se tait.
 *
 * En dessous d'un quart d'heure on ne donne pas d'heure du tout : « de retour
 * vers 14 h 30 » quand il reste quarante secondes se lit comme une panne, pas
 * comme une minute à patienter.
 */
export const SECONDES_POUR_ANNONCER_UNE_HEURE = 15 * 60;

export function heureDeRetour(
  secondes: number | null,
  maintenant: number,
  langue: string,
): string | null {
  if (secondes === null || secondes < SECONDES_POUR_ANNONCER_UNE_HEURE) return null;
  return new Intl.DateTimeFormat(langue, {
    hour: "numeric", minute: "2-digit",
  }).format(new Date(maintenant + secondes * 1000));
}
