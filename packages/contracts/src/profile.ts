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
   * NULLABLE, contrairement à celui d'un proche — et pour une raison qui tient
   * au parcours, pas à un relâchement de la règle : une fiche naît d'un
   * formulaire qui pose la question, un compte naît d'un code à usage unique
   * qui ne pose rien. Il se renseigne donc au profil (§3.23), plus tard.
   *
   * Nul veut dire « pas encore répondu », et la génération emploie alors des
   * tournures qui s'en passent — jamais un accord au hasard. */
  gender: z.enum(PERSON_GENDERS).nullable(),
}).strict();

export const updateProfileSchema = profileSchema
  .pick({ username: true, displayName: true, uiLanguage: true, theme: true, timezone: true, sendHour: true, gender: true })
  .partial()
  .strict();

/* Ce que `/me/profile/username-available` rend.
 *
 * Une forme d'un seul champ mérite quand même son nom : sans lui, chaque
 * appelant refait le sien — et le jour où la réponse portera aussi une
 * suggestion (« valentine2 est libre », que la maquette annonce déjà), les
 * copies ne l'apprendront pas toutes en même temps.
 *
 * La disponibilité dépend du DEMANDEUR : garder son propre pseudo n'est jamais
 * un conflit. C'est pour cela que la route est sous garde, et que le client ne
 * peut pas y répondre lui-même. */
export const usernameAvailabilitySchema = z.object({
  available: z.boolean(),
}).strict();

export type UsernameAvailability = z.infer<typeof usernameAvailabilitySchema>;

export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
