import {
  EVENT_KINDS,
  type CreateEventInput, type ErrorCode, type EventKind, type Schedule,
} from "@lehno/contracts";
import { offreLeType } from "./carnet.js";
import { exigeDeRelireLesMetadonnees } from "./arret.js";

/* L'ajout d'une date (§3.6), séparé de son affichage.
 *
 * Même motif que le carnet : `react-native` est typé en Flow, et aucun de nos
 * outils de test ne sait le lire. Les décisions vivent donc ici, où Vitest les
 * charge, et l'écran ne fait que les appliquer.
 */

// ── Le type, et qui le décide ───────────────────────────────────────────────

/* CE N'EST PAS NOUS QUI SAVONS QUELS TYPES SONT OUVERTS.
 *
 * `eventKinds` de `/me/metadata` arrive DÉJÀ FILTRÉ par le serveur. Au
 * lancement, `events.other` est éteint et la liste rend `["birthday"]` : le
 * formulaire ne propose plus « anniversaire ou autre » sans avoir la moindre
 * règle à connaître. Tester le drapeau ici referait le raisonnement du serveur
 * et s'en écarterait le jour où il change.
 *
 * L'ORDRE est le nôtre, pas celui de la réponse : l'anniversaire est mis en
 * avant (§3.6), et une liste rendue dans un autre ordre ne doit pas déplacer
 * la première pastille sous le doigt de quelqu'un.
 */
export function typesOfferts(ouverts: readonly EventKind[]): readonly EventKind[] {
  return EVENT_KINDS.filter((kind) => offreLeType(ouverts, kind));
}

/* La rangée de choix ne paraît qu'à partir de DEUX types.
 *
 * Un seul type ne se choisit pas : le montrer en case unique demanderait de
 * confirmer ce qui est déjà décidé. Ce que la rangée disait passe alors dans le
 * titre de la barre — « Nouvel anniversaire ». La rangée ne se GRISE pas non
 * plus : elle sort de l'écran.
 */
export function demandeLeChoixDuType(ouverts: readonly EventKind[]): boolean {
  return typesOfferts(ouverts).length > 1;
}

/* Le type sur lequel le formulaire s'ouvre : le premier OFFERT.
 *
 * `null` tant que la réponse n'est pas là. Ouvrir sur « anniversaire » par
 * défaut serait présumer d'une liste qu'on n'a pas lue — et c'est précisément
 * ce qui fait recevoir le filet du serveur. L'écran attend, et n'enregistre
 * rien tant qu'il ne sait pas.
 */
export function typeInitial(ouverts: readonly EventKind[]): EventKind | null {
  return typesOfferts(ouverts)[0] ?? null;
}

// ── Ce que chaque type demande ──────────────────────────────────────────────

/* LA DATE D'UN ANNIVERSAIRE NE SE SAISIT PAS ICI.
 *
 * Le contrat est net : `referenceDate` est absente pour un anniversaire, elle
 * se CALCULE depuis `person.birthDate` — la prochaine échéance à venir, jamais
 * la naissance elle-même. Des sélecteurs de jour et de mois seraient donc du
 * décor : on choisirait le 4 mars et l'événement tomberait à la date que porte
 * la fiche. Le bloc « La date » reste, mais en LECTURE — ce que Lehno a
 * calculé, et dans combien de jours.
 *
 * C'est le seul écart au kit qui retire quelque chose, et il retire une
 * commande qui n'agissait sur rien.
 */
export function demandeLaDate(kind: EventKind): boolean {
  return kind === "other";
}

/* L'année n'est une question QUE pour un événement libre — et encore, entre
   deux valeurs seulement : celle où la date tombe ensuite, et la suivante. Un
   anniversaire tombe à sa prochaine occurrence, il n'y a rien à trancher. */
export function demandeLAnnee(kind: EventKind): boolean {
  return kind === "other";
}

/* Un événement libre porte son libellé, et le contrat le refuse sans lui. Un
   anniversaire prend le sien dans les traductions — l'écrire en dur ferait
   dire « Anniversaire » en français à qui lit l'application en anglais. */
export function demandeLeLibelle(kind: EventKind): boolean {
  return kind === "other";
}

// ── L'arithmétique des dates civiles ────────────────────────────────────────

/* En CHAÎNES « YYYY-MM-DD », de bout en bout, comme le serveur.
 *
 * Une date civile n'a pas d'heure : la construire en heure locale la fait
 * reculer d'un jour à l'ouest de Greenwich, et l'anniversaire de quelqu'un
 * changerait de jour selon l'endroit d'où on le regarde. Les chaînes
 * s'ordonnent lexicographiquement, ce qui suffit à comparer deux dates.
 */

function decompose(civile: string): [number, number, number] {
  const [a, m, j] = civile.split("-").map(Number);
  return [a ?? 0, m ?? 1, j ?? 1];
}

