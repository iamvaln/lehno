import { z } from "zod";

/* Les événements, leurs récurrences et leurs échéances — spec technique §5.2,
 * dictionnaire de données : Event, Schedule, EventOccurrence.
 *
 * Les proches et les notes ne sont pas ici : ils appartiennent à `me.ts`, que
 * le plan de la phase 1 écrit. Deux définitions de Person seraient une de trop.
 */

// Routage d'interface, pas taxonomie : un anniversaire se présente autrement.
export const EVENT_KINDS = ["birthday", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

// La tonalité commande le ton de ce qui sera écrit, et fait disparaître les
// idées de cadeau sur un événement sensible.
export const EVENT_NATURES = ["happy", "sensitive"] as const;
export type EventNature = (typeof EVENT_NATURES)[number];

// Combien de jours porte un mois, février mis à part. Indexé par le mois réel
// moins un.
const JOURS_PAR_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/* La règle séculaire, et elle n'est pas décorative : 1900 est divisible par
   quatre et n'est PAS bissextile, 2000 l'est parce que divisible par quatre
   cents. Une garde écrite en « % 4 » seul ouvrirait un 1900-02-29 qui n'a
   jamais existé, et fermerait un 2000-02-29 qui est précisément l'année de
   support des naissances dont on ignore l'année. */
function bissextile(annee: number): boolean {
  return annee % 4 === 0 && (annee % 100 !== 0 || annee % 400 === 0);
}

/* LE CALENDRIER, pas la forme.
 *
 * `^\d{4}-\d{2}-\d{2}$` seul laissait passer « 1990-02-31 » et
 * « 2025-13-45 » : c'est une forme, pas une date. Ce qui suit est pire qu'un
 * refus — l'API convertit par `new Date("1990-02-31T00:00:00Z")`, qui ne lève
 * pas et DÉBORDE sur le 3 mars ; la fiche garde alors une date que personne
 * n'a saisie, sans que rien ne le signale.
 *
 * On COMPTE les jours du mois plutôt que de relire ce qu'un `Date` rend, et ce
 * n'est pas qu'une affaire de goût : `Date.UTC(99, 0, 1)` répond 1999, donc
 * une comparaison de l'année demandée à l'année rendue rejetterait « 0099 » —
 * absurde, mais absurde n'est pas impossible, et cette garde ne doit refuser
 * que l'impossible. */
function existeAuCalendrier(valeur: string): boolean {
  const annee = Number(valeur.slice(0, 4));
  const mois = Number(valeur.slice(5, 7));
  const jour = Number(valeur.slice(8, 10));
  if (mois < 1 || mois > 12 || jour < 1) return false;
  const plafond = mois === 2 && bissextile(annee) ? 29 : JOURS_PAR_MOIS[mois - 1]!;
  return jour <= plafond;
}

// Une date civile sans heure : « aujourd'hui » désigne autre chose selon
// l'endroit, et le calcul se fait dans le fuseau de l'utilisateur.
//
// La forme D'ABORD, le calendrier ensuite : le `.refine()` ne s'exécute que
// sur une chaîne qui a déjà la bonne forme, et peut donc découper sans
// vérifier ce qu'il découpe.
export const dateCivileSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
  existeAuCalendrier,
  { message: "cette date n'existe pas au calendrier" },
);

// ── Récurrences ─────────────────────────────────────────────────────────────
//
// Définies AVANT `eventSchema`, qui les lit pour rendre les `schedules` d'un
// événement : une const ne peut pas se référer à une autre déclarée plus loin
// dans le fichier.

export const SCHEDULE_TYPES = ["recurrent", "offset"] as const;
export const SCHEDULE_UNITS = ["day", "week", "month", "quarter", "year"] as const;
export const OFFSET_UNITS = ["day", "month"] as const;

/* La base impose ces règles par une contrainte `check`. Les porter ici les fait
   valoir à la saisie plutôt qu'au bout du réseau — et le refus des deux formes
   mêlées vient de la même contrainte : une règle est récurrente ou décalée. */
