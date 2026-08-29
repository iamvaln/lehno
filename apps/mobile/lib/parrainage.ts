import type { ReferralSummary } from "@lehno/contracts";

/* Parrainage — §3.29, le second chemin vers des crédits et le seul qui n'en
 * coûte pas.
 */

/* CE QUE LE PARRAINAGE PROMET, ou rien.
 *
 * `bonusParInvitation` est NUL quand l'achat est fermé : le parrainage vit
 * toujours — l'éteindre « tuerait l'acquisition avec la monétisation » —, mais
 * il n'a plus de crédits à promettre, puisqu'ils n'achètent rien.
 *
 * On lit cette VALEUR, jamais les deux drapeaux. Le contrat le demande
 * nommément : « un client qui croiserait `referral` et `credits` lui-même
 * referait le raisonnement du serveur, et s'en écarterait le jour où il
 * change ». C'est exactement le défaut qui m'a déjà coûté une feuille de
 * paiement qui ne s'ouvrait jamais.
 */
export function annonceUnGain(resume: ReferralSummary): boolean {
  return resume.bonusParInvitation !== null;
}

/* LE CODE VIENT DU SERVEUR, jamais de la copie.
 *
 * Le handoff le donne en dur — « VAL-4KX2 ». Figé, tout le monde partagerait
 * le même code : les filleuls seraient rattachés à un compte qui n'est pas le
 * leur, ou à aucun. C'est la même faute que le numéro du compte de collecte,
 * avec la même conséquence — un geste qui part au mauvais endroit sans que
 * personne s'en aperçoive.
 *
 * Un code vide n'est pas un code : le serveur ne devrait pas en rendre, mais
 * s'il le fait on n'offre pas de partager du vide.
 */
export function codePartageable(resume: ReferralSummary): string | null {
  const code = resume.code.trim();
  return code.length > 0 ? code : null;
}

/* CEUX QUI ONT ABOUTI, et eux seuls, dans le décompte annoncé.
 *
 * `invited` porte trois états : invité, inscrit, crédité. « Une personne a
 * utilisé votre code » ne peut pas compter quelqu'un qui n'a fait que recevoir
 * l'invitation — la phrase promettrait un gain qui n'est pas venu, et le solde
 * la démentirait.
 */
export function filleulsAboutis(resume: ReferralSummary): number {
  return resume.invited.filter((p) => p.status !== "invited").length;
}
