import { z } from "zod";
import { usernameSchema } from "./profile.js";
import { paymentMethodSchema } from "./me-credits.js";

/* Le compte : sa suppression, ses appareils, l'export de ses données, et les
 * deux façons d'écrire à l'équipe — spec mobile §3.24, §3.11 et §3.26, spec
 * technique §5.1, §5.7 et §5.9.
 *
 * Ce fichier est séparé de me-security.ts, qui porte les connexions récentes
 * et les moyens de connexion externes. La frontière n'est pas cosmétique :
 * ces chemins-là RENDENT l'état du compte, ceux-ci le CHANGENT — et l'un
 * d'eux est irréversible passé trente jours.
 */

// ── La suppression, en trois temps ──────────────────────────────────────────

/* POURQUOI la personne s'en va. Facultatif, et il faut que ça se voie dans le
 * contrat : §3.24 dit « qu'on peut passer d'un geste ». Un motif obligatoire
 * transformerait un départ en interrogatoire, et le champ se remplirait de
 * « autre » — donc de rien.
 *
 * Le vocabulaire est celui de la personne qui part, pas celui de nos tableaux
 * de bord : « trop cher » et non « sensibilité au prix ».
 */
export const DELETION_REASONS = [
  "no_longer_useful",  // ne me sert plus
  "too_expensive",     // trop cher
  "privacy_concern",   // je ne suis pas à l'aise avec mes données ici
  "too_complicated",   // trop compliqué à utiliser
  "missing_feature",   // il manque ce dont j'ai besoin
  "temporary_break",   // je fais une pause, je reviendrai peut-être
  "other",             // autre — le champ libre prend le relais
] as const;
export type DeletionReason = (typeof DELETION_REASONS)[number];

/* CE QUI DISPARAÎT, compté avant que rien ne soit touché (§3.24, premier
 * temps : « la liste, sans détour »).
 *
 * Des DÉCOMPTES, jamais le contenu. L'écran doit dire « 47 notes » pour que le
 * geste pèse son poids ; les rendre en entier ferait de cet aperçu un second
 * export de données, avec les mêmes obligations et aucune des protections.
 */
export const deletionImpactSchema = z.object({
  persons: z.number().int().min(0),
  notes: z.number().int().min(0),
  events: z.number().int().min(0),
  wishes: z.number().int().min(0),
  generatedMessages: z.number().int().min(0),
}).strict();

export type DeletionImpact = z.infer<typeof deletionImpactSchema>;

/* LE SOLDE ET SON REMBOURSEMENT (§3.24, deuxième temps ; CGU §6).
 *
 * Trois nombres, et ils ne disent pas la même chose. `balance` est le solde
 * entier, celui que l'écran des crédits affiche. `refundable` est la part
 * ACHETÉE qui reste — la seule que les CGU promettent de rendre. La
 * différence, ce sont les crédits offerts : bienvenue, parrainage, code
 * promotionnel. Ils n'ont pas été payés, ils ne se remboursent pas, et §6 le
 * dit en toutes lettres.
 *
 * Un seul nombre laisserait l'écran choisir lequel afficher, et il finirait
 * par promettre le solde entier.
 */
export const deletionRefundSchema = z.object({
  balance: z.number().int().min(0),
  refundable: z.number().int().min(0),
  currency: z.string().length(3).nullable(),
  /* Ce que valent en argent les crédits remboursables, au tarif qui a servi à
     les acheter. Nul quand il n'y a rien à rembourser. */
  amount: z.number().nonnegative().nullable(),
  /* Les méthodes qui RÉUNISSENT les deux conditions des CGU §6 : enregistrée
     depuis plus de deux semaines, et ayant déjà servi à un paiement. Une
     liste vide, avec `refundable` non nul, est l'état que §3.24 décrit — «
     l'écran l'explique et oriente vers l'assistance ». Le client ne refait pas
     le calcul : le délai est réglable en back-office, et deux versions du parc
     appliqueraient deux règles. */
  eligibleMethods: z.array(paymentMethodSchema),
}).strict();

