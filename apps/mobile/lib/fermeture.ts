import {
  confirmDeletionSchema, DELETION_REASONS, estActive, usernameSchema,
  type ConfirmDeletionInput, type DeletionImpact, type DeletionPreview,
  type DeletionReason,
} from "@lehno/contracts";

/* Fermer son compte — §3.24, en trois temps.
 *
 * 1. CE QUI PART, compté avant que rien ne soit touché.
 * 2. LE SOLDE, et ce qui s'en rembourse — pas tout.
 * 3. LES DEUX PREUVES : le pseudo prouve l'intention, le code prouve l'accès à
 *    la boîte. L'un sans l'autre ne vaut rien.
 */

export const TEMPS = 3;

/* CE QUI PART, ligne par ligne.
 *
 * Le socle est toujours là — proches, notes, dates. Le reste suit son drapeau :
 * annoncer la disparition des wishlists à quelqu'un qui n'en a jamais eu
 * alourdit un écran déjà lourd, et fait douter du reste de la liste.
 *
 * Les DÉCOMPTES viennent du serveur, jamais le contenu : « l'écran doit dire
 * *47 notes* pour que le geste pèse son poids ; les rendre en entier ferait de
 * cet aperçu un second export de données, avec les mêmes obligations et aucune
 * des protections ».
 */
export type LigneDImpact = "socle" | "wishlists" | "mur" | "liens";

export function cequiPart(actives: readonly string[]): LigneDImpact[] {
  const lignes: LigneDImpact[] = ["socle"];
  if (estActive(actives, "wishlist.own")) lignes.push("wishlists");
  if (estActive(actives, "wall")) lignes.push("mur");
  if (estActive(actives, "collect")) lignes.push("liens");
  return lignes;
}

/* Un aperçu où TOUT est à zéro n'a rien à montrer. Compter « 0 proche, 0 note »
   ne fait pas peser le geste, ça le rend absurde — et l'écran doit alors passer
   à ce qui compte vraiment, le solde et les deux preuves. */
export function impactVide(impact: DeletionImpact): boolean {
  return Object.values(impact).every((n) => n === 0);
}

export type EtatDuRemboursement =
  | "rien"           // aucun crédit acheté à rendre
  | "possible"       // une méthode éligible existe
  | "sans_methode";  // des crédits à rendre, aucune méthode qui convienne

/* CE QUE LE SOLDE PEUT DEVENIR.
 *
 * `refundable` est la part ACHETÉE — la seule que les CGU §6 promettent de
 * rendre. Le reste, ce sont les crédits offerts : bienvenue, parrainage, code
 * promotionnel. Ils n'ont pas été payés et ne se remboursent pas. Lire
 * `balance` ici promettrait le solde entier, et c'est une promesse sur de
 * l'argent.
 *
 * `sans_methode` n'est pas une erreur mais l'état que §3.24 décrit : « l'écran
 * l'explique et oriente vers l'assistance ». Le client ne refait AUCUN calcul
 * d'éligibilité — le délai est réglable en back-office, et deux versions du
 * parc appliqueraient deux règles.
 */
export function etatDuRemboursement(apercu: DeletionPreview): EtatDuRemboursement {
  if (apercu.refund.refundable === 0) return "rien";
  return apercu.refund.eligibleMethods.length > 0 ? "possible" : "sans_methode";
}

/* LE CODE EST À SIX CHIFFRES, et le contrat le dit par une expression
   rationnelle. On la respecte sans la recopier : compter les chiffres suffit
   pour allumer un bouton, et le schéma tranche à l'envoi. */
export function codeComplet(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

/* LES DEUX PREUVES, ET IL EN FAUT DEUX.
 *
 * Le pseudo prouve l'INTENTION : on ne le saisit pas par accident, et il oblige
 * à s'arrêter sur ce qu'on fait. Le code prouve l'ACCÈS À LA BOÎTE : sans lui,
 * un téléphone déverrouillé une minute suffirait à effacer un compte.
 *
 * Le pseudo se compare EXACTEMENT — c'est une confirmation, pas une
 * identification : le serveur sait déjà qui appelle. Accepter une casse
 * différente affaiblirait l'arrêt qu'on cherche à provoquer.
 */
export function peutFermer(pseudoSaisi: string, pseudoReel: string, code: string): boolean {
  return pseudoSaisi.trim() === pseudoReel && codeComplet(code);
}

export interface SaisieDeFermeture {
  pseudo: string;
  code: string;
  motif: DeletionReason | null;
  precision: string;
  /* La méthode vers laquelle renvoyer le solde acheté. Nulle quand il n'y a
     rien à rendre, ou quand on choisit de partir sans — §3.24 laisse la
     suppression « se poursuivre ou attendre ». */
  methode: string | null;
}

/* LE CORPS DE LA CONFIRMATION.
 *
 * Les champs facultatifs sont OMIS plutôt qu'envoyés vides : le schéma est
 * `strict()` et refuse une chaîne vide là où il attend un texte d'au moins un
 * caractère. Un motif non choisi n'est pas « autre » — c'est une question à
 * laquelle on n'a pas répondu, et le silence se transmet en se taisant.
 */
export function corpsDeFermeture(saisie: SaisieDeFermeture): ConfirmDeletionInput {
  const precision = saisie.precision.trim();
  return confirmDeletionSchema.parse({
    username: saisie.pseudo.trim(),
    code: saisie.code.trim(),
    ...(saisie.motif ? { reason: saisie.motif } : {}),
    ...(precision ? { reasonDetails: precision } : {}),
    ...(saisie.methode ? { refundPaymentMethodId: saisie.methode } : {}),
  });
}

/* Le pseudo saisi peut être irrecevable AVANT même d'être comparé — trop court,
   caractère interdit. On le dit avec la règle du contrat, jamais avec une copie
   de son expression rationnelle. */
export function pseudoRecevable(pseudo: string): boolean {
  return usernameSchema.safeParse(pseudo.trim()).success;
}

/* LES MOTIFS QU'ON PEUT NOMMER, et eux seuls.
 *
 * Le contrat en porte SEPT ; la copie n'en libelle que QUATRE, et l'un des
 * quatre — « Ça ne m'a pas servi » — ne correspond proprement à aucun : il
 * tient à la fois de `no_longer_useful`, de `too_complicated` et de
 * `missing_feature`. Le ranger de force enverrait une raison fausse dans une
 * donnée qui sert à décider du produit, et personne ne le verrait jamais.
 *
 * On n'offre donc que les trois correspondances SÛRES. Le motif est facultatif
 * au contrat, et le champ libre accompagne n'importe lequel : quelqu'un dont la
 * raison n'est pas dans la liste peut toujours l'écrire, ce qui vaut mieux
 * qu'une case qui la trahit.
 *
 * L'indice pointe dans `supprRaisons` — l'écran n'écrit aucun libellé.
 */
export const MOTIFS_OFFERTS: readonly { motif: DeletionReason; indice: number }[] = [
  { motif: "no_longer_useful", indice: 0 },
  { motif: "too_expensive", indice: 1 },
  { motif: "temporary_break", indice: 3 },
];

/* Ce que le contrat porte et que personne ne sait dire. Existe pour qu'un test
   le rende visible plutôt que de le laisser se perdre dans un commentaire. */
export function motifsSansLibelle(): DeletionReason[] {
  const offerts = new Set(MOTIFS_OFFERTS.map((m) => m.motif));
  return DELETION_REASONS.filter((r) => !offerts.has(r));
}
