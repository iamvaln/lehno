import { z } from "zod";

// Le registre de langage gouverne le ton de ce que le produit écrira pour ce
// proche. Ensemble fixe : enum person_register du dictionnaire.
export const PERSON_REGISTERS = ["familier", "amical", "formel"] as const;
export type PersonRegister = (typeof PERSON_REGISTERS)[number];

export const personSchema = z
  .object({
    id: z.string().uuid(),
    displayName: z.string(),
    isSelf: z.boolean(),
    register: z.enum(PERSON_REGISTERS).nullable(),
    language: z.string().nullable(),
    relationHint: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();

export type Person = z.infer<typeof personSchema>;

export const createPersonSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    register: z.enum(PERSON_REGISTERS).optional(),
    // Langue de ce que le produit écrira POUR ce proche — distincte de la langue
    // d'interface du propriétaire.
    language: z.enum(["fr", "en"]).optional(),
    // « ma sœur », « mon voisin » : une aide à la génération, pas une taxonomie.
    relationHint: z.string().trim().max(80).optional(),
  })
  .strict();

export type CreatePersonInput = z.infer<typeof createPersonSchema>;

// Un PATCH vide ne veut rien dire : au moins un champ.
export const updatePersonSchema = createPersonSchema
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "au moins un champ" });

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
