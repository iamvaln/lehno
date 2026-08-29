import { estActive, type GeneratedMessage, type Note, type Occurrence } from "@lehno/contracts";

/* Une occasion — §3.21.
 *
 * L'écran qui manquait, et sans lequel tout ce qui prépare un message était
 * bâti sans porte : préparer vise une OCCASION, jamais une personne — le
 * contrat refuse un lancement qui ne cite pas d'occurrence, et c'est cohérent,
 * on n'écrit pas le même mot pour un anniversaire et pour un deuil.
 *
 * Deux moments, et ils ne proposent pas la même chose. AVANT, on prépare : les
 * souhaits, les notes de circonstance, les pistes de génération. APRÈS, il n'y
 * a plus rien à préparer — on relit ce qui a été envoyé.
 */

/* PASSÉE SE LIT SUR LE DÉCOMPTE, pas sur le statut.
 *
 * `daysUntil` est signé — négatif pour une échéance passée, et le contrat le
 * dit explicitement pour que « J−3 » ne paraisse pas trois jours après. Le
 * statut, lui, dit autre chose : `collecting` et `closed` parlent de la
 * collecte, qui peut se fermer avant la date comme rester ouverte après.
 * Les confondre montrerait le bloc de préparation sur une date écoulée. */
export function estPassee(occasion: Occurrence): boolean {
  return occasion.daysUntil < 0;
}

/* LES NOTES DE CETTE CÉLÉBRATION, et elles seules.
 *
 * `eventOccurrenceId` est le seul champ qui distingue les deux natures : nul
 * pour une note DURABLE, qui décrit le proche et vaut d'une année sur l'autre ;
 * renseigné pour une note de circonstance, qui appartient à cette occasion-ci.
 *
 * On lit donc les notes du proche et on retient celles qui visent cette
 * occasion. Le contrat n'offre pas de filtre : les notes d'un proche « se
 * comptent en dizaines, elles ne paginent pas ». Trier ici est tenable ; ça ne
 * le serait pas sur le carnet entier, et c'est pour ça que le carnet, lui,
 * pagine côté serveur.
 *
 * La plus récente d'abord — ce qu'on vient d'écrire est ce qu'on cherche. */
export function notesDeLOccasion(
  notes: readonly Note[],
  occurrenceId: string,
): Note[] {
  return notes
    .filter((n) => n.eventOccurrenceId === occurrenceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type EtatDuMessage = "envoye" | "pret";

/* CE QUI A ÉTÉ ÉCRIT POUR CETTE OCCASION, s'il y a quelque chose.
 *
 * Un message ENVOYÉ prime sur un brouillon, même plus récent : « un message
 * envoyé puis regénéré » resterait envoyé, et montrer le brouillon ferait
 * croire qu'il reste quelque chose à faire. À défaut, le plus récent des
 * brouillons — c'est celui sur lequel on travaillait.
 *
 * `edited` n'est pas un troisième état à l'écran : un texte ajusté mais pas
 * envoyé est un texte prêt, comme les autres. La distinction sert à la
 * provenance, pas à l'action. */
export function messageDeLOccasion(
  messages: readonly (GeneratedMessage | null)[],
  occurrenceId: string,
): { message: GeneratedMessage; etat: EtatDuMessage } | null {
  const siens = messages
    .filter((m): m is GeneratedMessage => m !== null && m.occurrenceId === occurrenceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const envoye = siens.find((m) => m.status === "sent");
  if (envoye) return { message: envoye, etat: "envoye" };

  const premier = siens[0];
  return premier ? { message: premier, etat: "pret" } : null;
}

/* LES SOUHAITS NE PARAISSENT PAS TOUJOURS, et pour deux raisons distinctes.
 *
 * Le drapeau d'abord : `wishlist` est éteint au lancement, la section sort
 * entièrement — pas de titre vide, pas de « bientôt ».
 *
 * La nature ensuite, et celle-là ne s'éteint jamais : une occasion sensible se
 * prépare « sans cadeau ». Ce n'est pas une restriction technique, c'est le
 * produit qui se tait — on n'offre rien pour un deuil, et proposer une liste
 * de souhaits y serait une faute que nul drapeau ne rattraperait. */
export function montreLesSouhaits(
  actives: readonly string[],
  occasion: Occurrence,
): boolean {
  return estActive(actives, "wishlist") && occasion.nature !== "sensitive";
}

/* Les vœux reçus suivent leur propre drapeau, éteint au lancement. La section
   part avec lui, y compris son état vide : « aucun mot » sur une capacité
   fermée annoncerait un silence qui n'en est pas un. */
export function montreLesVoeux(actives: readonly string[]): boolean {
  return estActive(actives, "wishes");
}
