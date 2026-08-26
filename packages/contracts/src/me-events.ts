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

// Une date civile sans heure : « aujourd'hui » désigne autre chose selon
// l'endroit, et le calcul se fait dans le fuseau de l'utilisateur.
export const dateCivileSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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

// ── Récurrences ─────────────────────────────────────────────────────────────

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

export const createEventSchema = z.object({
  personId: z.string().uuid(),
  kind: z.enum(EVENT_KINDS),
  label: z.string().trim().min(1).max(120).optional(),
  nature: z.enum(EVENT_NATURES).optional(),
  referenceDate: dateAVenirSchema,
  schedules: z.array(scheduleSchema).max(6).optional(),
}).strict().refine(
  (v) => v.kind !== "other" || Boolean(v.label),
  { path: ["label"], message: "un événement libre porte son libellé" },
);

export type CreateEventInput = z.infer<typeof createEventSchema>;

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
}).strict();

export type ListOccurrencesQuery = z.infer<typeof listOccurrencesQuerySchema>;