export const scheduleSchema = z.object({
  type: z.enum(SCHEDULE_TYPES),
  unit: z.enum(SCHEDULE_UNITS).optional(),
  // « tous les 0 ans » n'est pas une récurrence : c'est une boucle sans fin
  // quand le serveur engendre les échéances suivantes.
  interval: z.number().int().positive().optional(),
  offsetUnit: z.enum(OFFSET_UNITS).optional(),
  offsetAmount: z.number().int().optional(),
  leadTimeDays: z.number().int().min(0).optional(),
}).strict().superRefine((v, ctx) => {
  const recurrente = v.unit !== undefined || v.interval !== undefined;
  const decalee = v.offsetUnit !== undefined || v.offsetAmount !== undefined;

  if (recurrente && decalee) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "une règle est récurrente ou décalée, pas les deux" });
    return;
  }
  if (v.type === "recurrent" && (v.unit === undefined || v.interval === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "une règle récurrente porte son unité et son intervalle" });
  }
  if (v.type === "offset" && (v.offsetUnit === undefined || v.offsetAmount === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "une règle décalée porte son unité et son décalage" });
  }
});

export type Schedule = z.infer<typeof scheduleSchema>;

export const eventSchema = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid(),
  // Un `birthday` prend son libellé dans les traductions de l'application ; un
  // `other` affiche le sien tel quel, sans traduction — c'est du contenu.
  label: z.string().max(120).nullable(),
  kind: z.enum(EVENT_KINDS),
  nature: z.enum(EVENT_NATURES),
  // Toujours à venir : un événement dit quand la chose SERA.
  referenceDate: dateCivileSchema,
  // Les règles enregistrées, TOUJOURS rendues — vide plutôt qu'absent, pour
  // qu'un tableau vide et une omission ne puissent pas se confondre. Sans ce
  // champ, rouvrir un événement pour le modifier (§3.6) ne pourrait pas
  // montrer ce qui a été saisi : la répétition s'écrirait et ne se relirait
  // jamais.
  schedules: z.array(scheduleSchema).max(6),
}).strict();

export type Event = z.infer<typeof eventSchema>;

/* Cent ans en arrière, pas davantage. Une date de naissance plus ancienne est
   une faute de frappe — un 1825 pour 1925 — et l'accepter ferait paraître un
   proche de deux siècles sur une fiche, avec un âge que personne ne relira. */
export const AGE_MAXIMAL_ANNEES = 100;

function aujourdHuiCivil(): string {
  return new Date().toISOString().slice(0, 10);
}

/* Les bornes d'une date de NAISSANCE, appliquées là où l'on voit aussi si
 * l'année est connue — voir `createPersonSchema`.
 *
 * Elle vit sur le proche, pas sur un événement : c'est un fait de son
 * identité. L'anniversaire n'en est qu'une conséquence — le prochain jour de
 * l'année portant le même jour et le même mois.
 *
 * Les comparaisons se font en chaînes « YYYY-MM-DD », qui s'ordonnent
 * lexicographiquement : aucun objet Date, donc aucun fuseau qui déciderait
 * qu'« aujourd'hui » commence ailleurs.
 */
export function bornerLaNaissance(
  valeur: string,
  anneeConnue: boolean,
  ctx: z.RefinementCtx,
  chemin: (string | number)[],
): void {
  // Année inconnue : seuls le jour et le mois comptent. L'année stockée n'est
  // qu'un support, et la borner n'aurait aucun sens — la borne existe pour
  // attraper une faute de frappe SUR L'ANNÉE, et il n'y en a pas à se tromper.
  if (!anneeConnue) return;

  const jour = aujourdHuiCivil();
  if (valeur > jour) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: chemin,
      message: "une date de naissance ne peut pas être dans le futur",
    });
  }
  const limite = `${Number(jour.slice(0, 4)) - AGE_MAXIMAL_ANNEES}${jour.slice(4)}`;
  if (valeur < limite) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom, path: chemin,
      message: `une date de naissance ne remonte pas à plus de ${AGE_MAXIMAL_ANNEES} ans`,
    });
  }
}

/* La date d'un événement : TOUJOURS à venir.
 *
 * Un événement dit quand la chose SERA — un mariage, une soutenance, un
 * départ. La créer dans le passé n'ouvrirait aucune échéance utile, et la
 * fiche annoncerait une préparation pour une date révolue.
 *
 * Un anniversaire n'échappe pas à la règle : sa date d'ancrage est la
 * PROCHAINE échéance, calculée depuis la naissance du proche — pas la
 * naissance elle-même. */
