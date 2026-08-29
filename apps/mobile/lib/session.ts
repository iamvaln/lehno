import { translateError, type Locale } from "@lehno/i18n";
import type { ErrorCode, ErrorEnvelope } from "@lehno/contracts";

/* Les décisions de session, séparées de ce qui les exécute.
 *
 * Elles tiennent en trois questions : faut-il renouveler, faut-il déconnecter,
 * et que montrer. Aucune ne demande le réseau, donc toutes se testent.
 */

/* Un jeton d'accès expire souvent — c'est sa raison d'être — et le client
   renouvelle sans que personne le voie.
   Sauf après un jeton rejoué : `refresh_reused` dit que le serveur a fermé la
   session par sécurité. Réessayer serait au mieux inutile, au pire une boucle,
   et ce serait rejouer le geste qui a déclenché l'alerte. */
export function doitRenouveler(statut: number, code: ErrorCode | null): boolean {
  return statut === 401 && code === "session_expired";
}

/* Ce qui met fin à la session côté client. Rester connecté sur un compte
   suspendu donnerait une application qui échoue à chaque geste sans dire
   pourquoi. */
const FINS_DE_SESSION: readonly ErrorCode[] = [
  "refresh_reused",
  "account_suspended",
  "account_pending_deletion",
];

export function sortDeLaSession(code: ErrorCode | null): boolean {
  return code != null && FINS_DE_SESSION.includes(code);
}

/* « Le client ne montre jamais le message brut : il traduit le code dans la
   langue de l'utilisateur. » C'est ce qui rend l'application bilingue sans que
   le serveur ait à connaître la langue de celui qui l'appelle — et ce qui
   empêche un identifiant technique d'atterrir sous les yeux de quelqu'un.

   Le repli couvre le cas où le serveur n'a rien rendu du tout : une panne de
   réseau n'a pas de code, et un écran muet vaut moins qu'une phrase honnête. */
const REPLIS: Record<Locale, string> = {
  fr: "La connexion n'a pas abouti. Réessayez dans un moment.",
  en: "The connection did not go through. Try again in a moment.",
};

export function messageDErreur(enveloppe: ErrorEnvelope | null, langue: Locale): string {
  if (!enveloppe) return REPLIS[langue];
  return translateError(enveloppe.code, langue);
}
