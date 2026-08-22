import { z } from "zod";

// Trois à trente caractères, minuscules, chiffres et tirets bas. Il forme
// l'adresse du Mur : ce qui n'entre pas dans une URL n'a pas sa place ici.
export const usernameSchema = z.string().regex(/^[a-z0-9_]{3,30}$/);

export const profileSchema = z.object({
  id: z.string().uuid(),
  username: usernameSchema,
  displayName: z.string().max(80).nullable(),
  avatarUrl: z.string().url().nullable(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  uiLanguage: z.enum(["fr", "en"]),
  theme: z.enum(["system", "light", "dark"]),
  timezone: z.string().max(64),
  sendHour: z.number().int().min(0).max(23),
}).strict();

export const updateProfileSchema = profileSchema
  .pick({ username: true, displayName: true, uiLanguage: true, theme: true, timezone: true, sendHour: true })
  .partial()
  .strict();

export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
