import type { ExternalIdentity, SessionSummary } from "@lehno/contracts";

/* Sécurité et connexions — §3.24.
 *
 * DEUX LISTES, et elles ne se lisent pas de la même façon : par quoi on entre,
 * et depuis où l'on est entré.
 */

export type Moyen =
  | { sorte: "code" }
  | { sorte: "externe"; identite: ExternalIdentity };

/* LA CONNEXION PAR CODE N'A PAS DE LIGNE AU CONTRAT, et ce n'est pas un oubli :
 * elle n'a pas de désactivation possible — « la connexion par code restant
 * l'accès de secours ». Le serveur ne rend donc que les moyens EXTERNES.
 *
 * L'écran l'ajoute lui-même, toujours, sans rien demander. C'est le seul
 * endroit du portage où l'on affiche quelque chose que le serveur n'a pas dit —
 * parce que son absence signifie « toujours là », pas « pas là ».
 *
 * Les externes d'abord, le code en dernier : on cherche dans cette liste ce
 * qu'on a rattaché, pas ce qui ne peut pas s'enlever.
 */
export function moyensDeConnexion(identites: readonly ExternalIdentity[]): Moyen[] {
  return [
    ...identites.map((identite): Moyen => ({ sorte: "externe", identite })),
    { sorte: "code" },
  ];
}

export type NatureDAppareil = "mobile" | "ordinateur" | "inconnu";

/* De quoi choisir une ICÔNE, et rien de plus.
 *
 * L'en-tête `User-Agent` est « déclaré par l'appareil à chaque appel, jamais
 * vérifié : un indice de reconnaissance pour la personne qui lit l'écran, pas
 * une preuve ». On ne lui fait donc pas dire un nom d'appareil — « iPhone 14 de
 * Valentine » serait une affirmation ; un pictogramme est une aide.
 *
 * Nul quand l'appareil ne l'a pas fourni, et « inconnu » quand il ne ressemble
 * à rien de connu : mieux vaut une icône neutre qu'un téléphone dessiné pour un
 * serveur qui passait par là.
 */
export function natureDeLAppareil(userAgent: string | null): NatureDAppareil {
  if (!userAgent) return "inconnu";
  const ua = userAgent.toLowerCase();
  if (/iphone|ipod|android|mobile/.test(ua)) return "mobile";
  if (/macintosh|windows|linux|x11|ipad/.test(ua)) return "ordinateur";
  return "inconnu";
}

/* LA PLUS RÉCEMMENT ACTIVE D'ABORD.
 *
 * `lastActiveAt` avance à chaque rotation de jeton : c'est « la dernière fois
 * qu'elle a servi », pas l'ouverture. Trier par `createdAt` mettrait en tête
 * une lignée ouverte il y a six mois et morte depuis, en repoussant celle d'où
 * l'on regarde — exactement l'inverse de ce qu'on cherche quand on ouvre cet
 * écran par inquiétude.
 */
export function appareils(sessions: readonly SessionSummary[]): SessionSummary[] {
  return [...sessions].sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
}

/* « CET APPAREIL » — la lignée d'où l'on regarde.
 *
 * Elle était impossible à désigner : la réponse de connexion ne rendait aucun
 * identifiant de session, et `/me/sessions` n'a pas de champ « courant » — à
 * dessein, il ne reçoit qu'un jeton d'accès. Le serveur rend maintenant
 * `sessionId`, la LIGNÉE, celle-là même que la liste porte comme `id`.
 *
 * Deviner par le `User-Agent` aurait été pire que se taire : deux sessions
 * ouvertes depuis le même téléphone portent le même, et la coche serait tombée
 * sur la mauvaise — celle qu'on aurait gardée en croyant fermer l'autre.
 *
 * SANS LIGNÉE CONNUE, ON NE COCHE RIEN. Une session ouverte par une version qui
 * ne la gardait pas encore reste valide et n'en a pas ; cocher au hasard
 * ferait révoquer la mauvaise en croyant garder la sienne.
 */
export function estCetAppareil(session: SessionSummary, lignee: string | null): boolean {
  return lignee !== null && session.id === lignee;
}

/* CE QUE « DÉCONNECTER LES AUTRES APPAREILS » PEUT ENFIN PROMETTRE.
 *
 * Le libellé du kit dit « les AUTRES » dans les deux langues, et la route
 * révoquait TOUT, celle qui appelle comprise : le bouton promettait de rester
 * connecté ici, et déconnectait. Elle épargne désormais la lignée appelante —
 * le service nomme son paramètre `sauf`.
 *
 * ON NE L'OFFRE QUE S'IL Y A DES AUTRES. Un bouton qui ne ferait rien, sur un
 * écran qu'on ouvre par inquiétude, se presse quand même — et son silence se
 * lit comme une panne plutôt que comme « il n'y avait rien à fermer ».
 *
 * Le compte ne se déduit PAS de `sessions.length - 1` : sans lignée connue, on
 * ne sait pas si la nôtre est dans la liste, et retrancher un ferait annoncer
 * une session de moins qu'il n'y en a.
 */
export function autresAppareils(
  sessions: readonly SessionSummary[],
  lignee: string | null,
): number {
  return sessions.filter((s) => !estCetAppareil(s, lignee)).length;
}
