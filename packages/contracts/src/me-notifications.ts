import { z } from "zod";

/* Les préférences de notification (§3.11) et le centre de notifications
 * (§3.13). Séparés du fourre-tout de me-app.ts : assez de règles propres —
 * ce qui part toujours, ce qui se règle, ce qui vaut par défaut — pour
 * mériter leur fichier.
 */

// ── Les types de notification ───────────────────────────────────────────────

export const NOTIFICATION_TYPES = [
  "event_reminder", "event_day_of", "digest", "contribution_received",
  "wish_received", "enrichment_nudge_global", "enrichment_nudge_person",
  "generation_ready", "payment_succeeded", "payment_failed", "credits_received",
  "login_code", "security", "account",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/* La maquette (§3.11) groupe ces types en cinq NATURES affichées à l'écran —
   rappel d'échéance, récapitulatif, contributions à valider, relances, vie du
   compte. On ne rejoue PAS ce groupement ici : chaque type se règle seul,
   et l'écran décide lui-même quels boutons il rassemble sous quel titre.
   Coder le groupement côté serveur créerait une SECONDE source de vérité —
   la maquette évoluerait, ce fichier resterait figé — pour un regroupement
   qui n'a aucun effet sur ce qui part ou non : il ne change que
   l'AFFICHAGE, jamais l'envoi. Un client qui ignore le groupement (l'API
   admin, par exemple) n'a donc rien à en apprendre. */

/* Trois natures partent quelles que soient les préférences : un code de
   connexion, une alerte de sécurité, un fait de compte (§3.11 : « les
   messages de sécurité arrivent toujours »). Les laisser régler afficherait
   un interrupteur sans effet — et un interrupteur sans effet apprend à ne
   pas croire les interrupteurs. Le refus se pose ICI, dans le contrat, pour
   qu'aucun appelant du serveur ne puisse l'oublier — pas seulement l'écran. */
export const ALWAYS_SENT_NOTIFICATIONS = ["login_code", "security", "account"] as const;

export const CONFIGURABLE_NOTIFICATION_TYPES = NOTIFICATION_TYPES.filter(
  (type): type is Exclude<NotificationType, (typeof ALWAYS_SENT_NOTIFICATIONS)[number]> =>
    !(ALWAYS_SENT_NOTIFICATIONS as readonly string[]).includes(type),
);

// ── Les préférences ──────────────────────────────────────────────────────────

/* Les trois fréquences du récapitulatif (§3.11 : « chaque mois, chaque
   semaine, ou jamais »). Le champ vit ici et pas dans /me/profile : la
   maquette le range sous « Préférences de notification », pas sous
   « Heure d'envoi » — à la différence de `sendHour` et `timezone`, qui
   valent pour toutes les natures et restent donc servis par /me/profile. */
export const DIGEST_FREQUENCIES = ["monthly", "weekly", "never"] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];

const notificationPreferenceSchema = z.object({
  type: z.enum(CONFIGURABLE_NOTIFICATION_TYPES as [NotificationType, ...NotificationType[]]),
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
}).strict();

export type NotificationPreferenceItem = z.infer<typeof notificationPreferenceSchema>;

/* Une ligne absente vaut le défaut (poussée ET courriel activés) : le
   serveur rend donc l'état EFFECTIF de chaque type configurable, qu'une
   ligne existe en base ou non. Sans ça, le client devrait connaître et
   rejouer ce défaut lui-même — une règle métier qui n'a rien à faire côté
   client. */
export const notificationPreferencesSchema = z.object({
  preferences: z.array(notificationPreferenceSchema),
  digestFrequency: z.enum(DIGEST_FREQUENCIES),
}).strict();

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const updateNotificationPreferencesSchema = z.object({
  preferences: z.array(notificationPreferenceSchema).optional(),
  digestFrequency: z.enum(DIGEST_FREQUENCIES).optional(),
}).strict().refine(
  (v) => (v.preferences && v.preferences.length > 0) || v.digestFrequency !== undefined,
  { message: "au moins un champ" },
);

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

// ── Le centre de notifications (§3.13) ──────────────────────────────────────

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
