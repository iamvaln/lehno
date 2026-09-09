import { estActive } from "@lehno/contracts";
import type {
  Occurrence, PublicWish, SharedWishlist, Wishlist,
} from "@lehno/contracts";
import { dateCourte } from "./carnet.js";

/* Mes wishlists — §3.29.
 *
 * UNE LISTE EST SON OCCASION. Le contrat ne lui donne pas de nom : elle porte
 * `occurrenceId`, sa date et la nature de l'événement — « un cadeau de Noël
 * n'est pas un cadeau de mariage ». La maquette propose un champ « nom de la
 * liste », « sans occasion » et une clôture ; rien de tout cela n'existe, et
 * les poser ferait un formulaire dont trois champs sur quatre se perdraient —
 * ou, pire, une requête refusée en bloc, `createWishlistSchema` étant
 * `.strict()`. Un champ dont la saisie s'évapore est pire qu'un champ absent :
 * il promet. Le manque est relevé dans `specs/remontees-mobile-2026-08-29.md`
 * (§3 bis) ; il se rouvre le jour où le contrat bouge, pas avant.
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

/* LA LISTE QU'ON REGARDE, quand celle qu'on avait choisie n'existe plus.
 *
 * La sélection survit au rechargement — on revient sur l'écran, la liste est
 * archivée ou supprimée ailleurs, et l'identifiant qu'on gardait ne désigne
 * plus rien. Il peut aussi venir d'un LIEN PROFOND, donc de n'importe où :
 * on ne le croit jamais sur parole, on le cherche.
 *
 * `null` seulement quand il n'y a rien à montrer : autrement l'écran se
 * retrouverait vide en tenant pourtant des listes.
 */
export function listeCourante(
  rangees: readonly Wishlist[],
  choisi: string | null,
): Wishlist | null {
  return rangees.find((l) => l.id === choisi) ?? rangees[0] ?? null;
}

/* LA DATE, OU L'AVEU QU'IL N'Y EN A PAS.
 *
 * Le contrat vérifie la FORME — `^\d{4}-\d{2}-\d{2}$` — et pas le calendrier :
 * « 2026-02-31 » passe. `Intl` le formaterait sans broncher en reportant sur
 * mars, et la liste annoncerait une date que personne n'a saisie. On préfère
 * « Sans date » : une absence se lit, un mensonge non.
 */
export function quandDeLaListe(occurrenceDate: string, langue: string): string | null {
  const [annee, mois, jour] = occurrenceDate.split("-").map(Number);
  if (!annee || !mois || !jour) return null;
  const quand = new Date(Date.UTC(annee, mois - 1, jour));
  if (quand.getUTCMonth() !== mois - 1 || quand.getUTCDate() !== jour) return null;
  return dateCourte(occurrenceDate, langue);
}

/* CHERCHER DES IDÉES POUR UNE OCCASION PASSÉE N'A PAS DE SENS — et la
   génération se PAIE. Proposer le geste sur une liste archivée ferait dépenser
   un crédit pour un anniversaire d'il y a onze mois.

   Le drapeau se lit ici plutôt qu'à l'écran pour la raison habituelle : la
   décision se teste, le rendu non. Et le COÛT ne se décide pas ici — il se
   règle en administration, et c'est l'écran de préparation qui l'annonce avant
   de débiter. Un « 1 crédit » écrit en dur, comme dans le kit, afficherait
   l'ancien tarif sur tout un parc. */
export function peutChercherDesIdees(
  liste: Wishlist,
  actives: readonly string[],
): boolean {
  return !liste.isArchived && estActive(actives, "generation.ideas");
}

/* ── L'aperçu : ce que verront les visiteurs ────────────────────────────── */

/* « ON NE DIFFUSE PAS UNE PAGE QU'ON N'A PAS VUE. » Le kit le dit du partage
 * de liste, et l'écran l'appliquait à l'envers : il ouvrait la feuille de
 * partage du système sans jamais montrer la page.
 *
 * L'aperçu lit `/public/wishlists/{token}` — la vraie page, celle que le
 * serveur sert aux visiteurs. La recomposer depuis mes propres souhaits
 * donnerait deux vérités, et celle de l'écran flatterait : elle montrerait ce
 * que je crois avoir exposé plutôt que ce qui l'est.
 */
export function souhaitsMontres(page: SharedWishlist): readonly PublicWish[] {
  return page.state === "ok" ? page.wishes : [];
}

/* LE PIÈGE QUE L'APERÇU EXISTE POUR ATTRAPER.
 *
 * `wishCount` compte TOUS mes souhaits ; la page publique n'en montre que les
 * `isPublic`. Une liste de sept souhaits tous privés se partage donc — elle
 * n'est pas vide au sens de `peutPartager` — et s'ouvre sur rien chez le
 * proche. Sans aperçu, personne ne s'en aperçoit avant que le lien ne circule.
 */
export function apercuSansSouhait(page: SharedWishlist): boolean {
  return page.state === "ok" && page.wishes.length === 0;
}

/* L'ÉTAT D'UN SOUHAIT TEL QUE LE VISITEUR LE VOIT, et rien de plus. « Réservé
   OUI, par qui JAMAIS » : la forme publique ne nomme personne, pas même sous
   condition, et l'aperçu n'a donc rien à cacher — il montre exactement ce
   qu'il reçoit. Offert l'emporte sur réservé : c'est l'état final. */
export type EtatMontre = "offert" | "reserve";

export function etatDuSouhaitMontre(souhait: PublicWish): EtatMontre | null {
  if (souhait.isFulfilled) return "offert";
  return souhait.isReserved ? "reserve" : null;
}
