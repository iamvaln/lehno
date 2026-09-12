import { estActive } from "@lehno/contracts";
import type {
  Occurrence, PublicWish, SharedWishlist, Wishlist,
} from "@lehno/contracts";
import { dateCourte } from "./carnet.js";
import { libelleDeLEcheance } from "./libelles.js";
import type { Messages } from "../messages/index.js";

/* Mes wishlists — §3.29.
 *
 * UNE LISTE N'EST PLUS FORCÉMENT SON OCCASION. Elle l'a été : le contrat
 * n'acceptait qu'une `occurrenceId`, obligatoire, et l'écran s'en tenait là —
 * « il se rouvre le jour où le contrat bouge, pas avant ». Le contrat a bougé
 * (#160) : `occurrenceId` est facultative, et `name` existe.
 *
 * Ce que ça change se voyait à l'appareil, et c'était un CUL-DE-SAC. Un compte
 * neuf n'a aucune date à lui — les dates qu'on saisit d'abord sont celles de
 * ses proches. « Nouvelle wishlist » s'ouvrait donc sur « Aucune date à vous
 * pour l'instant », « Enregistrer » éteint, et rien d'autre : pas un champ, pas
 * un lien. L'accueil invitait pourtant à « Faire ma wishlist ».
 *
 * La clôture réglable (`closesAt`) reste, elle, à faire : le contrat la porte,
 * la maquette l'offre en interrupteur, l'écran ne la propose pas encore.
 */

/* ── Ouvrir une liste ─────────────────────────────────────────────────────── */

/* CE QU'ON ENVOIE, et rien de plus.
 *
 * `createWishlistSchema` est `.strict()` : une clé en trop fait refuser la
 * requête ENTIÈRE. On n'envoie donc `occurrenceId` que s'il y en a une, et
 * `name` que s'il a été saisi — jamais une chaîne vide, que le schéma refuse
 * (`min(1)`) alors que l'absence, elle, passe.
 *
 * SANS OCCASION, LE NOM EST OBLIGATOIRE, et c'est le serveur qui le dit :
 * « une liste sans occasion a besoin d'un nom ». Le vérifier ici aussi n'est
 * pas de la défiance — c'est ce qui permet d'éteindre le bouton plutôt que de
 * faire découvrir la règle par un refus après coup.
 *
 * AVEC une occasion, le nom reste facultatif : il se compose d'elle —
 * « Liste de Célarine, anniversaire 2026 ».
 */
export interface OuvertureDeListe {
  occurrenceId?: string;
  name?: string;
}

export function ouvertureDeListe(
  occurrenceId: string | null,
  nom: string,
): OuvertureDeListe | null {
  const propre = nom.trim();
  if (occurrenceId === null && propre === "") return null;
  return {
    ...(occurrenceId === null ? {} : { occurrenceId }),
    ...(propre === "" ? {} : { name: propre }),
  };
}

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
    /* SANS DATE, EN DERNIER — jamais mêlée aux datées.
       Une liste sans occasion (« ce qui me ferait plaisir ») n'a rien à
       comparer : la ranger à une place arbitraire la ferait remonter devant
       une échéance de la semaine, ou disparaître sous des occasions de l'an
       prochain. Les dates d'abord, dans leur ordre ; le reste ensuite, dans
       l'ordre où le serveur les a rendues. */
    if (a.occurrenceDate === null || b.occurrenceDate === null) {
      if (a.occurrenceDate === b.occurrenceDate) return 0;
      return a.occurrenceDate === null ? 1 : -1;
    }
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

/* COMMENT LA LISTE S'APPELLE.
 *
 * `name` D'ABORD, quand le propriétaire en a donné un. Nul veut dire, au
 * contrat, « composez-le depuis l'occasion » — et c'est le client qui compose,
 * délibérément : le serveur rendrait une chaîne figée le jour où l'occasion
 * change de nom, et personne ne saurait pourquoi les deux ne s'accordent plus.
 *
 * Le nom saisi partait à la trappe : la carte composait toujours depuis
 * l'occasion, et une liste sans occasion s'affichait « Autre » — le nom qu'on
 * venait de taper n'apparaissait nulle part. Vu à l'appareil, sur la liste
 * qu'on vient de créer.
 */
export function nomDeLaListe(
  liste: Pick<Wishlist, "name" | "eventKind" | "eventLabel">,
  t: Messages,
): string {
  if (liste.name !== null && liste.name.trim() !== "") return liste.name;
  /* `eventKind` est une chaîne libre au contrat, pas l'énumération : on ne
     retient que l'anniversaire, tout le reste tombe sur « Autre ». */
  return libelleDeLEcheance(
    liste.eventKind === "birthday" ? "birthday" : "other", liste.eventLabel, t,
  );
}

/* LA DATE, OU L'AVEU QU'IL N'Y EN A PAS.
 *
 * Le contrat vérifie la FORME — `^\d{4}-\d{2}-\d{2}$` — et pas le calendrier :
 * « 2026-02-31 » passe. `Intl` le formaterait sans broncher en reportant sur
 * mars, et la liste annoncerait une date que personne n'a saisie. On préfère
 * « Sans date » : une absence se lit, un mensonge non.
 *
 * ELLE ACCEPTE L'ABSENCE, depuis qu'une liste peut ne viser aucune occasion.
 * Les deux cas — pas de date du tout, et une date que le calendrier refuse —
 * se disent pareil à l'écran, et c'est voulu : dans les deux, il n'y a rien de
 * juste à afficher. Les distinguer obligerait chaque appelant à traiter deux
 * absences là où une seule se lit.
 */
export function quandDeLaListe(occurrenceDate: string | null, langue: string): string | null {
  if (occurrenceDate === null) return null;
  const [annee, mois, jour] = occurrenceDate.split("-").map(Number);
  if (!annee || !mois || !jour) return null;
  const quand = new Date(Date.UTC(annee, mois - 1, jour));
  if (quand.getUTCMonth() !== mois - 1 || quand.getUTCDate() !== jour) return null;
  return dateCourte(occurrenceDate, langue);
}

/* CHERCHER DES IDÉES POUR CETTE LISTE.
 *
 * IL FAUT UNE OCCASION, et pas seulement le drapeau. Le geste ouvre §3.7, qui
 * lit `/me/occurrences/{id}` : sur une liste qui ne vise aucune occasion — « ce
 * qui me ferait plaisir », qu'on tient toute l'année —, il n'y a pas d'`id` à
 * lui passer. Le bouton menait alors à « Cette demande n'est pas valide », un
 * écran rouge sans retour. Vu à l'appareil, sur la première liste sans occasion
 * qu'il devenait possible d'ouvrir.
 *
 * Une liste archivée ne le propose pas non plus : préparer pour une date passée
 * ferait payer un crédit pour un cadeau qu'on n'offrira plus.
 */
export function peutChercherDesIdees(
  liste: Wishlist,
  actives: readonly string[],
): boolean {
  return liste.occurrenceId !== null
    && !liste.isArchived
    && estActive(actives, "generation.ideas");
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
