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

/* CE QUE L'ÉCRAN NE PEUT PAS DIRE : « Cet appareil ».
 *
 * La maquette coche la lignée courante. Personne ne peut la désigner : le
 * contrat ne porte pas de champ « courant » — délibérément, `/me/sessions` ne
 * reçoit qu'un jeton d'accès qui ne dit pas de quelle lignée il descend — et le
 * client ne le sait pas non plus, contrairement à ce que ce commentaire
 * suppose : la réponse de connexion ne rend que les deux jetons et une durée,
 * aucun identifiant de session.
 *
 * Deviner par le `User-Agent` serait pire que se taire : deux sessions ouvertes
 * depuis le même téléphone portent le même, et la coche tomberait sur la
 * mauvaise — celle qu'on garderait en croyant fermer l'autre.
 *
 * La fonction existe pour porter cette impossibilité à un seul endroit, et pour
 * qu'elle devienne vraie le jour où le contrat rendra l'identifiant.
 */
export function estCetAppareil(): boolean {
  return false;
}
