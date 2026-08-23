import { z } from "zod";

// Les montants viennent de `system_parameter`, lus en base à chaque appel :
// la landing ne les fige jamais dans son code.
export const publicConfigSchema = z.object({
  signupFreeCredits: z.number().int().nonnegative(),
  creditUnitPrice: z.number().nonnegative(),
  currency: z.string().length(3),
  referralBonusInvited: z.number().nonnegative(),
}).strict();

export type PublicConfig = z.infer<typeof publicConfigSchema>;

// L'adresse est la seule clé d'idempotence : `waitlist_signup.email` est en
// citext côté base, déjà insensible à la casse — inutile d'y ajouter un
// toLowerCase() ici.
export const waitlistJoinSchema = z.object({
  email: z.string().email().max(254),
  locale: z.enum(["fr", "en"]).optional(),
  source: z.string().max(64).optional(),
}).strict();

export type WaitlistJoinInput = z.infer<typeof waitlistJoinSchema>;

export const waitlistJoinResponseSchema = z.object({ joined: z.literal(true) }).strict();

// Liste fermée : un nom de document ou de langue venu de la requête ne
// construit jamais un chemin de fichier tel quel. Ce qui n'y figure pas est
// refusé, jamais assaini.
export const LEGAL_DOCUMENTS = ["cgu", "confidentialite", "mentions"] as const;
export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number];

export const LEGAL_LANGUAGES = ["fr", "en"] as const;
export type LegalLanguage = (typeof LEGAL_LANGUAGES)[number];
