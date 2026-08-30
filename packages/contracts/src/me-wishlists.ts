import { z } from "zod";
import { WISH_STATUSES, currencySchema } from "./me-wishes.js";

/* MES listes de souhaits, mes souhaits à moi, et ce que j'ai réservé chez les
 * autres — dictionnaire : Wishlist, OwnerWish, WishReservation.
 * Spec technique §5.2 et §5.6 · UX 3.29 et 3.27 · drapeaux `wishlist.own` et
 * `reservation`.
 *
 * `OwnerWish` N'EST PAS `WishlistItem`, et les deux formes vivent dans deux
 * fichiers pour que la confusion ne puisse pas se faire à l'import. Le second
 * est ce qu'un proche m'a confié : privé, jamais partagé, marqué d'un simple
 * repère personnel. Le premier est ce que JE veux, et sa raison d'être est
 * d'être publié — d'où `isPublic`, qui décide ici de ce que des visiteurs
 * voient, et d'où le fait que lui seul se réserve.
 */

// Un prix sans devise ne se lit pas : « 12 000 » ne dit ni des francs CFA ni
// des euros, et la liste partagée affiche ce montant à des visiteurs. Même
// règle que sur les souhaits de proche ; réécrite ici plutôt qu'importée,
// parce qu'un affinement partagé lierait deux formes qui n'ont pas à évoluer
// ensemble.
const prixEtDevise = <T extends z.ZodTypeAny>(schema: T) => schema.superRefine(
  (v: { price?: number | null; currency?: string | null }, ctx: z.RefinementCtx) => {
    if (v.price != null && !v.currency) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["currency"], message: "un prix porte sa devise" });
    }
  },
);

// ── Un de mes souhaits ──────────────────────────────────────────────────────

export const ownerWishSchema = z.object({
  id: z.string().uuid(),
  wishlistId: z.string().uuid(),
  label: z.string(),
  link: z.string().url().nullable(),
  imageUrl: z.string().url().nullable(),
  details: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: currencySchema.nullable(),
  /* `reserved` DÉCOULE d'une réservation confirmée ; `fulfilled` est la
     décision du propriétaire. Voir `updateOwnerWishSchema` : le premier ne
     s'écrit pas. */
  status: z.enum(WISH_STATUSES),
  // Ce qui paraît sur la liste partagée. Un souhait peut rester à soi.
  isPublic: z.boolean(),
  position: z.number().int().nullable(),
  /* LE SEUL CHAMP QUE LE PROPRIÉTAIRE APPREND DU RÉSERVANT, et seulement si
     celui-ci l'a autorisé (`show_identity`). Nul ne veut donc pas dire
     « personne n'a réservé » — le souhait peut être `reserved` sans nom —,
     mais « aucun nom n'a été donné ».
     Ni l'adresse, ni l'identifiant de compte, ni la date de réservation
     n'apparaissent nulle part : recoupés avec le Mur ou une liste d'amis, ils
     désigneraient la personne aussi sûrement qu'un nom, et la surprise que
     tout cet écran protège serait gâchée sans que personne s'en aperçoive. */
  reservedByName: z.string().nullable(),
}).strict();

export type OwnerWish = z.infer<typeof ownerWishSchema>;

// Même raison que `wishlistListSchema` : une liste servie nue se relit chez
// chaque appelant, et le mobile n'a pas de quoi la décrire.
export const ownerWishListSchema = z.array(ownerWishSchema);
export type OwnerWishList = z.infer<typeof ownerWishListSchema>;

export const createOwnerWishSchema = prixEtDevise(z.object({
  label: z.string().trim().min(1).max(200),
  link: z.string().url().max(2048).optional(),
  details: z.string().trim().max(500).optional(),
  price: z.number().nonnegative().optional(),
  currency: currencySchema.optional(),
  // Public par défaut : la liste existe pour être partagée, et un souhait qui
  // naîtrait privé demanderait un geste de plus pour faire ce qu'on attendait.
  isPublic: z.boolean().optional(),
  position: z.number().int().min(0).max(32767).optional(),
  /* Pas de `status` : un souhait qu'on note au moment de le noter n'est ni
     réservé ni déjà offert. */
}).strict());

export type CreateOwnerWishInput = z.infer<typeof createOwnerWishSchema>;

