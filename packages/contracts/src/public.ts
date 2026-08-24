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
  // Champ leurre. Il est présent dans le formulaire, hors de portée du regard
  // et du clavier ; une personne ne le voit pas et ne peut pas l'atteindre.
  // Un robot qui remplit tous les champs le remplit aussi, et se désigne.
  // Il figure au contrat — sinon le .strict() ci-dessous refuserait la
  // soumission avec une erreur de validation, ce qui apprendrait au robot
  // qu'il existe.
  website: z.string().max(254).optional(),
  // Instant du rendu de la page, tel que le client le rapporte. Une
  // soumission plus rapide qu'un humain ne peut taper, ou plus vieille qu'une
  // page laissée ouverte, est écartée. Client-fourni, donc forgeable : c'est
  // un filtre à robots ordinaires, pas une preuve.
  renderedAt: z.number().int().positive().optional(),
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

// Les six motifs de la maquette (design_handoff_surfaces_publiques/ui_kits/web/
// pages.html, clé "contact" → "sujets"), sous forme de clés stables plutôt que
// du texte affiché : le texte diffère par langue, la clé jamais — c'est elle
// que le client envoie, et c'est contre cette liste fermée qu'elle se valide.
// Un texte libre venu du client n'atterrit donc jamais tel quel dans le
// courriel envoyé à l'équipe.
export const CONTACT_SUBJECTS = [
  "question_app",
  "probleme_technique",
  "credits_paiements",
  "signaler_contenu",
  "demande_donnees",
  "autre",
] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export const contactSendSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
  subject: z.enum(CONTACT_SUBJECTS),
  // >9 caractères une fois les espaces de bord retirés : même règle que
  // celle qui gouverne le bouton d'envoi côté client (voir ContactForm.tsx),
  // reposée ici pour ne pas dépendre de la seule discipline du client.
  message: z.string().trim().min(10).max(4000),
  locale: z.enum(["fr", "en"]).optional(),
  // Champ leurre et instant de rendu : même rôle qu'au formulaire de liste
  // d'attente (voir waitlistJoinSchema ci-dessus) — un robot qui remplit
  // tous les champs se désigne, une soumission plus rapide qu'un humain ne
  // peut taper aussi.
  website: z.string().max(254).optional(),
  renderedAt: z.number().int().positive().optional(),
}).strict();

export type ContactSendInput = z.infer<typeof contactSendSchema>;

export const contactSendResponseSchema = z.object({ sent: z.literal(true) }).strict();
