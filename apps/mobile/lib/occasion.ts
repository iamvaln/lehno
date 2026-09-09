import {
  createWishSchema, estActive, occurrenceSchema, updateWishSchema,
  type CreateWishInput, type GeneratedMessage, type GenerationKind,
  type GenerationResult, type Note,
  type Occurrence, type ReceivedWish, type UpdateWishInput, type Wish,
} from "@lehno/contracts";

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
export interface MessageDeLOccasion {
  /* L'EXÉCUTION, pas seulement son texte. « Voir » ouvre `/generation`, qui
     s'observe par identifiant d'exécution : ne garder que le message forcerait
     l'écran à redemander au serveur de quelle génération il sort, alors que la
     liste le disait déjà. */
  generationId: string;
  message: GeneratedMessage;
  etat: EtatDuMessage;
}

export function messageDeLOccasion(
  resultats: readonly GenerationResult[],
  occurrenceId: string,
): MessageDeLOccasion | null {
  const siens = resultats
    .flatMap((r) => (r.message && r.message.occurrenceId === occurrenceId
      ? [{ generationId: r.generation.id, message: r.message }]
      : []))
    .sort((a, b) => b.message.createdAt.localeCompare(a.message.createdAt));

  const envoye = siens.find((m) => m.message.status === "sent");
  if (envoye) return { ...envoye, etat: "envoye" };

  const premier = siens[0];
  return premier ? { ...premier, etat: "pret" } : null;
}

/* LES IDÉES DÉJÀ TROUVÉES — et on ne les redemande pas.
 *
 * « Ce qui existe déjà ne se redemande pas » : une occasion dont les idées sont
 * sorties offre « Revoir les idées », pas « Trouver des idées ». Reproposer le
 * geste initial ferait repayer sans le dire, puisque le crédit se débite à la
 * DEMANDE et non à l'affichage.
 *
 * On ne retient que les exécutions ABOUTIES. Une qui tourne encore n'a rien à
 * revoir, et une qui a échoué a rendu son crédit — dans les deux cas, proposer
 * de « revoir » mènerait à un écran sans contenu.
 *
 * `resultId` ne sert pas ici : c'est l'identifiant du JEU D'IDÉES, et l'écran
 * de génération s'observe par l'identifiant de l'EXÉCUTION. Les confondre
 * ouvrirait `/me/generations/<un id d'idées>` — un 404 sur une génération bien
 * réelle.
 */