export const dateAVenirSchema = dateCivileSchema.refine(
  (valeur) => valeur >= aujourdHuiCivil(),
  { message: "la date d'un événement ne peut pas être dans le passé" },
);

export const createEventSchema = z.object({
  personId: z.string().uuid(),
  kind: z.enum(EVENT_KINDS),
  label: z.string().trim().min(1).max(120).optional(),
  nature: z.enum(EVENT_NATURES).optional(),
  // Facultative pour un anniversaire : elle se CALCULE depuis la naissance du
  // proche, jamais depuis la saisie. Pour tout autre événement, elle reste
  // requise — voir le .refine() plus bas, qui porte cette condition, ni
  // touchée ni assouplie.
  referenceDate: dateAVenirSchema.optional(),
  // Les règles se composent au formulaire (§3.6) : « chaque année pour un
  // anniversaire ; à échéances multiples pour un événement qui en compte
  // plusieurs — par exemple un mois puis trois mois après une date ». D'où un
  // TABLEAU : une relation unique rendrait ce cas inexprimable.
  //
  // Facultatif : un anniversaire reçoit sa règle annuelle sans qu'on la demande,
  // et l'utilisateur n'a rien à composer pour le cas ordinaire.
  schedules: z.array(scheduleSchema).max(6).optional(),
}).strict().refine(
  (v) => v.kind !== "other" || Boolean(v.label),
  { path: ["label"], message: "un événement libre porte son libellé" },
).refine(
  (v) => v.kind === "birthday" || v.referenceDate !== undefined,
  {
    path: ["referenceDate"],
    message: "un événement porte sa date à venir, sauf un anniversaire qui la calcule depuis la naissance du proche",
  },
);

export type CreateEventInput = z.infer<typeof createEventSchema>;

/* La correction d'un événement. Dérivée de la création plutôt que réécrite —
   deux déclarations divergeraient, et la validation d'une correction finirait
   par être plus laxiste que celle d'une création.

   `createEventSchema` porte un `.refine()` et devient un ZodEffects, sur lequel
   `.partial()` n'existe pas : on repart donc de la forme d'objet, à laquelle on
   retire `personId`. Un événement ne change pas de proche — le déplacer serait
   le supprimer et le recréer, pas le corriger.

   `schedules`, fourni, REMPLACE le jeu de règles en entier — il ne se fusionne
   pas règle par règle. Trois raisons :
   - Le formulaire (§3.6) COMPOSE un jeu entier à l'écran, comme à la création ;
     l'utilisateur n'y édite jamais « la troisième règle », il voit et corrige
     l'ensemble. Le client a donc déjà le jeu complet en main au moment
     d'enregistrer — l'envoyer en entier ne lui coûte rien de plus.
   - Un remplacement règle par règle demanderait à chaque règle un identifiant
     stable que le client doit suivre entre deux ouvertures du formulaire, pour
     un objet que personne ne manipule un par un : beaucoup de surface pour un
     besoin qui n'existe pas.
   - C'est la panne la plus facile à faire sans s'en apercevoir qui tranche :
     un patch partiel qui oublierait de supprimer une règle retirée à l'écran
     la laisserait vivre EN SILENCE à côté des nouvelles — la fiche montre le
     nouveau jeu, le serveur continue d'exécuter l'ancien avec. Un remplacement
     entier rend ça structurellement impossible : ce qui reste après un
     enregistrement est TOUJOURS exactement, et seulement, ce qui a été soumis.
   Un tableau vide y est valide et remet l'événement sans aucune règle — voir
   `EventService.update`, qui alors n'ouvre plus que l'échéance de la date de
   référence elle-même. */
