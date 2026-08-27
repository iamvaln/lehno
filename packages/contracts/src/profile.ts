import { z } from "zod";
import { PERSON_GENDERS } from "./me.js";

// LE pseudo, déclaré ICI et nulle part ailleurs.
//
// Il forme l'adresse du Mur — lehno.app/valentine — donc ce qui n'entre pas
// dans une URL n'a pas sa place ici : lettres, chiffres, point, tiret, tiret
// bas. Il commence par une lettre ou un chiffre, pour qu'une adresse ne débute
// jamais par un séparateur.
//
// Une SEULE déclaration, et c'est le point. /auth/register portait sa propre
// copie de la règle, plus permissive : deux formulaires du même champ
// acceptaient des pseudos différents, et un compte créé à l'inscription
// pouvait devenir irrecevable à la première correction de profil.
export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);

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
  /* L'accord grammatical de CELUI QUI SIGNE — « je suis fier » ou « fière ».
   *
   * Il en faut deux : celui du proche ne suffit pas, parce que « je suis fière
   * de toi » dépend de qui écrit, pas de qui reçoit. Toutes les orientations du
   * studio parlent à la première personne.
   *
   * Contrairement à celui du proche, il est RENDU en lecture : c'est son propre
   * compte, il a le droit de voir ce qu'il a répondu et de le corriger. Ce que
   * le carnet interdit, c'est d'exposer le genre d'un TIERS qui n'a rien
   * demandé — pas de cacher à quelqu'un ce qui le concerne. */
  gender: z.enum(PERSON_GENDERS),
}).strict();

export const updateProfileSchema = profileSchema
  .pick({ username: true, displayName: true, uiLanguage: true, theme: true, timezone: true, sendHour: true, gender: true })
  .partial()
  .strict();

export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
