import { z } from "zod";
import { currencySchema } from "./me-wishes.js";

/* Les contributions reçues — spec technique §5.3, dictionnaire : CollectionLink,
 * Submission, SubmittedWish, ReceivedWish.
 */

export const COLLECTION_LINK_TYPES = ["nominatif", "public"] as const;
export type CollectionLinkType = (typeof COLLECTION_LINK_TYPES)[number];

export const collectionLinkSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(COLLECTION_LINK_TYPES),
  token: z.string(),
  personId: z.string().uuid().nullable(),
  // Le lien est durable : pas d'expiration, seulement une révocation.
  isActive: z.boolean(),
  createdAt: z.string(),
}).strict();

export type CollectionLink = z.infer<typeof collectionLinkSchema>;

/* Un lien nominatif complète une fiche précise : sans elle, le serveur ne
   saurait pas où ranger ce qui arrive. Un lien public ne vise personne — il
   peut créer la fiche à la validation. */
export const createCollectionLinkSchema = z.object({
  type: z.enum(COLLECTION_LINK_TYPES),
  personId: z.string().uuid().optional(),
}).strict().superRefine((v, ctx) => {
  if (v.type === "nominatif" && !v.personId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personId"], message: "un lien nominatif désigne une fiche" });
  }
  if (v.type === "public" && v.personId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personId"], message: "un lien public ne vise aucune fiche" });
  }
});

export type CreateCollectionLinkInput = z.infer<typeof createCollectionLinkSchema>;

// ── Les contributions ───────────────────────────────────────────────────────

export const SUBMISSION_STATUSES = ["pending", "validated", "rejected"] as const;
export const WISH_REVIEWS = ["pending", "retained", "discarded"] as const;
export type WishReview = (typeof WISH_REVIEWS)[number];

/* Les souhaits d'une contribution sont portés en lignes plutôt qu'en bloc :
   chacun reçoit son sort, et le répondant le relit à la réouverture de son
   lien nominatif. */
export const submittedWishSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  link: z.string().url().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: currencySchema.nullable(),
  reviewStatus: z.enum(WISH_REVIEWS),
}).strict();

export const submissionSchema = z.object({
  id: z.string().uuid(),
  linkType: z.enum(COLLECTION_LINK_TYPES),
  // Nulle tant qu'un lien public n'a pas produit sa fiche à la validation.
  personId: z.string().uuid().nullable(),
  submitterName: z.string().nullable(),
  // « on se connaît d'où » — une aide au rangement, pas une taxonomie.
  relationHint: z.string().nullable(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  personalNote: z.string().nullable(),
  status: z.enum(SUBMISSION_STATUSES),
  wishes: z.array(submittedWishSchema),
  createdAt: z.string(),
}).strict();

export type Submission = z.infer<typeof submissionSchema>;
export type SubmittedWish = z.infer<typeof submittedWishSchema>;

/* La décision porte sur l'ensemble — la date, le mot, et le sort de chaque
   souhait — et le serveur applique la répartition en une seule transaction.
   Une décision partielle laisserait la fiche à moitié remplie sans que rien ne
   le signale. */
const DECISIONS_DE_SOUHAIT = ["retained", "discarded"] as const;

export const submissionDecisionSchema = z.object({
  // Rejeter l'ensemble est un geste à part : il n'y a alors rien à répartir, et
  // demander le sort de chaque souhait reviendrait à faire trancher ce qu'on
  // vient d'écarter.
  reject: z.literal(true).optional(),
  /* LA FICHE OÙ RANGER, sur une contribution venue d'un lien PUBLIC.
   *
   * Un lien public ne vise personne : à la validation, le propriétaire dit où
   * la contribution atterrit. Absent, une fiche neuve se crée depuis le nom du
   * répondant — c'est le cas courant, quelqu'un qu'on ne connaissait pas
   * encore. Fourni, elle rejoint une fiche existante : « on se connaît d'où »
   * a suffi à reconnaître quelqu'un qu'on avait déjà noté, et sans ce champ on
   * se retrouverait avec deux fiches pour la même personne.
   *
   * Sans objet sur un lien NOMINATIF, qui porte déjà sa fiche : l'accepter là
   * laisserait détourner une contribution vers la fiche d'un autre. */
  personId: z.string().uuid().optional(),
  keepBirthDate: z.boolean().optional(),
  keepPersonalNote: z.boolean().optional(),
  wishes: z.array(z.object({
    id: z.string().uuid(),
    // « pending » est l'état d'arrivée, pas une décision : le laisser passer
    // permettrait de clore une contribution en laissant un souhait non tranché.
    reviewStatus: z.enum(DECISIONS_DE_SOUHAIT),
  }).strict()).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.reject) {
    if (v.keepBirthDate !== undefined || v.keepPersonalNote !== undefined || v.wishes || v.personId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "un rejet global ne porte aucune répartition" });
    }
    return;
  }
  if (v.keepBirthDate === undefined && v.keepPersonalNote === undefined && !v.wishes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "une décision porte au moins sur un élément" });
  }
  const ids = (v.wishes ?? []).map((w) => w.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["wishes"], message: "un souhait ne se tranche qu'une fois" });
  }
});

export type SubmissionDecisionInput = z.infer<typeof submissionDecisionSchema>;

// ── Les vœux reçus ──────────────────────────────────────────────────────────

export const RECEIVED_WISH_STATUSES = ["pending", "approved", "rejected"] as const;

/* Entrant, à ne pas confondre avec le message sortant que le propriétaire écrit.
 *
 * Le dictionnaire porte `is_public` et `show_author` en les disant inactifs :
 * « les vœux reçus restent privés, le Mur n'a pas de livre d'or ». Les exposer
 * ici les rendrait vivants — un client les afficherait, puis quelqu'un les
 * câblerait. Ils restent hors du contrat tant qu'ils ne servent pas.
 */
export const receivedWishSchema = z.object({
  id: z.string().uuid(),
  occurrenceId: z.string().uuid(),
  // Nul si la contribution était anonyme.
  authorName: z.string().nullable(),
  content: z.string(),
  status: z.enum(RECEIVED_WISH_STATUSES),
  createdAt: z.string(),
}).strict();

export type ReceivedWish = z.infer<typeof receivedWishSchema>;

export const receivedWishDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
}).strict();

export type ReceivedWishDecisionInput = z.infer<typeof receivedWishDecisionSchema>;