export const updateEventSchema = z.object({
  kind: z.enum(EVENT_KINDS).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  nature: z.enum(EVENT_NATURES).optional(),
  referenceDate: dateCivileSchema.optional(),
  schedules: z.array(scheduleSchema).max(6).optional(),
}).strict().refine((v) => Object.keys(v).length > 0, {
  message: "au moins un champ doit être fourni",
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// ── Échéances ───────────────────────────────────────────────────────────────

export const OCCURRENCE_STATUSES = ["upcoming", "collecting", "closed"] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

/* Ce que `/me/occurrences` rend, et que l'accueil comme la vue Dates affichent
   tel quel. Le nom du proche voyage avec l'échéance : sans lui, chaque carte
   d'une liste demanderait sa fiche, et l'accueil ferait quatre appels. */
export const occurrenceSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  personId: z.string().uuid(),
  personDisplayName: z.string(),
  /* DE QUI EST CETTE DATE — §13.2, 12 septembre.
   *
   * Il manquait, et le client devait le redéduire : relire le carnet pour
   * retrouver quelle `personId` est la sienne, SUR CHAQUE ÉCRAN qui montre une
   * échéance. Un appel de plus par écran pour un booléen que le serveur connaît
   * déjà — et la définition d'un filtre qu'une surface sur trois oubliera.
   *
   * Ce qu'il coûtait : l'accueil affichait « Valentine · Anniversaire · J−57 »
   * avec « Préparer » et « Marquer envoyé », et l'accusé disait « Envoyé à
   * Valentine » — à Valentine. Une fois là, les surfaces peuvent donner à sa
   * propre date les gestes qui lui vont : préparer sa liste, la partager. */
  isSelf: z.boolean(),
  /* LE BROUILLON QUI ATTEND D'ÊTRE MARQUÉ ENVOYÉ, ou nul.
   *
   * « Marquer envoyé » est un geste DÉCLARATIF — voir `updateMessageSchema` —
   * et il n'a de sens que s'il y a quelque chose à déclarer : un message
   * produit (`generated` ou `edited`), pas encore `sent` ni `rejected`.
   *
   * Sans ce champ, la carte de l'accueil ne pouvait pas le savoir et proposait
   * le geste dès que la NATURE « message » était ouverte sur le compte —
   * qu'un brouillon existe ou non. On enregistrait alors une affirmation sur
   * un message qui n'existait pas, et l'accusé nommait un envoi qui n'avait
   * pas eu lieu.
   *
   * Le plus récent quand il y en a plusieurs — « Refaire » en laisse parfois
   * deux en vie le temps d'un aller-retour. Servi ici plutôt que redemandé :
   * un second appel par carte n'est pas une option, et le serveur le sait déjà
   * en construisant l'échéance. */
  draftMessageId: z.string().uuid().nullable(),
  kind: z.enum(EVENT_KINDS),
  nature: z.enum(EVENT_NATURES),
  label: z.string().max(120).nullable(),
  occurrenceDate: dateCivileSchema,
  occurrenceYear: z.number().int().nullable(),
  status: z.enum(OCCURRENCE_STATUSES),
  // Négatif pour une échéance passée : la vue Dates montre le mois écoulé, et
  // un décompte non signé rendrait « J−3 » trois jours après la date.
  daysUntil: z.number().int(),
  // Vide quand l'année de naissance n'est pas connue. Nullable plutôt
  // qu'absent : l'écran est obligé de traiter le cas au lieu de l'oublier.
  age: z.number().int().nullable(),
}).strict();

export type Occurrence = z.infer<typeof occurrenceSchema>;

/* La fenêtre et le plafond : l'accueil demande trois échéances, la vue Dates un
   mois. C'est le même appel paramétré — les deux surfaces ne divergent pas. */
export const listOccurrencesQuerySchema = z.object({
  from: dateCivileSchema.optional(),
  to: dateCivileSchema.optional(),
  limit: z.number().int().positive().max(200).optional(),
  // La fiche d'un proche (maquette §3.4) montre SES échéances et SON
  // historique. Sans ce filtre, le mobile tire tout et trie chez lui : tenable
  // à dix proches, plus à cent, et le plafond couperait avant le tri.
  personId: z.string().uuid().optional(),
}).strict();

export type ListOccurrencesQuery = z.infer<typeof listOccurrencesQuerySchema>;

/* Même besoin sur les événements : « la liste des événements du proche »
   (maquette §3.4), à côté de l'annuaire complet que rend le chemin nu. */
export const listEventsQuerySchema = z.object({
  personId: z.string().uuid().optional(),
}).strict();

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
