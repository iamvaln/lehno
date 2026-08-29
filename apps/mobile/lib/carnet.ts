import type {
  CategoryCode, EventKind, Metadata, Note, PersonSort, SortDirection,
} from "@lehno/contracts";

/* Les décisions du carnet, séparées de son affichage.
 *
 * Elles vivent ici pour être éprouvées sans moteur de rendu : `react-native`
 * est typé en Flow, et aucun des outils de test du dépôt ne sait le lire. Un
 * fichier de décisions n'importe que des TYPES, qui s'effacent à la
 * compilation — d'où un module que Vitest charge sans broncher.
 */

// Vingt, la page du handoff. `PAGE_PROCHES` la porte aussi côté contrat ; on
// la redit ici pour que l'écran n'ait pas à connaître le paquet des contrats
// juste pour compter — mais le test l'ancre à la même valeur.
export const PAGE = 20;

// Sept jours. Au-delà, la ligne se tait : la liste montre « qui a une date qui
// approche », pas tout le monde classé par échéance.
const PRESSE = 7;

export interface Tri {
  cle: PersonSort;
  sens: SortDirection;
}

/* Un second appui sur le critère ACTIF retourne le sens — c'est le geste d'un
   en-tête de colonne. Changer de critère repart au sens naturel : hériter du
   sens précédent donnerait Z–A à qui vient seulement de quitter « au plus
   loin », sans l'avoir demandé. */
export function basculeDeTri(courant: Tri, cle: PersonSort): Tri {
  if (courant.cle !== cle) return { cle, sens: "asc" };
  return { cle, sens: courant.sens === "asc" ? "desc" : "asc" };
}

/* Le tri et la pagination sont au SERVEUR. Trier la page reçue mettrait en
   tête le plus proche DES VINGT PREMIERS, pas le plus proche du carnet — et
   une fiche dont la date tombe loin sortirait de sa propre place. */
export function parametresDuCarnet(tri: Tri, offset: number): string {
  return `?sort=${tri.cle}&direction=${tri.sens}&offset=${offset}&limit=${PAGE}`;
}

/* `daysUntil` est SIGNÉ : négatif pour une échéance passée. Une prochaine
   échéance ne devrait pas l'être, mais si elle l'est, « J−−3 » n'a aucun sens.
   On borne des deux côtés plutôt que de faire confiance. */
export function presseAssezPourSAfficher(jours: number | null): boolean {
  return jours !== null && jours >= 0 && jours <= PRESSE;
}

/* Ce qui reste AU SERVEUR, pas ce qui manque à l'écran. Jamais négatif : un
   total qui rétrécit entre deux pages — une fiche supprimée ailleurs —
   proposerait sinon de charger « −2 restants ». */
export function resteACharger(total: number, charges: number): number {
  return Math.max(0, total - charges);
}

/* Les catégories viennent du SERVEUR, avec leur sémantique.
 *
 * `/me/metadata` rend, pour chacune des sept : sa `kind` — ponctuelle ou
 * durable — et son `isConstraint`. Aucune énumération ne porte ces deux
 * choses ; les deviner ici reviendrait à réécrire chez nous une règle qui vit
 * là-bas, et à la voir diverger au premier ajout.
 *
 * C'est ce qui manquait : la fiche rangeait tout en « idée » ou « à éviter »,
 * et une note de « Faits marquants » s'annonçait comme une idée. */
export type TableDesCategories = Metadata["categories"];

function categorie(table: TableDesCategories, code: CategoryCode) {
  return table.find((c) => c.code === code);
}

/* Un garde-fou, au sens du serveur : `isConstraint`. La fiche le dessine
   autrement — en pointillé, sans fond — parce qu'il écarte des idées au lieu
   d'en proposer. Se tromper là-dessus fait proposer du vin à quelqu'un qui ne
   boit pas ; se tromper ailleurs coûte un rangement approximatif. */
export function estUnGardeFou(note: Note, table: TableDesCategories): boolean {
  return note.categories.some((code) => categorie(table, code)?.isConstraint === true);
}

/* Ce qu'une note annonce : TOUTES ses catégories, pas la première.
   Une note peut en porter deux quand elle sert deux usages — ce qu'un proche
   traverse relève des challenges ET de ce qu'il a besoin d'entendre. N'en
   montrer qu'une choisirait à sa place.

   Vide est un état valide : une note que le système n'a pas su ranger reste
   telle quelle, sans repli sur une catégorie fourre-tout. */
export function categoriesDeLaNote(note: Note): readonly CategoryCode[] {
  return note.categories;
}