export type DeletionRefund = z.infer<typeof deletionRefundSchema>;

/* L'APERÇU, servi avant toute confirmation. Il ne change rien : on peut
 * l'ouvrir, le lire et fermer l'écran sans avoir rien engagé. */
export const deletionPreviewSchema = z.object({
  impact: deletionImpactSchema,
  refund: deletionRefundSchema,
  /* Combien de jours le compte reste récupérable après confirmation. Rendu
     par le serveur parce qu'il est réglable en back-office, et parce que
     l'écran doit l'ANNONCER avant le geste — pas seulement après. */
  gracePeriodDays: z.number().int().positive(),
  /* L'adresse à qui écrire pour revenir pendant le délai. §3.24 : « un retour
     reste possible en écrivant à l'assistance ; l'écran de confirmation et
     l'e-mail récapitulatif indiquent l'adresse à contacter. » Une adresse
     codée en dur dans le client vieillirait sans qu'on le sache. */
  supportEmail: z.string().email(),
}).strict();

export type DeletionPreview = z.infer<typeof deletionPreviewSchema>;

/* LA CONFIRMATION (§3.24, troisième temps).
 *
 * Deux preuves, et il en faut deux. Le PSEUDO prouve l'intention : on ne le
 * saisit pas par accident, et il oblige à s'arrêter sur ce qu'on est en train
 * de faire. Le CODE reçu par e-mail prouve l'accès à la boîte : sans lui, un
 * téléphone déverrouillé une minute suffirait à effacer un compte.
 *
 * L'un sans l'autre ne vaut rien. Le pseudo seul est affiché à l'écran d'à
 * côté ; le code seul ne dit pas qu'on a compris ce qu'on efface.
 */
export const confirmDeletionSchema = z.object({
  // Le pseudo TEL QU'IL EST, comparé exactement — voir profile.ts pour la
  // règle unique du pseudo.
  username: usernameSchema,
  code: z.string().regex(/^\d{6}$/),
  reason: z.enum(DELETION_REASONS).optional(),
  /* Le champ libre. Il accompagne n'importe quel motif, pas seulement
     « autre » : quelqu'un qui coche « trop cher » a parfois une phrase à
     ajouter, et la lui refuser reviendrait à ne pas vouloir l'entendre. */
  reasonDetails: z.string().trim().max(1000).optional(),
  /* La méthode vers laquelle renvoyer le solde acheté. Facultative : §3.24
     laisse la suppression « se poursuivre ou attendre » quand aucune méthode
     ne convient. Absente, le compte part sans remboursement — et c'est un
     choix que l'écran doit avoir fait dire explicitement. */
  refundPaymentMethodId: z.string().uuid().optional(),
}).strict();

export type ConfirmDeletionInput = z.infer<typeof confirmDeletionSchema>;

/* CE QUE LA CONFIRMATION REND. Le compte n'est pas effacé : il est désactivé,
 * et la date d'effacement est annoncée. C'est la seule réponse honnête à un
 * geste qu'on promet réversible pendant trente jours. */
export const deletionAcceptedSchema = z.object({
  requestedAt: z.string(),
  /* La date à laquelle l'effacement devient définitif. CALCULÉE depuis la
     demande et le délai courant, jamais figée en base : le délai est un
     paramètre de back-office, et une échéance stockée mentirait dès qu'on y
     touche (voir admin/deletions.controller.ts, même raisonnement). */
  erasesAt: z.string(),
  supportEmail: z.string().email(),
  /* Vrai quand un remboursement a été demandé et enregistré. L'écran ne doit
     pas dire « remboursé » — rien n'est parti — mais « demande enregistrée ». */
  refundRequested: z.boolean(),
}).strict();