export function ideesDeLOccasion(
  resultats: readonly GenerationResult[],
  occurrenceId: string,
): string | null {
  const siennes = resultats
    .map((r) => r.generation)
    .filter((g) => g.kind === "gift_ideas"
      && g.occurrenceId === occurrenceId
      && g.status === "succeeded")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return siennes[0]?.id ?? null;
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

/* LE BLOC PARAÎT, LA LISTE PAS TOUJOURS — et il faut bien deux questions.
 *
 * Le drapeau gouverne le BLOC ENTIER : éteint, il n'y a ni titre, ni lignes,
 * ni « Ajouter », puisque tout y mène à une surface que le serveur ferme par
 * `@Feature` — un 404 s'afficherait comme une panne sur un compte sain.
 *
 * La nature, elle, ne ferme pas le bloc : elle en change le contenu. Une
 * occasion sensible garde son titre et dit « cette date se prépare sans
 * cadeau » — la maquette le veut ainsi, et un titre suivi d'un silence se
 * lirait comme un chargement qui n'aboutit pas.
 */
export function montreLeBlocDesSouhaits(actives: readonly string[]): boolean {
  return estActive(actives, "wishlist");
}

/* CE QU'UN SOUHAIT DE PROCHE EST DEVENU.
 *
 * Trois états, pas quatre. « Écarté » figure dans le kit mais AUCUN champ du
 * contrat ne le porte : `wishSchema` n'a que `status` et `isShortlisted`. Le
 * déduire d'un `isShortlisted` faux serait un contresens — « pas encore
 * retenu » n'est pas « rejeté ».
 *
 * `reserved` n'apparaît pas non plus, et cette fois c'est le serveur qui le
 * garantit : « une réservation pointe un `OwnerWish`, jamais un
 * `WishlistItem` ». Le lui donner un rendu ferait dessiner un état que rien ne
 * peut poser, et le premier lecteur du code croirait qu'il arrive.
 */
export type EtatDuSouhait = "offert" | "retenu" | "a_etudier";

export function etatDuSouhait(souhait: Pick<Wish, "status" | "isShortlisted">): EtatDuSouhait {
  if (souhait.status === "fulfilled") return "offert";
  return souhait.isShortlisted ? "retenu" : "a_etudier";
}

/* TROIS LIGNES, PAS LA LISTE ENTIÈRE. L'occasion est un point de départ : dix
   souhaits repousseraient les notes et la préparation sous le pli, et c'est
   là qu'on venait. Le reste s'ouvre sur place — il n'existe pas d'écran dédié
   aux souhaits d'un proche, et un lien vers rien vaut moins qu'un lien
   absent. */
export const SOUHAITS_EN_TETE = 3;

export function souhaitsMontres(souhaits: readonly Wish[], tout: boolean): readonly Wish[] {
  return tout ? souhaits : souhaits.slice(0, SOUHAITS_EN_TETE);
}

/* « Toute la wishlist » ne s'offre que s'il reste quelque chose à voir : une
   fois la liste dépliée, ou quand elle tient en trois lignes, le geste ne
   changerait rien à l'écran. */
export function offreToutLaWishlist(souhaits: readonly Wish[], tout: boolean): boolean {
  return !tout && souhaits.length > SOUHAITS_EN_TETE;
}

export interface SaisieDeSouhait {
  intitule: string;
  prix: string;
  devise: string;
  details: string;
}

/* UN PRIX PORTE SA DEVISE — le contrat refuse l'un sans l'autre, et il a
   raison : « 12 000 » ne dit ni des francs CFA ni des euros. On omet donc les
   DEUX quand le prix n'est pas saisi, plutôt que d'en envoyer un seul.

   Les champs facultatifs sont OMIS, jamais envoyés vides : `createWishSchema`
   est strict et refuse une chaîne vide là où il attend un texte.

   Ni `origin` ni `status` : le schéma ne les accepte pas, et c'est délibéré —
   accepter `origin` du client laisserait un ajout personnel se faire passer
   pour une confidence du proche. */
export function corpsDuSouhait(saisie: SaisieDeSouhait): CreateWishInput {
  const prix = Number.parseFloat(saisie.prix.replace(",", "."));
  const chiffre = saisie.prix.trim() !== "" && Number.isFinite(prix) && prix >= 0;
  const details = saisie.details.trim();

  return createWishSchema.parse({
    label: saisie.intitule.trim(),
    ...(details ? { details } : {}),
    ...(chiffre ? { price: prix, currency: saisie.devise } : {}),
  });
}

/* LE SEUL ÉTAT QUE L'ON POSE SOI-MÊME ICI.
 *
 * `isShortlisted` est un repère PERSONNEL — « ce qui m'intéresse » —, invisible
 * pour tout autre et sans effet sur la disponibilité. Il ne s'échange pas avec
 * l'`isPublic` d'une liste partagée : celui-là décide de ce que des visiteurs
 * voient, et les confondre publierait ce qu'on croyait garder pour soi.
 */
export function corpsDeRetenu(souhait: Pick<Wish, "isShortlisted">): UpdateWishInput {
  return updateWishSchema.parse({ isShortlisted: !souhait.isShortlisted });
}

/* LES VŒUX QU'ON A ACCEPTÉS, et eux seuls.
 *
 * Un vœu `pending` n'a pas encore été relu : l'afficher publierait sur la page
 * de quelqu'un un texte que personne n'a validé — exactement ce que le sas
 * existe pour empêcher. Un `rejected` a été refusé ; le remontrer déferait la
 * décision.
 *
 * Le plus récent d'abord : les derniers mots reçus sont ceux qu'on vient
 * chercher.
 */
export function voeuxDeLOccasion(
  voeux: readonly ReceivedWish[],
  occurrenceId: string,
): ReceivedWish[] {
  return voeux
    .filter((v) => v.occurrenceId === occurrenceId && v.status === "approved")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* QUAND LA PAGE N'A PLUS NI SOUHAITS NI PRÉPARATION.
 *
 * Les deux blocs partis, il resterait une carte de note seule en haut et du
 * vide dessous. Le geste du socle — noter une idée — prend alors la place en
 * pied : c'est le seul qui reste, il devient l'action principale plutôt que de
 * rester un petit lien perdu sous un titre.
 *
 * Il ne se propose PAS quand un des deux blocs tient : la page a déjà son
 * action, et un second bouton pleine largeur en dirait deux.
 */
export function socleEnPied(
  { souhaits, pistes }: { souhaits: boolean; pistes: number },
): boolean {
  return !souhaits && pistes === 0;
}

/* UN PARAMÈTRE DE ROUTE N'EST PAS UNE DONNÉE DE CONFIANCE.
 *
 * Une route `expo-router` s'atteint par LIEN PROFOND, et ce qui y est posé
 * part ensuite dans un chemin d'API. Sans cette garde, `?occurrenceId=../..`
 * remonterait l'arborescence du serveur depuis `/me/occurrences/{id}` — le
 * client fabriquerait lui-même l'appel qu'on ne voulait pas.
 *
 * Le schéma est celui du CONTRAT, pas une expression régulière recopiée : une
 * copie diverge le jour où la forme change, et diverge en silence.
 */
export function identifiantDOccasion(brut: string | string[] | undefined): string | null {
  const seul = Array.isArray(brut) ? brut[0] : brut;
  const lu = occurrenceSchema.shape.id.safeParse(seul);
  return lu.success ? lu.data : null;
}

/* CE QUI A DÉJÀ ÉTÉ PRODUIT pour une occasion, par nature de génération.
 *
 * L'écran de préparation en a besoin autant que celui de l'occasion : sans lui
 * il propose « Préparer » à quelqu'un qui a déjà son message, et le geste COÛTE
 * UN CRÉDIT. On lui ferait payer deux fois la même chose sans le prévenir.
 *
 * Il DÉLÈGUE aux deux fonctions qui décidaient déjà, plutôt que de refiltrer :
 * deux prédicats du même fait finissent par diverger, et c'est alors l'écran
 * qui débite qui se trompe.
 *
 * Rend l'identifiant de ce qu'on peut rouvrir, ou `null` s'il n'y a rien.
 */
export function dejaProduit(
  resultats: readonly GenerationResult[],
  occurrenceId: string,
  kind: GenerationKind,
): string | null {
  if (kind === "gift_ideas") return ideesDeLOccasion(resultats, occurrenceId);
  return messageDeLOccasion(resultats, occurrenceId)?.generationId ?? null;
}
