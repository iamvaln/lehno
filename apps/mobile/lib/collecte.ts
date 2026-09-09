import {
  createCollectionLinkSchema,
  type CollectionLink, type CreateCollectionLinkInput,
  type PublicCollectForm, type Submission,
} from "@lehno/contracts";

/* Le lien de collecte — §3.20.
 *
 * « Envoyez ce lien : ce qui en revient passe par votre validation avant
 * d'entrer dans la fiche. » Deux natures, et elles ne se ressemblent pas — un
 * lien NOMINATIF complète une fiche précise, un lien PUBLIC ne vise personne et
 * peut créer la fiche à la validation.
 */

/* LE LIEN EST DURABLE : « pas d'expiration, seulement une révocation ». Un lien
   révoqué « ne mène plus à rien » et ne se rallume pas — le contrat n'offre que
   la création et la suppression. La copie propose « Réactiver un lien » ; elle
   se contredit elle-même deux lignes plus bas, en disant « vous pouvez en créer
   un autre ». C'est la seconde qui dit vrai. */
export function estVivant(lien: CollectionLink): boolean {
  return lien.isActive;
}

/* CELUI QU'ON MONTRE POUR UNE FICHE : le lien vivant, s'il y en a un.
 *
 * Plusieurs liens révoqués peuvent traîner derrière un proche — on en a créé,
 * révoqué, recréé. Ils n'ont rien à dire : c'est le vivant qu'on partage, et
 * lui seul. En montrer plusieurs ferait choisir entre des adresses dont une
 * seule répond.
 */
export function lienVivantPour(
  liens: readonly CollectionLink[],
  personId: string,
): CollectionLink | null {
  return liens.find((l) => l.personId === personId && estVivant(l)) ?? null;
}

/* Le lien PUBLIC du compte, s'il existe. Il ne vise personne, donc il ne s'en
   trouve qu'un à la fois qui vaille. */
export function lienPublicVivant(liens: readonly CollectionLink[]): CollectionLink | null {
  return liens.find((l) => l.type === "public" && estVivant(l)) ?? null;
}

/* CE QU'ON DEMANDE POUR EN CRÉER UN.
 *
 * `personId` n'accompagne QUE le nominatif : le contrat refuse les deux autres
 * combinaisons, et il a raison — « un lien nominatif désigne une fiche », « un
 * lien public ne vise aucune fiche ». Le poser sur un public laisserait croire
 * qu'on sait déjà où ranger ce qui reviendra, alors que c'est précisément la
 * question que la validation posera.
 */
export function corpsDeCreation(
  type: CollectionLink["type"],
  personId: string | null,
): CreateCollectionLinkInput {
  return createCollectionLinkSchema.parse({
    type,
    ...(type === "nominatif" && personId ? { personId } : {}),
  });
}

/* L'ÉTAT DE LA COLLECTE POUR UNE FICHE, en trois cas et pas deux.
 *
 * La maquette n'en dessine que deux — « nominal » et « révoqué » — parce qu'un
 * banc d'essai part toujours d'un lien déjà créé. L'application, elle, ouvre
 * l'écran sur une fiche qui n'en a JAMAIS eu : c'est le cas le plus fréquent,
 * et le confondre avec « révoqué » ferait lire « ce lien ne mène plus à rien »
 * à quelqu'un qui n'en a jamais posé.
 *
 * « Révoqué » se distingue d'« aucun » par la seule chose qui les sépare : il
 * reste une trace. On a créé, puis repris — et c'est ce qu'il faut dire.
 */
export type EtatDeLaCollecte = "aucun" | "actif" | "revoque";

export function etatDeLaCollecte(
  liens: readonly CollectionLink[],
  personId: string,
): EtatDeLaCollecte {
  if (lienVivantPour(liens, personId)) return "actif";
  return liens.some((l) => l.personId === personId) ? "revoque" : "aucun";
}

/* CE QUI EST REVENU PAR LE LIEN DE CETTE FICHE, et rien d'autre.
 *
 * `linkType` est le SEUL séparateur que le contrat offre : une contribution ne
 * dit pas par quel lien elle est arrivée. Or une contribution venue d'un lien
 * PUBLIC reçoit le `personId` de la fiche au moment de la validation — la
 * compter ici créditerait ce lien-ci de ce qu'un autre a rapporté, et le
 * décompte grossirait tout seul sans qu'on ait rien envoyé.
 *
 * Un lien public en attente porte `personId: null` : il ne peut pas se
 * confondre. C'est le public DÉJÀ VALIDÉ qui trompe, et c'est lui qu'on écarte.
 */
export function recuesPour(
  contributions: readonly Submission[],
  personId: string,
): Submission[] {
  return contributions.filter((c) => c.linkType === "nominatif" && c.personId === personId);
}

/* CE QUI ATTEND ENCORE UNE DÉCISION, parmi elles.
 *
 * Deux nombres plutôt qu'un, parce qu'ils répondent à deux questions et qu'un
 * seul mentirait sur l'autre : « trois réponses reçues » reste vrai après
 * qu'on les a tranchées, mais la ligne ne doit plus MENER au sas — on y
 * ouvrirait un écran vide en cherchant ce qu'on a déjà traité.
 */
export function aTrancherPour(
  contributions: readonly Submission[],
  personId: string,
): Submission[] {
  return recuesPour(contributions, personId).filter((c) => c.status === "pending");
}

/* ── L'aperçu : ce que le répondant verra ────────────────────────────────── */

/* IL SE LIT SUR `GET /public/collect/<jeton>`, la surface même que le lien
 * ouvre. Recomposer la page depuis ce que je sais de la fiche donnerait deux
 * vérités, et celle de l'écran finirait par flatter — elle montrerait ce que je
 * crois avoir mis dans le lien plutôt que ce qui s'y trouve. Même raison que
 * l'aperçu du Mur (§3.12), même remède.
 */

/* LE FORMULAIRE DÉSIGNE-T-IL UNE FICHE. Sur un lien PUBLIC le serveur rend
   `personDisplayName` nul À DESSEIN — « ce lien se partage au monde, et y
   servir une fiche l'exposerait à quiconque relaie l'adresse ». Le nul n'est
   donc pas une donnée manquante à combler : c'est une décision du serveur, et
   la refaire côté client la déferait. */
export function designeUneFiche(page: PublicCollectForm): boolean {
  return page.personDisplayName !== null;
}

/* LA DATE EST-ELLE DÉJÀ PROPOSÉE. C'est l'état particulier que §3.20 nomme —
   « fiche sans date encore renseignée : le lien sert justement à la
   recueillir » — et la seule chose que l'aperçu apprend vraiment avant
   d'envoyer : le répondant trouvera-t-il un champ pré-rempli à confirmer, ou
   une page qui lui demande tout. */
export function dateDejaProposee(page: PublicCollectForm): boolean {
  return page.birthDate !== null;
}

/* LE MUR EST-IL PROPOSÉ AU RÉPONDANT. Nul « si le propriétaire n'a pas publié
   son Mur : proposer un lien vers une page dépubliée apprendrait qu'elle
   existe ». On lit la réponse du serveur, on ne rejoue pas sa règle. */
export function proposeLeMur(page: PublicCollectForm): boolean {
  return page.ownerWallUsername !== null;
}