export type DeletionAccepted = z.infer<typeof deletionAcceptedSchema>;

// ── Les appareils (§5.7) ────────────────────────────────────────────────────

export const DEVICE_PLATFORMS = ["ios", "android"] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/* Ce qu'on rend d'un appareil enregistré — et surtout, ce qu'on n'en rend
 * pas. Le JETON DE NOTIFICATION ne sort jamais : c'est une capacité d'envoi,
 * pas un identifiant d'affichage. Qui l'obtient peut faire sonner le
 * téléphone. Le schéma est `strict`, donc un serveur qui le laisserait passer
 * ferait échouer le parsage plutôt que de l'écrire dans un rapport d'erreur.
 *
 * L'écran désigne un appareil par son `id`, jamais par son jeton.
 */
export const deviceSchema = z.object({
  id: z.string().uuid(),
  platform: z.enum(DEVICE_PLATFORMS),
  appVersion: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
}).strict();

export type Device = z.infer<typeof deviceSchema>;

export const devicesListSchema = z.object({
  devices: z.array(deviceSchema),
}).strict();

export type DevicesList = z.infer<typeof devicesListSchema>;

export const registerDeviceSchema = z.object({
  /* Le jeton rendu par le service de notification. Sa forme varie d'un
     fournisseur et d'une plateforme à l'autre — on borne sa longueur, on ne
     prétend pas connaître son alphabet. */
  pushToken: z.string().trim().min(8).max(512),
  platform: z.enum(DEVICE_PLATFORMS),
  appVersion: z.string().trim().max(20).optional(),
}).strict();

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

// ── L'export de ses données (§3.11, §5.7) ───────────────────────────────────

export const DATA_EXPORT_STATUSES = ["pending", "ready", "failed", "expired"] as const;
export type DataExportStatus = (typeof DATA_EXPORT_STATUSES)[number];

/* L'état d'une demande d'export. Le FICHIER n'est pas ici : §3.11 dit
 * « envoyé par e-mail quand il est prêt », et l'adresse signée expire avec le
 * lien (spec technique §9.7). Rendre l'URL sur ce chemin en ferait une
 * adresse qu'on peut redemander indéfiniment depuis n'importe quelle session
 * encore ouverte.
 */
export const dataExportRequestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(DATA_EXPORT_STATUSES),
  requestedAt: z.string(),
  completedAt: z.string().nullable(),
}).strict();

export type DataExportRequest = z.infer<typeof dataExportRequestSchema>;

// ── Écrire à l'équipe, donner un avis (§3.26, §5.9) ─────────────────────────

export const createSupportRequestSchema = z.object({
  subject: z.string().trim().min(1).max(140).optional(),
  body: z.string().trim().min(1).max(5000),
  /* Joints AUTOMATIQUEMENT par l'application, pour ne pas les demander
     (§3.26). Ils sont déclarés par le client et ne prouvent rien — ce sont des
     indices de diagnostic, pas des faits vérifiés. */
  appVersion: z.string().trim().max(20).optional(),
  platform: z.enum(DEVICE_PLATFORMS).optional(),
}).strict();

export type CreateSupportRequestInput = z.infer<typeof createSupportRequestSchema>;

export const supportRequestSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().nullable(),
  body: z.string(),
  status: z.enum(["open", "answered", "closed"]),
  createdAt: z.string(),
}).strict();

export type SupportRequest = z.infer<typeof supportRequestSchema>;

/* Un avis. Tout y est facultatif SAUF d'avoir dit quelque chose : une note
 * sans texte est un avis (« trois étoiles »), un texte sans note aussi, mais
 * un envoi vide n'est rien et n'a pas à encombrer la table. */
export const createFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
  appVersion: z.string().trim().max(20).optional(),
}).strict().refine(
  (v) => v.rating !== undefined || v.body !== undefined,
  { message: "une note, un texte, ou les deux — mais pas un envoi vide" },
);

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
