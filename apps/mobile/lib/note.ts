import type {
  CreateNoteInput, CreateNotesInput, Occurrence, Person,
} from "@lehno/contracts";

/* Les décisions de la saisie d'une note (§3.5), séparées de son affichage.
 *
 * Elles vivent ici pour être éprouvées sans moteur de rendu : `react-native`
 * est typé en Flow, et aucun des outils de test du dépôt ne sait le lire. Ce
 * fichier n'importe que des TYPES, qui s'effacent à la compilation.
 *
 * CE QUI SE DÉCIDE ICI, ET NULLE PART AILLEURS :
 *
 * — Le CHEMIN. Une note pour un seul proche appartient à ce proche, et part par
 *   le chemin qui le nomme. `/me/notes` existe pour l'autre cas, celui où la
 *   note « n'appartient à aucun proche en particulier » — le commentaire du
 *   contrat le dit ainsi. Poster une note d'un seul proche par le chemin nu
 *   marcherait, et dirait le contraire de ce qu'elle est.
 *
 * — LA NATURE. `eventOccurrenceId` absent = note DURABLE, elle décrit le proche
 *   et vaut d'une année sur l'autre ; renseigné = note de circonstance. C'est ce
 *   champ, et lui seul, qui distingue les deux — d'où l'attention portée à ne
 *   jamais l'envoyer à vide.
 *
 * — LE RANGEMENT N'EST PAS À NOUS. `createNoteSchema` n'a pas de champ
 *   `categories`, et c'est délibéré : c'est le SERVEUR qui range. L'écran ne
 *   propose donc aucun choix de catégorie, et surtout aucun repli sur une
 *   catégorie fourre-tout — une note qu'on n'a pas su ranger reste sans
 *   catégorie, et c'est un état valide.
 */

/* Les bornes du contrat, redites ici pour que l'écran n'ait pas à charger un
   schéma zod juste pour éteindre un bouton. Le test les ancre aux schémas
   eux-mêmes : si le contrat bouge, il casse. */
export const MIN_PROCHES = 1;
export const MAX_PROCHES = 20;
export const MAX_CARACTERES = 4000;

/* Ce qu'une note vaut vraiment : sans ses blancs. Le contrat `trim()` avant de
   mesurer, donc une note de trois espaces est une note vide — l'éteindre ici
   épargne un aller-retour pour une erreur qu'on savait déjà. */
export function texteUtile(saisie: string): string {
  return saisie.trim();
}

/* Un proche désigné deux fois recevrait DEUX notes identiques : la note se
   duplique, une par entrée de `personIds`, et rien côté serveur ne les
   rapproche ensuite. La liste des candidats écarte déjà les choisis ; cette
   garde tient le cas où l'écran préremplit un proche qu'on retouche.

   Le plafond du contrat s'applique ici plutôt qu'à l'envoi : un nom qui entre
   dans la liste et disparaît au moment d'enregistrer serait pris pour un bogue. */
export function ajouteLeProche(choisis: readonly string[], id: string): readonly string[] {
  if (choisis.includes(id)) return choisis;
  if (choisis.length >= MAX_PROCHES) return choisis;
  return [...choisis, id];
}

export function retireLeProche(choisis: readonly string[], id: string): readonly string[] {
  return choisis.filter((c) => c !== id);
}

/* UNE ÉCHÉANCE APPARTIENT À UN SEUL PROCHE — `occurrenceSchema` porte son
 * `personId`. Une note partagée entre deux personnes ne peut donc pas être « de
 * circonstance » : l'occasion de l'une n'est pas celle de l'autre, et la
 * rattacher aux deux poserait chez la seconde une note accrochée à une date qui
 * n'est pas la sienne.
 *
 * Le contrat laisse passer la combinaison — `createNotesSchema` accepte les
 * deux champs. C'est donc au client de ne pas la former.
 *
 * Conséquence à l'écran : désigner un second proche efface l'occasion, et la
 * section disparaît. Elle revient quand il n'en reste qu'un.
 */
