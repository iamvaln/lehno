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
  /* L'ADRESSE COMPLÈTE, parce qu'elle appartient au serveur. Le client qui
     recompose `${site}/c/${token}` doit connaître le site — donc le porter en
     dur, donc se tromper de domaine le jour où il change, sans que rien ne le
     signale. Le jeton reste servi : c'est lui qu'on révoque, qu'on compare et
     qu'on retrouve dans un journal. */
  url: z.string().url(),
  /* Le mot tel qu'il a été écrit, pour que l'écran le relise et le corrige.
     Servi en lecture comme le reste du lien : sans lui, rouvrir l'écran
     présenterait un champ vide au-dessus d'un lien qui, lui, porte le mot. */
  message: z.string().nullable(),
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
  /* LE MOT D'ACCOMPAGNEMENT, écrit par celui qui envoie le lien.
   *
   * « Il s'affiche en haut de la page qu'on ouvrira » — la copie de la
   * maquette le promet à celui qui l'écrit, et c'est cette promesse qui oblige
   * le contrat à le porter. Un champ saisi ici et perdu à l'envoi serait pire
   * qu'un champ absent : on croirait l'avoir écrit.
   *
   * Facultatif, et c'est le propos : le lien vaut sans un mot. Nul plutôt que
   * chaîne vide, pour que la page publique n'ait pas à distinguer « rien
   * écrit » de « écrit puis effacé » — les deux ne montrent rien.
   *
   * Court à dessein. Ce n'est pas une lettre : c'est la phrase qui explique
   * pourquoi on ouvre cette page. Au-delà, elle pousse le formulaire sous la
   * ligne de flottaison — et le formulaire est ce qu'on est venu remplir. */
  message: z.string().trim().max(280).nullable().optional(),
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
  /* DEUX INTERRUPTEURS QUI NE DISENT PAS LA MÊME CHOSE.
   *
   * `isPublic` décide si le vœu paraît sur le Mur ; `showAuthor`, si le nom de
   * qui l'a écrit paraît avec. Les fondre obligerait à choisir entre « je le
   * montre avec son nom » et « je ne le montre pas » — or « je le montre sans
   * dire de qui » est précisément ce qu'on veut d'un mot maladroit qu'on garde
   * quand même.
   *
   * Faux tous les deux à l'arrivée : un vœu reçu n'est pas public parce qu'il
   * est arrivé, il le devient parce que son destinataire l'a décidé. */
  isPublic: z.boolean(),
  showAuthor: z.boolean(),
  createdAt: z.string(),
}).strict();

/* Ce qu'on bascule sur un vœu reçu.
 *
 * Montrer l'auteur d'un vœu qu'on n'expose pas ne veut rien dire — la base le
 * refuse, et le contrat le refuse ici pour que l'écran l'apprenne avant
 * d'envoyer. Retirer la publication retire donc l'auteur avec elle. */
export const receivedWishVisibilitySchema = z.object({
  isPublic: z.boolean().optional(),
  showAuthor: z.boolean().optional(),
}).strict()
  .refine((v) => v.isPublic !== undefined || v.showAuthor !== undefined, {
    message: "au moins un champ doit être fourni",
  })
  .refine((v) => !(v.showAuthor === true && v.isPublic === false), {
    path: ["showAuthor"],
    message: "montrer l'auteur suppose que le vœu soit exposé",
  });

export type ReceivedWishVisibilityInput = z.infer<typeof receivedWishVisibilitySchema>;

export type ReceivedWish = z.infer<typeof receivedWishSchema>;

// Même raison que `wishlistListSchema` : une liste servie nue se relit chez
// chaque appelant, et le mobile n'a pas de quoi la décrire.
export const receivedWishListSchema = z.array(receivedWishSchema);
export type ReceivedWishList = z.infer<typeof receivedWishListSchema>;

export const receivedWishDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
}).strict();

export type ReceivedWishDecisionInput = z.infer<typeof receivedWishDecisionSchema>;
