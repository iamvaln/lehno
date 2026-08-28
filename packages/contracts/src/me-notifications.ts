import { z } from "zod";

/* Les préférences de notification (§3.11) et le centre de notifications
 * (§3.13). Séparés du fourre-tout de me-app.ts : assez de règles propres —
 * ce qui part toujours, ce qui se règle, ce qui vaut par défaut — pour
 * mériter leur fichier.
 */

// ── Les types de notification ───────────────────────────────────────────────

/* L'énumération DOIT couvrir `NotificationType` du schéma Prisma, sans trou.
   Les cinq `activation_*` y manquaient : les relances d'activation posent
   pourtant de vraies lignes `in_app` (voir RelancesService), et le centre de
   notifications les aurait refusées à la lecture — une file qui se remplit
   d'entrées qu'aucun chemin ne sait rendre. Un type absent d'ici n'échoue pas
   à l'écriture, il échoue à la LECTURE, longtemps après, chez le client. */
export const NOTIFICATION_TYPES = [
  "event_reminder", "event_day_of", "digest", "contribution_received",
  "wish_received", "enrichment_nudge_global", "enrichment_nudge_person",
  "activation_first_person", "activation_first_note", "activation_unused_credits",
  "activation_collect_link", "activation_invite",
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
/* Les `activation_*` rejoignent cette liste, et ce n'est pas un élargissement
   de la règle : elles ne sont PAS réglables dans l'application non plus (voir
   le commentaire de `NotificationType` en base — « deuxième et dernière
   catégorie incoercible »). La fenêtre d'activation se referme avant que
   quiconque n'ouvre les réglages, et elles se coupent par le lien du courrier.
   Les ajouter ici garde `CONFIGURABLE_NOTIFICATION_TYPES` inchangé : l'écran
   des rappels n'y gagne aucun interrupteur, ce qui est le but. */
export const ALWAYS_SENT_NOTIFICATIONS = [
  "login_code", "security", "account",
  "activation_first_person", "activation_first_note", "activation_unused_credits",
  "activation_collect_link", "activation_invite",
] as const;

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

  /* Les deux références brutes, EN PLUS de `targetRoute`, et pas à sa place.
     Deux raisons, aucune décorative :

     — le client navigue par écran typé, pas par chaîne. Lui faire découper
       `/occurrences/<uuid>` pour retrouver l'identifiant, c'est lui faire
       réimplémenter la grammaire d'URL du serveur : le jour où elle change,
       l'application se met à ouvrir des écrans vides sans qu'aucun test ne
       tombe, puisque le serveur, lui, reste cohérent avec lui-même ;

     — les deux relations sont en `onDelete: SetNull`. Un proche supprimé vide
       `personId` mais laisse `targetRoute` pointer sur sa fiche disparue. Rendre
       les deux est ce qui permet au client de constater que la cible n'existe
       plus et de rendre l'entrée inerte, au lieu d'ouvrir un écran mort. */
  personId: z.string().uuid().nullable(),
  eventOccurrenceId: z.string().uuid().nullable(),

  readAt: z.string().nullable(),

  /* La date de l'entrée est celle où elle ENTRE dans le centre, pas celle où
     la ligne a été écrite — et les deux sont très éloignées.

     La programmation pose les rappels jusqu'à un mois d'avance (voir
     ProgrammationService et sa FENETRE_JOURS) : un rappel J-7 pour une date
     dans cinq semaines existe en base depuis quatre semaines quand il devient
     enfin visible. Servir `created_at` afficherait « il y a 28 jours » sur un
     rappel arrivé ce matin, et surtout, TRIER dessus rangerait la liste dans
     l'ordre où la requête d'échéances est sortie de la base ce jour-là — un
     ordre interne, sans rapport avec ce que la personne attend.

     `notifiedAt` vaut donc `scheduled_for`, ou `created_at` quand il est nul
     (« tout de suite »). Une seule date rendue : deux obligeraient le client à
     porter la règle qui choisit entre elles. */
  notifiedAt: z.string(),
}).strict();

export type Notification = z.infer<typeof notificationSchema>;

/* Le curseur plutôt que le numéro de page : le centre grandit PAR LE HAUT.
   Avec un `offset`, une notification arrivée entre deux pages décale tout ce
   qui suit — la dernière entrée de la page 1 réapparaît en tête de la page 2,
   et une autre disparaît sans être passée sous les yeux de personne. Le
   curseur désigne une ligne, pas un rang : ce qui s'insère au-dessus ne
   déplace rien. */
export const listNotificationsQuerySchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
  cursor: z.string().uuid().optional(),
}).strict();

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

/* `unreadCount` accompagne la liste parce que l'en-tête garde sa pastille
   affichée pendant qu'on lit le centre, et qu'elle doit s'éteindre sans un
   second aller-retour. Ce n'est PAS une seconde définition du décompte de
   `/me/home` : les deux passent par le même prédicat côté serveur
   (`perimetreDuCentre`), donc ils ne peuvent pas se contredire. Deux `where`
   recopiés, eux, auraient divergé au premier ajout. */
export const notificationsPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
}).strict();

export type NotificationsPage = z.infer<typeof notificationsPageSchema>;

/* Marquer comme lu : une LISTE d'identifiants, ou TOUT — jamais un corps vide
   qui voudrait dire l'un des deux.

   Les deux gestes existent vraiment dans §3.13 : chaque entrée « renvoie
   directement vers l'écran qui permet d'agir », donc une entrée ouverte se lit
   seule ; et la pastille doit pouvoir s'éteindre d'un coup quand on a fait le
   tour. Les servir par le même chemin évite deux points d'entrée pour un seul
   fait (« ceci est lu »).

   Ce qui est refusé, c'est le corps vide. Un `{}` qui vaudrait « tout » ferait
   qu'un client bogué — un tableau d'identifiants resté vide parce que rien
   n'était sélectionné — viderait la pastille de quelqu'un qui n'a rien lu.
   L'union rend l'intention explicite : `{ all: true }` se tape, il ne
   s'obtient pas par omission.

   L'opération est idempotente : elle POSE une date sur ce qui n'en a pas.
   Rejouée, elle ne trouve plus rien à poser et ne remonte donc pas le temps
   d'une notification déjà lue. */
export const markNotificationsReadSchema = z.union([
  z.object({ all: z.literal(true) }).strict(),
  z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).strict(),
]);

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

/* La réponse rend l'ÉTAT, pas le nombre de lignes touchées. « Trois marquées »
   au premier appel et « zéro marquée » au second décriraient deux issues
   différentes pour un même résultat, et un client finirait par lire le second
   comme un échec. Le décompte restant, lui, est le même dans les deux cas —
   c'est cela, être idempotent. */
export const notificationsReadResultSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
}).strict();

export type NotificationsReadResult = z.infer<typeof notificationsReadResultSchema>;
