import type { ErrorCode } from "@lehno/contracts";

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

/* LE RYTHME de réessai, et lui seul.
 *
 * Il ne prend que `retryAfterSeconds`, pas l'état entier : c'est ce qui
 * l'empêche de reprendre un jour l'heure annoncée pour en déduire un délai.
 * Les deux ont vécu ensemble ici, et j'ai confondu l'une avec l'autre.
 *
 * Sans rythme annoncé on attend quand même, mais peu : personne ne doit rester
 * devant un écran figé si l'intervention s'achève tout de suite. */
export function delaiDAttente(retryAfterSeconds: number | null): number {
  return Math.max(DELAI_MINIMAL, retryAfterSeconds ?? 0);
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

/* L'HEURE DE RETOUR ANNONCÉE — celle du serveur, jamais un calcul.
 *
 * Je l'avais dérivée de `retryAfterSeconds`, et le contrat le corrige sans
 * détour : ce sont DEUX choses. `retryAfterSeconds` est le RYTHME de réessai,
 * qui existe toujours pendant une intervention ; `until` est l'heure de retour,
 * et elle est facultative. « Un rythme de quinze minutes ne dit pas que le
 * service revient dans quinze minutes. » Dériver l'une de l'autre, c'était
 * annoncer un retour que personne n'avait promis.
 *
 * D'où deux états, et deux seulement : avec `until`, l'écran dit quand revenir ;
 * sans elle, il dit qu'une mise à jour est en cours. Pas de « bientôt », pas
 * d'estimation inventée — et plus de seuil de mon cru pour compenser un calcul
 * qui n'avait pas lieu d'être.
 *
 * L'horodatage arrive en UTC ; c'est le téléphone qui le met à son heure, et le
 * format appartient à son dictionnaire. Une chaîne que `Date` ne sait pas lire
 * ne rend rien : mieux vaut se taire qu'afficher « Invalid Date ».
 */
export function heureDeRetour(until: string | null, langue: string): string | null {
  if (!until) return null;
  const quand = new Date(until);
  if (Number.isNaN(quand.getTime())) return null;
  return new Intl.DateTimeFormat(langue, { hour: "numeric", minute: "2-digit" }).format(quand);
}

/* Le FILET du serveur, à ne jamais montrer à l'utilisateur.
 *
 * `POST /me/events` rend `422 resource_inactive` sur un `kind` que le drapeau
 * `events.other` a fermé — le type refusé voyageant dans `details.kind`. Ce
 * n'est pas `404` : le chemin existe, les anniversaires l'empruntent, il n'y a
 * rien à cacher.
 *
 * Le contrat le dit sans détour : « un client à jour ne devrait jamais le
 * voir ». Le recevoir signifie que NOTRE écran a proposé un choix que ses
 * métadonnées ne portaient plus. C'est un défaut chez nous, pas chez le
 * serveur, et le traduire en message d'erreur ferait porter à quelqu'un la
 * faute d'une liste que nous n'avons pas relue. On relit, et on se tait.
 */
export function exigeDeRelireLesMetadonnees(
  statut: number,
  code: ErrorCode | null,
): boolean {
  return statut === 422 && code === "resource_inactive";
}
