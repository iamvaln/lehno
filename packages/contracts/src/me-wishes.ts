import { z } from "zod";

/* Les souhaits d'une occasion et les cadeaux déjà offerts — dictionnaire :
 * WishlistItem, GiftGiven. Spec technique §5.2.
 */

export const WISH_STATUSES = ["available", "reserved", "fulfilled"] as const;
export type WishStatus = (typeof WISH_STATUSES)[number];

// D'où vient le souhait : d'une contribution reçue, d'une idée retenue à la
// génération, ou de la main du propriétaire.
export const WISH_ORIGINS = ["collected", "accepted_idea", "owner"] as const;
export type WishOrigin = (typeof WISH_ORIGINS)[number];

// Code ISO 4217. Le produit sert des devises que l'euro ne couvre pas.
export const currencySchema = z.string().regex(/^[A-Z]{3}$/);

export const wishSchema = z.object({
  id: z.string().uuid(),
  occurrenceId: z.string().uuid(),
  label: z.string(),
  link: z.string().url().nullable(),
  imageUrl: z.string().url().nullable(),
  details: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  currency: currencySchema.nullable(),
  status: z.enum(WISH_STATUSES),
  origin: z.enum(WISH_ORIGINS),
  isPublic: z.boolean(),
  /* « Le nom du réservant si ce dernier l'a autorisé. Le reste demeure
     anonyme. » Nul ne veut donc pas dire « personne n'a réservé » mais « aucun
     nom n'a été donné » : un souhait peut être `reserved` sans nom. */
  reservedByName: z.string().nullable(),
}).strict();

export type Wish = z.infer<typeof wishSchema>;

// Un prix sans devise ne se lit pas : « 12 000 » ne dit ni des francs CFA ni
// des euros, et le Mur affiche ce montant à des visiteurs.
const prixEtDevise = <T extends z.ZodTypeAny>(schema: T) => schema.superRefine(
  (v: { price?: number | null; currency?: string | null }, ctx: z.RefinementCtx) => {
    if (v.price != null && !v.currency) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["currency"], message: "un prix porte sa devise" });
    }
  },
);

export const createWishSchema = prixEtDevise(z.object({
  label: z.string().trim().min(1).max(200),
  link: z.string().url().max(2048).optional(),
  details: z.string().trim().max(500).optional(),
  price: z.number().nonnegative().optional(),
  currency: currencySchema.optional(),
  isPublic: z.boolean().optional(),
}).strict());

export type CreateWishInput = z.infer<typeof createWishSchema>;

/* `reserved` découle d'une réservation confirmée : le propriétaire ne le pose
   pas. Le lui laisser écrire permettrait de marquer réservé un souhait que
   personne n'a pris, et donc de le retirer du Mur sans qu'aucune réservation ne
   l'explique. `fulfilled` reste sa décision — c'est lui qui sait. */
export const OWNER_WISH_STATUSES = ["available", "fulfilled"] as const;

export const updateWishSchema = prixEtDevise(z.object({
  label: z.string().trim().min(1).max(200).optional(),
  link: z.string().url().max(2048).nullable().optional(),
  details: z.string().trim().max(500).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  currency: currencySchema.nullable().optional(),
  status: z.enum(OWNER_WISH_STATUSES).optional(),
  isPublic: z.boolean().optional(),
}).strict()).refine(
  (v) => Object.keys(v).length > 0,
  { message: "au moins un champ" },
);

export type UpdateWishInput = z.infer<typeof updateWishSchema>;

// ── Ce qui a déjà été offert ────────────────────────────────────────────────

/* « Sans cette trace, rien n'empêche de proposer en 2027 le cadeau de 2026 » —
   c'est la mémoire que le produit promet. La génération d'idées lit cet
   historique et écarte ce qui a déjà été offert ; la fiche l'affiche par année. */
export const giftSchema = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid(),
  // L'occasion, si elle est connue : un cadeau peut avoir été offert hors date.
  occurrenceId: z.string().uuid().nullable(),
  label: z.string(),
  // Renseigné si le cadeau venait de la liste de souhaits.
  wishlistItemId: z.string().uuid().nullable(),
  givenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  // Le rangement de la fiche. Il tient même quand la date exacte manque — un
  // cadeau ressaisi longtemps après garde son année.
  year: z.number().int(),
}).strict();

export type Gift = z.infer<typeof giftSchema>;

export const createGiftSchema = z.object({
  label: z.string().trim().min(1).max(200),
  occurrenceId: z.string().uuid().optional(),
  wishlistItemId: z.string().uuid().optional(),
  givenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  year: z.number().int().min(1900).max(2200).optional(),
}).strict();

export type CreateGiftInput = z.infer<typeof createGiftSchema>;
