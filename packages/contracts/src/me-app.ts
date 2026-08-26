import { z } from "zod";
import { EVENT_KINDS, EVENT_NATURES, SCHEDULE_UNITS } from "./me-events.js";
import {
  CATEGORY_CODES, PERSON_RELATIONS, PERSON_REGISTERS, PERSON_GENDERS, CONTACT_CHANNELS,
} from "./me.js";

/* Le Mur, les notifications, la recherche, les reprises et les métadonnées —
 * spec technique §5.5, §5.7 et §5.8.
 */

// ── Le Mur ──────────────────────────────────────────────────────────────────

export const wallSchema = z.object({
  slug: z.string(),
  isEnabled: z.boolean(),
  showBirthdayDate: z.boolean(),
  // S'affiche sous le message d'accueil que le produit compose à partir du
  // prénom : il l'accompagne, il ne le remplace pas.
  welcomeMessage: z.string().nullable(),
  // L'adresse existe avant la publication — l'écran la montre pour qu'on sache
  // ce qu'on s'apprête à ouvrir.
  publicUrl: z.string().url(),
  /* « Le Mur expose le lien de l'occurrence courante ; une nouvelle occurrence
     chaque année ⇒ un nouveau lien. » Hors fenêtre de vœux, il n'y en a pas. */
  wishLinkUrl: z.string().url().nullable(),
}).strict();

export type Wall = z.infer<typeof wallSchema>;

export const updateWallSchema = z.object({
  isEnabled: z.boolean().optional(),
  showBirthdayDate: z.boolean().optional(),
  welcomeMessage: z.string().trim().max(500).nullable().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: "au moins un champ" });

export type UpdateWallInput = z.infer<typeof updateWallSchema>;

// ── Les notifications ───────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  "event_reminder", "event_day_of", "digest", "contribution_received",
  "wish_received", "enrichment_nudge_global", "enrichment_nudge_person",
  "generation_ready", "payment_succeeded", "payment_failed", "credits_received",
  "login_code", "security", "account",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/* Trois natures partent quelles que soient les préférences : un code de
   connexion, une alerte de sécurité, un fait de compte. Les laisser régler
   afficherait un interrupteur sans effet — et un interrupteur sans effet
   apprend à ne pas croire les interrupteurs. */
export const ALWAYS_SENT_NOTIFICATIONS = ["login_code", "security", "account"] as const;

export const CONFIGURABLE_NOTIFICATION_TYPES = NOTIFICATION_TYPES.filter(
  (type): type is Exclude<NotificationType, (typeof ALWAYS_SENT_NOTIFICATIONS)[number]> =>
    !(ALWAYS_SENT_NOTIFICATIONS as readonly string[]).includes(type),
);

/* Le serveur transporte des clés, jamais des phrases : la langue d'interface
   peut changer après l'envoi, et une notification émise il y a trois semaines
   en français doit se relire en anglais si l'utilisateur a changé depuis.
   C'est l'inverse du catalogue du studio, dont les libellés arrivent résolus —
   lui est servi à l'instant où il s'affiche, et il n'a rien à traverser. */
export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  titleKey: z.string().max(60),
  // Les valeurs à insérer dans le gabarit traduit : prénom, date, nombre.
  bodyParams: z.record(z.string(), z.union([z.string(), z.number()])).nullable(),
  // « Une notification mène là où l'on agit » — directement à l'écran concerné,
  // sans passer par la liste.
  targetRoute: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
}).strict();

export type Notification = z.infer<typeof notificationSchema>;

export const updateNotificationPreferencesSchema = z.object({
  preferences: z.array(z.object({
    type: z.enum(CONFIGURABLE_NOTIFICATION_TYPES as [NotificationType, ...NotificationType[]]),
    pushEnabled: z.boolean(),
    emailEnabled: z.boolean(),
  }).strict()).min(1),
  // L'heure d'envoi vaut pour toutes les natures : elle vit sur le compte, pas
  // sur une préférence.
  sendHour: z.number().int().min(0).max(23).optional(),
  digestFrequency: z.enum(["monthly", "weekly", "never"]).optional(),
}).strict();

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

// ── La recherche ────────────────────────────────────────────────────────────

/* Chaque ligne reprend la présentation de l'annuaire : de quoi reconnaître la
   bonne personne sans ouvrir sa fiche. */
export const searchResultSchema = z.object({
  personId: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  /* Un proche sans date n'a pas de prochaine échéance, et la recherche doit
     quand même le rendre : c'est souvent lui qu'on cherche, précisément pour
     lui en ajouter une. */
  nextOccurrenceKind: z.enum(EVENT_KINDS).nullable(),
  nextOccurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  daysUntil: z.number().int().nullable(),
}).strict();

export type SearchResult = z.infer<typeof searchResultSchema>;

// ── Les reprises ────────────────────────────────────────────────────────────

export const RESUMABLE_KINDS = ["message_draft", "portrait"] as const;

// L'état où en est l'élément, que la ligne affiche telle quelle.
export const RESUMABLE_STATES = ["draft", "to_approve", "to_share"] as const;

/* « Rien ne se perd : ce qu'on a lancé se retrouve ici. » Classées par urgence —
   ce qui touche une échéance proche vient en tête, puis les plus récents. */
export const resumableSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(RESUMABLE_KINDS),
  state: z.enum(RESUMABLE_STATES),
  personId: z.string().uuid(),
  personDisplayName: z.string(),
  /* Un portrait se génère hors de toute échéance : il n'a ni occasion ni
     décompte, et le classement par urgence le range après ceux qui en ont. */
  occurrenceId: z.string().uuid().nullable(),
  daysUntil: z.number().int().nullable(),
  updatedAt: z.string(),
}).strict();

export type Resumable = z.infer<typeof resumableSchema>;

// ── Les métadonnées ─────────────────────────────────────────────────────────

/* Les valeurs dont les écrans composent leurs listes. La plupart sont des
 * énumérations FIGÉES qu'un client typé connaît déjà à la compilation — les
 * servir ici évite seulement d'aller les chercher à deux endroits.
 *
 * `categories` est la seule à ne PAS l'être : `Category` vit en base, et
 * porte `kind` et `isConstraint`. Un client ne peut déduire d'aucune
 * énumération nue que `dislikes_nogo` est une contrainte ACTIVE — or c'est ce
 * qui change ce que le produit PROPOSE, pas seulement ce qu'il affiche.
 *
 * Aucun libellé ici : ils vivent dans les ressources de traduction de
 * l'application, indexés par `code`. En rendre depuis le serveur ferait deux
 * sources de vérité pour un même mot, et l'obligerait à connaître la langue
 * du demandeur. */
export const metadataSchema = z.object({
  categories: z.array(z.object({
    code: z.enum(CATEGORY_CODES),
    kind: z.enum(["ponctuelle", "durable"]),
    isConstraint: z.boolean(),
  }).strict()),
  eventKinds: z.array(z.enum(EVENT_KINDS)),
  eventNatures: z.array(z.enum(EVENT_NATURES)),
  scheduleUnits: z.array(z.enum(SCHEDULE_UNITS)),
  personRelations: z.array(z.enum(PERSON_RELATIONS)),
  personRegisters: z.array(z.enum(PERSON_REGISTERS)),
  personGenders: z.array(z.enum(PERSON_GENDERS)),
  contactChannels: z.array(z.enum(CONTACT_CHANNELS)),
}).strict();

export type Metadata = z.infer<typeof metadataSchema>;
