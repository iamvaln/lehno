import type { Occurrence, Wishlist } from "@lehno/contracts";

/* Mes wishlists — §3.29.
 *
 * UNE LISTE EST SON OCCASION. Le contrat ne lui donne pas de nom : elle porte
 * `occurrenceId`, sa date et la nature de l'événement — « un cadeau de Noël
 * n'est pas un cadeau de mariage ». La maquette propose un champ « nom de la
 * liste », « sans occasion » et une clôture ; rien de tout cela n'existe, et
 * les poser ferait un formulaire dont trois champs sur quatre se perdraient.
 */

/* CE QU'ON PEUT ENCORE OUVRIR.
 *
 * Une liste s'ouvre sur une occasion À SOI — « ouvrir une liste sur l'occasion
 * d'un proche publierait ce que ce proche n'a jamais accepté de publier ». Et
 * une occasion qui porte déjà sa liste ne s'en ouvre pas une seconde : deux
 * listes pour un même anniversaire se partageraient l'une l'autre sans qu'on
 * sache laquelle circule.
 */
export function occasionsOuvrables(
  miennes: readonly Occurrence[],
  listes: readonly Wishlist[],
): Occurrence[] {
  const prises = new Set(listes.map((l) => l.occurrenceId));
  return miennes.filter((o) => !prises.has(o.id));
}

/* CE QUI VIENT D'ABORD : la prochaine occasion, puis les passées.
 *
 * Une liste archivée « s'affiche encore — on veut revoir ce qu'on avait
 * demandé — mais n'accepte plus de réservation ». Elle descend donc, sans
 * disparaître : la faire sortir effacerait la mémoire de ce qu'on avait
 * souhaité l'an dernier.
 */
export function listesRangees(listes: readonly Wishlist[]): Wishlist[] {
  return [...listes].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    // Les vivantes de la plus proche à la plus lointaine ; les archivées de la
    // plus récente à la plus ancienne — on relit la dernière, pas la première.
    return a.isArchived
      ? b.occurrenceDate.localeCompare(a.occurrenceDate)
      : a.occurrenceDate.localeCompare(b.occurrenceDate);
  });
}

/* « 3 sur 7 réservés » — COMBIEN, jamais LESQUELS ni PAR QUI. Le contrat s'en
   tient là exprès : le compte fait paraître la liste vivante sans désigner
   personne, et savoir QUI a réservé quoi gâcherait la surprise qu'on prépare. */
export function resteAOffrir(liste: Wishlist): number {
  return Math.max(0, liste.wishCount - liste.reservedCount);
}

/* PARTAGER N'A DE SENS QUE SUR UNE LISTE VIVANTE ET REMPLIE.
 *
 * Une liste archivée n'accepte plus de réservation : en donner le lien ferait
 * venir quelqu'un sur une page qui ne peut plus rien recevoir. Une liste vide
 * ferait pire — elle demanderait à un proche de choisir dans rien.
 */
export function peutPartager(liste: Wishlist): boolean {
  return !liste.isArchived && liste.wishCount > 0;
}