/* `reserved` ne s'écrit pas à la main — il découle d'une réservation confirmée.
   Le laisser poser permettrait de déclarer pris un cadeau que personne n'a
   réservé, donc de le retirer de la liste partagée sans qu'aucune réservation
   ne l'explique. `fulfilled` reste la décision du propriétaire : c'est lui qui
   sait ce qu'il a reçu. */
export const OWNER_WISH_WRITABLE_STATUSES = ["available", "fulfilled"] as const;

export const updateOwnerWishSchema = prixEtDevise(z.object({
  label: z.string().trim().min(1).max(200).optional(),
  link: z.string().url().max(2048).nullable().optional(),
  details: z.string().trim().max(500).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  currency: currencySchema.nullable().optional(),
  status: z.enum(OWNER_WISH_WRITABLE_STATUSES).optional(),
  isPublic: z.boolean().optional(),
  position: z.number().int().min(0).max(32767).nullable().optional(),
}).strict()).refine(
  (v) => Object.keys(v).length > 0,
  { message: "au moins un champ" },
);

export type UpdateOwnerWishInput = z.infer<typeof updateOwnerWishSchema>;

// ── Une de mes listes ───────────────────────────────────────────────────────

export const wishlistSchema = z.object({
  id: z.string().uuid(),
  // L'occasion à laquelle la liste appartient : « un cadeau de Noël n'est pas
  // un cadeau de mariage ».
  occurrenceId: z.string().uuid(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventKind: z.string(),
  eventLabel: z.string().nullable(),
  wishCount: z.number().int().nonnegative(),
  /* COMBIEN, jamais LESQUELS ni PAR QUI : l'écran a besoin de dire « 3 sur 7
     réservés » pour que la liste paraisse vivante, et ce compte ne désigne
     personne. Les souhaits eux-mêmes portent leur état, et rien de plus. */
  reservedCount: z.number().int().nonnegative(),
  // Un lien de partage actif existe-t-il ? La révocation le remet à faux, et
  // l'écran repropose alors de partager.
  isShared: z.boolean(),
  /* L'occasion est passée : la liste s'affiche encore — on veut revoir ce
     qu'on avait demandé — mais n'accepte plus de réservation. */
  isArchived: z.boolean(),
}).strict();

export type Wishlist = z.infer<typeof wishlistSchema>;

/* Créer une liste, c'est l'OUVRIR sur une occasion à soi — pas créer
   l'occasion, qui relève du socle (`/me/events`). L'occasion doit appartenir à
   la self-Person du demandeur : ouvrir une liste sur l'occasion d'un proche
   publierait ce que ce proche n'a jamais accepté de publier. */
export const createWishlistSchema = z.object({
  occurrenceId: z.string().uuid(),
}).strict();

export type CreateWishlistInput = z.infer<typeof createWishlistSchema>;

// ── Le lien de partage ──────────────────────────────────────────────────────

export const wishlistShareSchema = z.object({
  token: z.string(),
  // L'adresse complète, composée par le serveur. Le client ne la reconstitue
  // pas : le domaine public change (préproduction, essai), et deux versions du
  // parc en fabriqueraient deux différentes.
  url: z.string().url(),
  createdAt: z.string(),
}).strict();

export type WishlistShare = z.infer<typeof wishlistShareSchema>;

// ── Mes réservations (écran 3.27) ───────────────────────────────────────────

export const myReservationSchema = z.object({
  id: z.string().uuid(),
  wishId: z.string().uuid(),
  wishLabel: z.string(),
  wishImageUrl: z.string().url().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: currencySchema.nullable(),
  // Chez qui : de quoi afficher la ligne et rejoindre son Mur.
  ownerDisplayName: z.string(),
  ownerUsername: z.string(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // « la mention de savoir si l'on s'est fait connaître d'elle » (UX 3.27).
  showIdentity: z.boolean(),
  confirmedAt: z.string(),
}).strict();

export type MyReservation = z.infer<typeof myReservationSchema>;

/* Les listes nues portent enfin un nom, pour la raison que `noteListSchema`
   donne déjà : « un tableau nu n'a pas de nom, et sans nom chaque appelant
   refait le sien ». Le client mobile ne peut pas se le refaire — il n'embarque
   pas zod, précisément parce que le contrat est censé nommer ses réponses. */
export const wishlistListSchema = z.array(wishlistSchema);
export type WishlistList = z.infer<typeof wishlistListSchema>;

export const myReservationListSchema = z.array(myReservationSchema);
export type MyReservationList = z.infer<typeof myReservationListSchema>;