function compose(annee: number, mois: number, jour: number): string {
  return `${String(annee).padStart(4, "0")}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

// Bissextile : divisible par 4, sauf les siècles non divisibles par 400.
function bissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

export function joursDuMois(annee: number, mois: number): number {
  if (mois === 2 && bissextile(annee)) return 29;
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mois - 1] ?? 31;
}

/* Le jour retenu ne dépasse jamais le mois. Le 31 choisi puis le mois passé à
   avril donne le 30, pas un 31 avril que personne ne rattraperait ensuite —
   le kit le fait déjà, et c'est le sélecteur qui rétrécit sous le doigt. */
export function borneLeJour(jour: number, mois: number, annee: number): number {
  return Math.min(Math.max(1, jour), joursDuMois(annee, mois));
}

/* « Aujourd'hui » dans le fuseau de l'utilisateur, pas en UTC : c'est là qu'il
   vit, et c'est ce que le dictionnaire de données demande. */
export function aujourdhuiCivil(maintenant: Date): string {
  return compose(maintenant.getFullYear(), maintenant.getMonth() + 1, maintenant.getDate());
}

/* LA PROCHAINE ÉCHÉANCE D'UN ANNIVERSAIRE, jamais la naissance.
 *
 * Le jour même compte : un anniversaire qui tombe aujourd'hui est à venir, pas
 * dans un an. C'est la règle du serveur (`echeances` part de `depuis` inclus),
 * et deux réponses différentes feraient afficher une date que la fiche
 * contredit.
 *
 * Un 29 février se marque le 28 les années communes — le dictionnaire de
 * données tranche ainsi, « ramenée au dernier jour de ce mois ».
 */
export function prochaineEcheance(naissance: string, aujourdhui: string): string {
  const [, mois, jour] = decompose(naissance);
  const cette = Number(aujourdhui.slice(0, 4));
  const candidate = (annee: number): string =>
    compose(annee, mois, borneLeJour(jour, mois, annee));
  const ici = candidate(cette);
  return ici >= aujourdhui ? ici : candidate(cette + 1);
}

/* L'ANNÉE N'EST PAS UNE QUESTION OUVERTE : c'est celle où le jour et le mois
   choisis tombent ensuite, ou la suivante. Jamais en arrière — le contrat
   refuse une date d'événement passée, et proposer 2025 ferait composer une
   saisie que le serveur rejette au bout du réseau. */
export function anneesOffertes(
  jour: number, mois: number, aujourdhui: string,
): readonly [number, number] {
  const cette = Number(aujourdhui.slice(0, 4));
  const premiere = compose(cette, mois, borneLeJour(jour, mois, cette)) >= aujourdhui
    ? cette : cette + 1;
  return [premiere, premiere + 1];
}

/* La date composée par le formulaire d'un événement libre. Le jour se borne au
   mois retenu de l'année retenue : février 2028 en porte 29, février 2027 non. */
export function dateDEvenement(jour: number, mois: number, annee: number): string {
  return compose(annee, mois, borneLeJour(jour, mois, annee));
}

/* Le décompte que la ligne annonce — « dans 12 jours ».
 *
 * Deux dates civiles se comparent en UTC : aucune des deux n'a d'heure, donc
 * aucun changement d'heure d'été ne vient rogner une journée. */
export function joursJusqua(civile: string, aujourdhui: string): number {
  const enJours = (d: string): number => {
    const [a, m, j] = decompose(d);
    return Date.UTC(a, m - 1, j) / 86400000;
  };
  return enJours(civile) - enJours(aujourdhui);
}

/* La date en toutes lettres, sous les sélecteurs : « mardi 4 mars 2027 ».
 *
 * `Intl` plutôt qu'une table de mois — Hermes l'embarque, et une table à nous
 * serait à retraduire à chaque langue ajoutée. En UTC, pour la même raison que
 * `dateCourte` : une date civile lue dans un fuseau à l'ouest reculerait d'un
 * jour à l'affichage. */
export function enToutesLettres(civile: string, langue: string): string {
  const [a, m, j] = decompose(civile);
  return new Intl.DateTimeFormat(langue, {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, j)));
}

/* Les mois dans la langue de l'écran, pour le sélecteur. Rang 1 à 12, comme
   partout ailleurs ici : un mois indexé à zéro d'un côté et à un de l'autre est
   la faute qu'on ne voit qu'en décembre. */
export function nomsDesMois(langue: string): readonly string[] {
  const format = new Intl.DateTimeFormat(langue, { month: "long", timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(Date.UTC(2027, i, 1))));
}

// ── Le rappel ───────────────────────────────────────────────────────────────

/* LE DICTIONNAIRE PORTE LES MOTS, CE TABLEAU PORTE LES JOURS, et l'ordre est le
 * contrat entre les deux — « Le jour même » vaut zéro, « Un mois avant » vaut
 * trente. Les mots ne peuvent pas vivre ici : les règles de pluriel diffèrent
 * d'une langue à l'autre. Les jours ne peuvent pas vivre là-bas : le
 * dictionnaire ne porte que du texte.
 *
 * Une option ajoutée d'un seul côté casse la correspondance en silence — d'où
 * le test qui ancre la longueur des deux, et le rang du choix par défaut.
 */
export const JOURS_DE_RAPPEL: readonly number[] = [0, 1, 3, 7, 14, 30];

// « Une semaine avant », ce que le kit montre à l'ouverture.
export const RANG_DE_RAPPEL_PAR_DEFAUT = 3;

/* LE DÉLAI SE POSE SUR UNE RÈGLE, il n'existe pas seul : `leadTimeDays` est un
 * champ de `schedule`, et une règle est récurrente ou décalée, jamais les deux.
 *
 * Un anniversaire a la sienne — chaque année —, et c'est celle-là qu'on renvoie
 * telle quelle avec le délai. C'est nécessaire : le serveur applique sa règle
 * annuelle par défaut SEULEMENT quand `schedules` est absent, donc envoyer un
 * délai sans réécrire l'annuelle ferait perdre la récurrence.
 *
 * Un événement libre n'en a aucune : il tombe une fois. La seule forme qui ne
 * lui invente pas d'échéance supplémentaire est un décalage NUL depuis sa date
 * de référence — sa propre date, portant son délai. Une règle annuelle ferait
 * revenir un mariage tous les ans.
 */
export function regleDeRappel(kind: EventKind, joursAvant: number): Schedule[] {
  if (kind === "birthday") {
    return [{ type: "recurrent", unit: "year", interval: 1, leadTimeDays: joursAvant }];
  }
  return [{ type: "offset", offsetUnit: "day", offsetAmount: 0, leadTimeDays: joursAvant }];
}

// ── Ce qui part au serveur ──────────────────────────────────────────────────

export interface SaisieDEvenement {
  personId: string;
  kind: EventKind;
  // Pour un événement libre seulement ; ignoré pour un anniversaire.
  libelle: string;
  // La date composée, pour un événement libre. Un anniversaire n'en porte pas.
  date: string;
  rangDuRappel: number;
}

/* Le corps de `POST /me/events`.
 *
 * UN ANNIVERSAIRE NE PORTE NI LIBELLÉ NI DATE. Les envoyer quand même ne serait
 * pas neutre : le contrat est `.strict()`, mais surtout la date serait ignorée
 * au profit de `person.birthDate`, et le formulaire aurait menti sur ce qu'il
 * enregistrait.
 *
 * `nature` n'y est pas non plus : elle se DÉTECTE côté serveur et se corrige
 * après coup (§3.6). La poser à la saisie demanderait à quelqu'un de qualifier
 * une date au moment où il la note.
 */
export function corpsDeCreation(saisie: SaisieDEvenement): CreateEventInput {
  const libre = saisie.kind === "other";
  return {
    personId: saisie.personId,
    kind: saisie.kind,
    ...(libre ? { label: saisie.libelle.trim(), referenceDate: saisie.date } : {}),
    schedules: regleDeRappel(
      saisie.kind,
      JOURS_DE_RAPPEL[saisie.rangDuRappel] ?? JOURS_DE_RAPPEL[RANG_DE_RAPPEL_PAR_DEFAUT] ?? 7,
    ),
  };
}

/* Ce qui autorise l'enregistrement, et rien de plus.
 *
 * PAS de date de naissance exigée du proche : le serveur la réclame, et c'est
 * lui qui a le dernier mot. La vérifier ici ferait deux règles pour une, et la
 * nôtre se tromperait sur une fiche corrigée ailleurs entre-temps.
 */
export function pretAEnregistrer(
  saisie: { personId: string | null; kind: EventKind | null; libelle: string; date: string },
): boolean {
  if (!saisie.personId || !saisie.kind) return false;
  if (saisie.kind === "other") return Boolean(saisie.libelle.trim()) && Boolean(saisie.date);
  return true;
}

// ── Ce qu'on fait d'un refus ────────────────────────────────────────────────

/* Trois suites, et une seule se voit.
 *
 * `relire` — LE FILET. `422 resource_inactive` dit que nous avons proposé un
 *   type que la liste du serveur ne portait plus. Le contrat est net : « un
 *   client à jour ne devrait jamais le voir ». C'est un défaut CHEZ NOUS, et le
 *   traduire en message ferait porter à quelqu'un la faute d'une liste que nous
 *   n'avons pas relue. On relit les métadonnées, et on se tait.
 *
 * `deja` — le proche a déjà un anniversaire. Le serveur rend `409 conflict`, et
 *   le kit a une phrase pour ça, qui nomme la personne et la date. « Cette
 *   opération entre en conflit avec l'état actuel » ne dit rien à personne.
 *
 * `dire` — tout le reste, dont le `422 validation_failed` d'un proche sans date
 *   de naissance. Celui-là SE MONTRE : il ne vient pas d'une liste périmée mais
 *   d'une fiche incomplète, et c'est une chose que l'utilisateur peut corriger.
 */
export type SuiteDUnRefus = "relire" | "deja" | "dire";

export function lireLeRefus(statut: number, code: ErrorCode | null): SuiteDUnRefus {
  if (exigeDeRelireLesMetadonnees(statut, code)) return "relire";
  if (statut === 409 && code === "conflict") return "deja";
  return "dire";
}