export function occasionRetenue(
  occasion: string | null,
  choisis: readonly string[],
): string | null {
  return choisis.length === 1 ? occasion : null;
}

/* Les occasions qu'on peut PROPOSER pour ce proche.
 *
 * Deux filtres, et chacun répare un défaut différent :
 *
 * — `personId` : `/me/occurrences` sert aussi l'accueil et la vue Dates, où la
 *   liste porte tout le monde. Faire confiance au paramètre de requête suffit
 *   jusqu'au jour où la liste vient d'ailleurs — et rattacher la note à
 *   l'anniversaire d'un tiers ne se verrait nulle part.
 *
 * — `daysUntil >= 0` : une note de circonstance sert à préparer quelque chose.
 *   Accrochée à une date passée, elle n'est plus lue par personne — ni par la
 *   fiche, qui ne montre que les durables, ni par la préparation, qui regarde
 *   devant. Le jour même compte : c'est justement le moment où l'on note.
 */
export function occasionsOffertes(
  occurrences: readonly Occurrence[],
  personId: string,
): Occurrence[] {
  return occurrences.filter((o) => o.personId === personId && o.daysUntil >= 0);
}

/* Ce qu'on peut chercher dans le carnet pour l'ajouter.
 *
 * Le nom d'usage compte autant que le nom des listes : qui cherche « maman »
 * doit trouver Marie-Ange — la même règle que l'écran de recherche.
 *
 * Au plafond, la liste est VIDE plutôt que pleine de noms qu'un appui ne
 * prendrait pas : un geste sans effet est pire qu'un choix absent.
 */
export function candidatsAAjouter(
  carnet: readonly Person[],
  choisis: readonly string[],
  filtre: string,
  langue: string,
): Person[] {
  if (choisis.length >= MAX_PROCHES) return [];
  const q = filtre.trim().toLocaleLowerCase(langue);
  return carnet.filter((p) => {
    if (choisis.includes(p.id)) return false;
    if (!q) return true;
    return p.displayName.toLocaleLowerCase(langue).includes(q)
      || (p.callingName ?? "").toLocaleLowerCase(langue).includes(q);
  });
}

/* Éteindre le bouton plutôt que d'envoyer ce qu'on sait refusé. Les trois
   bornes sont celles du contrat, pas des nôtres. */
export function peutEnregistrer(saisie: string, choisis: readonly string[]): boolean {
  const texte = texteUtile(saisie);
  return texte.length >= 1
    && texte.length <= MAX_CARACTERES
    && choisis.length >= MIN_PROCHES
    && choisis.length <= MAX_PROCHES;
}

export interface Envoi {
  chemin: string;
  corps: CreateNoteInput | CreateNotesInput;
}

/* L'appel à former — chemin et corps ensemble, parce que les deux se décident
 * de la même chose : combien de proches.
 *
 * `eventOccurrenceId` s'AJOUTE ou n'existe pas. Ni `null` — le schéma le dit
 * `uuid().optional()`, pas nullable, et un `null` serait refusé —, ni
 * `undefined` posé explicitement, que `exactOptionalPropertyTypes` interdit de
 * toute façon. L'absence de la clé EST la note durable.
 *
 * Rend `null` quand la saisie ne tient pas : l'appelant n'a alors rien à
 * former, et le bouton était déjà éteint.
 */
export function envoiDeLaNote(
  saisie: string,
  choisis: readonly string[],
  occasion: string | null,
): Envoi | null {
  if (!peutEnregistrer(saisie, choisis)) return null;
  const content = texteUtile(saisie);
  const retenue = occasionRetenue(occasion, choisis);
  const circonstance = retenue ? { eventOccurrenceId: retenue } : {};

  const seul = choisis.length === 1 ? choisis[0] : undefined;
  if (seul !== undefined) {
    return {
      chemin: `/me/persons/${seul}/notes`,
      corps: { content, ...circonstance },
    };
  }
  return {
    chemin: "/me/notes",
    corps: { content, personIds: [...choisis], ...circonstance },
  };
}
