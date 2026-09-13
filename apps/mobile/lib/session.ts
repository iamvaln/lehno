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

/* LE CLIENT EST REFUSÉ, PAS LE COMPTE — et c'est toute la différence.
 *
 * `client_unknown` dit que ce BUILD n'est pas reconnu : identifiant absent,
 * inconnu, révoqué, clé fausse, type discordant. Le compte de la personne va
 * très bien, et rien de ce qu'elle peut faire n'y changera quoi que ce soit.
 *
 * TROIS CHOSES À NE PAS FAIRE, et chacune serait un défaut différent :
 *
 * — NE PAS RENOUVELER. Le jeton n'est pas le problème ; rejouer l'appel
 *   tournerait en boucle sur un refus qui ne bouge pas.
 * — NE PAS SORTIR DE LA SESSION. Effacer les jetons déconnecterait quelqu'un
 *   dont le compte est sain, et le ferait se reconnecter pour retomber sur le
 *   même mur — en ayant perdu sa session au passage. C'est pour ça que ce code
 *   n'est PAS dans `FINS_DE_SESSION`, et la tentation est réelle : il y
 *   ressemble.
 * — NE PAS LE CONFONDRE AVEC UN COMPTE REFUSÉ. L'écran dirait « votre compte
 *   est refusé » à quelqu'un dont le compte va bien.
 *
 * Ce qui reste est un écran d'arrêt, de la même famille que la maintenance :
 * rien à faire d'ici, et le dire. */
export function leClientEstRefuse(statut: number, code: ErrorCode | null): boolean {
  return statut === 403 && code === "client_unknown";
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
