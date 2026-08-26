import { z } from "zod";

/* L'authentification, telle que le serveur la sert.
 *
 * La source est le contrat publié par le serveur, pas ce fichier : il tourne
 * sur d'autres machines que la mienne, et c'est lui qui fait foi. Ce fichier
 * transcrit ce qu'il annonce, pour que le client le vérifie à la compilation.
 */

export const requestOtpSchema = z.object({ email: z.string().email().max(254) }).strict();

/* La demande de code rend toujours `sent: true`, adresse connue ou non — dire
   le contraire apprendrait qui a un compte.

   `retryAfterSeconds` est le délai avant d'en redemander un, et il vient du
   limiteur du serveur. L'écran doit l'afficher plutôt qu'une constante : une
   valeur écrite en dur finit par contredire le limiteur, et l'écran promet
   alors un renvoi que le serveur refuse. */
export const requestOtpResultSchema = z.object({
  sent: z.literal(true),
  retryAfterSeconds: z.number().int().positive(),
}).strict();

export type RequestOtpResult = z.infer<typeof requestOtpResultSchema>;

export const verifyOtpSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
  deviceId: z.string().min(1).max(128).optional(),
  referralCode: z.string().max(16).optional(),
}).strict();

/* Le pseudo à l'inscription : commence par une lettre ou un chiffre, puis
   lettres, chiffres, point, tiret ou tiret bas. Il forme l'adresse du Mur, d'où
   le refus de tout ce qui n'entre pas dans une URL.

   IL DIFFÈRE DE CELUI DE `profile.ts`, qui n'accepte en modification que
   minuscules, chiffres et tirets bas. Un pseudo « Awa.Diop » passe donc à
   l'inscription et devient impossible à corriger ensuite. Les deux doivent
   converger vers celui-ci ; le nom distinct tient l'écart visible en attendant,
   plutôt qu'un seul nom qui cacherait laquelle des deux règles s'applique. */
export const registrationUsernameSchema = z.string().min(3).max(30).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);

/* La session ouverte. `signupCredits` n'accompagne que celle qui vient de
   naître : c'est ce que l'écran de bienvenue annonce, et l'écrire en dur le
   ferait mentir dès que le montant change en administration. */
export const sessionSchema = z.object({
  outcome: z.literal("session"),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  isNewAccount: z.boolean(),
  signupCredits: z.number().int().min(0).optional(),
  referral: z.record(z.unknown()).optional(),
}).strict();

export type Session = z.infer<typeof sessionSchema>;

/* L'issue d'inscription. Le jeton qu'elle porte ne sert qu'à créer le compte
   et à faire valoir un parrainage — il n'ouvre rien. Le ranger comme un jeton
   de session donnerait une application qui se croit connectée.

   `deviceLimitReached` arrive AVEC ce jeton, pas à sa place : l'écran peut
   ainsi le dire avant que la personne choisisse un pseudo pour rien. */
export const registrationSchema = z.object({
  outcome: z.literal("registration"),
  registrationToken: z.string(),
  expiresIn: z.number().int().positive(),
  email: z.string().email(),
  deviceLimitReached: z.boolean(),
}).strict();

export type Registration = z.infer<typeof registrationSchema>;

/* Deux issues à la vérification du code, et c'est le cœur du parcours : une
   adresse connue ouvre une session, une adresse nouvelle demande une
   inscription. L'union discriminée oblige le client à traiter les deux. */
export const verifyOtpResultSchema = z.discriminatedUnion("outcome", [
  sessionSchema,
  registrationSchema,
]);

export type VerifyOtpResult = z.infer<typeof verifyOtpResultSchema>;

/* La création du compte. L'identifiant d'appareil y est obligatoire — c'est lui
   qui borne le nombre de comptes créés depuis un même téléphone. */
export const registerSchema = z.object({
  registrationToken: z.string().min(1),
  username: registrationUsernameSchema,
  deviceId: z.string().min(1).max(128),
  referralCode: z.string().max(16).optional(),
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();

/* Ce que le renouvellement rend — et il diffère de la session ouverte par la
   connexion : PAS D'`outcome`. Le serveur en pose un sur `/auth/otp/verify` et
   `/auth/federated`, où il faut distinguer deux issues, mais pas sur
   `/auth/refresh`, qui n'en a qu'une.

   Défendable, et pourtant gênant : deux formes de session obligent le client à
   savoir laquelle il a demandée avant de lire la réponse. Les unifier vaudrait
   mieux ; ce schéma tient l'écart visible en attendant qu'elles le soient. */
export const refreshedSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  isNewAccount: z.literal(false),
}).strict();

export type RefreshedSession = z.infer<typeof refreshedSessionSchema>;

/* La session SANS issue nommée, telle que `apps/api` la rend encore.
 *
 * Le serveur déployé a dépassé cette forme : sa vérification de code et sa
 * connexion externe rendent l'union discriminée ci-dessus, et il expose
 * `/auth/register`, que ce dépôt n'a pas. Le code d'ici est donc en retard sur
 * ce qui tourne — et c'est le serveur qui fait foi.
 *
 * Ce schéma n'existe que pour que le code en retard continue de compiler
 * pendant qu'il rattrape. Il doit disparaître quand ce sera fait : le garder
 * plus longtemps laisserait croire que deux contrats coexistent légitimement.
 */
export const sessionHeriteeSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  isNewAccount: z.boolean(),
}).strict();

export type SessionHeritee = z.infer<typeof sessionHeriteeSchema>;

export const federatedSchema = z.object({
  provider: z.enum(["google", "apple"]),
  idToken: z.string().min(1),
  deviceId: z.string().min(1).max(128).optional(),
}).strict();
