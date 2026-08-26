import type { Note, PersonSort, SortDirection } from "@lehno/contracts";

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

export type NatureDeNote = "idee" | "eviter";

/* Deux natures à l'écran pour sept catégories au contrat. « À éviter » se
   distingue parce que la fiche la dessine autrement — en pointillé, sans fond :
   c'est un garde-fou, pas une suggestion. Tout le reste est une matière à
   utiliser, y compris une note que le système n'a pas su ranger. */
export function natureDeLaNote(note: Note): NatureDeNote {
  return note.categories.includes("dislikes_nogo") ? "eviter" : "idee";
}

/* Les « intérêts » n'ont pas de champ au contrat — ce sont des notes d'une
   catégorie. La fiche les montre en étiquettes plutôt qu'en cartes : un mot
   par carte gaspillerait l'écran, et le handoff les dessine en rangée.

   Une note rangée en intérêt ne reparaît pas plus bas, même si elle porte une
   seconde catégorie : elle serait lue deux fois. */
export function interetsEtNotes(notes: readonly Note[]): {
  interets: Note[];
  cartes: Note[];
} {
  const interets: Note[] = [];
  const cartes: Note[] = [];
  for (const note of notes) {
    (note.categories.includes("interests") ? interets : cartes).push(note);
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
