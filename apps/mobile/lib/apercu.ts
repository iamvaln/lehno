import type { PublicWall } from "@lehno/contracts";

/* L'aperçu de mon Mur — §3.12, vu depuis l'application.
 *
 * « Voir ma page avant de l'envoyer. » Il répond à une question qu'on se pose
 * juste avant de partager : qu'est-ce que l'autre verra, au juste ?
 *
 * IL LIT `GET /me/wall/preview`, qui rend exactement ce qu'un visiteur reçoit.
 * Reconstruire l'aperçu depuis mes propres réglages donnerait deux vérités —
 * et celle de l'écran finirait par flatter, en montrant ce que je crois avoir
 * exposé plutôt que ce qui l'est.
 */

/* L'ANNIVERSAIRE SANS SON ANNÉE.
 *
 * Le contrat rend « MM-DD » et le dit : « le Mur annonce un anniversaire, pas
 * une date de naissance — l'année dirait l'âge à tout visiteur ». On formate
 * donc un jour et un mois, sans jamais composer une date complète : passer par
 * `new Date` demanderait une année, qu'on inventerait, et une année bissextile
 * mal choisie ferait disparaître le 29 février.
 *
 * On emploie une année bissextile FIXE pour le seul formatage — 2000 — et on
 * ne rend que le jour et le mois. Le choix est arbitraire et sans effet :
 * aucune partie de l'année ne sort de cette fonction.
 */
export function anniversaireSansAnnee(mmdd: string, langue: string): string | null {
  const parts = /^(\d{2})-(\d{2})$/.exec(mmdd);
  if (!parts) return null;
  const mois = Number(parts[1]);
  const jour = Number(parts[2]);
  const quand = new Date(Date.UTC(2000, mois - 1, jour));
  // Une date impossible — « 02-31 » — se replierait en mars sans rien dire.
  if (quand.getUTCMonth() !== mois - 1 || quand.getUTCDate() !== jour) return null;
  return new Intl.DateTimeFormat(langue, { day: "numeric", month: "long", timeZone: "UTC" })
    .format(quand);
}

/* CE QUE LA PAGE MONTRE VRAIMENT, et l'aveu quand elle ne montre rien.
 *
 * Une page sans message, sans date et sans goût n'est pas cassée — elle est
 * vide, et c'est une information : on s'apprête à partager une adresse qui ne
 * dit rien de soi. L'écran doit pouvoir le dire plutôt que d'afficher un titre
 * suivi de blanc.
 */
export function pageVide(mur: PublicWall): boolean {
  return !mur.welcomeMessage && mur.birthday === null && mur.interests.length === 0;
}

/* LE DÉPÔT DE VŒUX EST RÉSOLU PAR LE SERVEUR, et on ne refait pas son
   raisonnement. `wishLinkToken` est « nul quand il n'y a pas d'occasion, quand
   la fenêtre est fermée, ou quand le drapeau `wishes` est éteint. Le serveur
   RÉSOUT les trois : un client n'a aucune règle à connaître, et ne peut donc
   pas proposer un bouton qui mènerait à un 404. » */
export function accepteDesVoeux(mur: PublicWall): boolean {
  return mur.wishLinkToken !== null;
}