/* Les « intérêts » n'ont pas de champ au contrat — ce sont des notes d'une
   catégorie. La fiche les montre en étiquettes plutôt qu'en cartes : un mot par
   carte gaspillerait l'écran, et le handoff les dessine en rangée.

   Ce qui va en étiquette se DÉDUIT de la table : une catégorie DURABLE qui
   n'est pas une contrainte. Durable, parce qu'un goût vaut d'une année sur
   l'autre là qu'un challenge d'il y a deux ans ne vaut plus. Pas une
   contrainte, parce qu'un no-go est durable lui aussi, et le ranger parmi les
   goûts le ferait lire comme une envie.

   Une note rangée en étiquette ne reparaît pas plus bas, même si elle porte une
   seconde catégorie : elle serait lue deux fois. */
export function interetsEtNotes(notes: readonly Note[], table: TableDesCategories): {
  interets: Note[];
  cartes: Note[];
} {
  const interets: Note[] = [];
  const cartes: Note[] = [];
  const durableEtLibre = (code: CategoryCode): boolean => {
    const c = categorie(table, code);
    return c?.kind === "durable" && !c.isConstraint;
  };
  for (const note of notes) {
    (note.categories.some(durableEtLibre) ? interets : cartes).push(note);
  }
  return { interets, cartes };
}

/* La date d'une échéance, en repère sous le nom : « 24 août », « 24 Aug ».
 *
 * L'année n'y figure pas — l'échéance est à venir, et l'écrire ferait lire une
 * date d'archive. Le décompte, lui, dit à quelle distance elle est.
 *
 * `Intl` plutôt qu'une table de mois : Hermes l'embarque, et une table à nous
 * serait à retraduire à chaque langue ajoutée. La date arrive en « YYYY-MM-DD »
 * — une date CIVILE, sans heure : on la construit en UTC pour qu'un fuseau à
 * l'ouest ne la fasse pas reculer d'un jour à l'affichage.
 */
export function dateCourte(civile: string, langue: string): string {
  const [annee, mois, jour] = civile.split("-").map(Number);
  const quand = new Date(Date.UTC(annee ?? 0, (mois ?? 1) - 1, jour ?? 1));
  return new Intl.DateTimeFormat(langue, {
    day: "numeric", month: "short", timeZone: "UTC",
  }).format(quand);
}

/* Le sous-titre de la fiche : ce qu'on sait de ce proche, en une ligne.
 *
 * Il se COMPOSE — la nature de la prochaine échéance, sa date, le registre. Le
 * kit le donnait en dur (« Anniversaire · 24 août · amical ») parce qu'une
 * planche n'a pas de données ; l'écrire tel quel dans le dictionnaire ferait
 * dire la même chose de tout le monde.
 *
 * Les morceaux absents disparaissent, séparateurs compris : « · · amical » se
 * lirait comme un défaut d'affichage.
 */
export function sousTitreDuProche(morceaux: readonly (string | null)[]): string {
  return morceaux.filter((m): m is string => Boolean(m)).join(" · ");
}

/* Les types d'événement OUVERTS, lus dans les métadonnées — jamais déduits
 * d'un drapeau.
 *
 * `eventKinds` est la seule liste de `/me/metadata` qui varie d'un compte à
 * l'autre : le serveur la FILTRE déjà. Quand `events.other` est éteint, elle
 * rend `["birthday"]`, et le formulaire ne propose plus « autre type » sans
 * avoir la moindre règle à connaître.
 *
 * Tester le drapeau nous-mêmes referait le raisonnement du serveur, et nous
 * en écarterait le jour où il change. C'est le contrat qui l'écrit ainsi, sur
 * le chemin lui-même.
 *
 * Vide tant que la réponse n'est pas là : on ne propose rien qu'on ne sache
 * ouvert. L'anniversaire, lui, relève du socle et ne s'éteint jamais — mais
 * même lui s'affirme depuis la liste, pas depuis une exception écrite ici.
 */
export function offreLeType(ouverts: readonly EventKind[], kind: EventKind): boolean {
  return ouverts.includes(kind);
}

/* LE TOPO — ce que les notes ont appris, extrait et jamais saisi.
 *
 * Onze natures possibles, une seule valeur par nature — la plus récente —,
 * chacune avec la note d'où elle vient. Aucun formulaire ne les demande :
 * corriger, c'est écrire une note.
 *
 * LE BLOC N'EXISTE QUE S'IL A DE LA MATIÈRE. Une liste vide est un état normal,
 * pas un défaut : une fiche neuve n'a rien appris encore. On n'affiche alors
 * aucun bloc — jamais une grille de cases vides qui attendraient d'être
 * remplies, ce qui transformerait une extraction en questionnaire.
 *
 * ET IL SE REPLIE : trois puces, puis « +N ». Onze attributs ne repoussent pas
 * les actions de la fiche — c'est un aperçu, pas un dossier.
 */
export const TOPO_VISIBLE = 3;

export function topoReplie<T>(attributs: readonly T[]): { vus: T[]; reste: number } {
  return {
    vus: attributs.slice(0, TOPO_VISIBLE),
    reste: Math.max(0, attributs.length - TOPO_VISIBLE),
  };
}
