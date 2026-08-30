import { z } from "zod";
import { usernameSchema } from "./profile.js";

export const requestOtpSchema = z.object({ email: z.string().email().max(254) }).strict();

/* Ce que la demande rend. Toujours `sent: true`, adresse connue ou non — dire
 * le contraire apprendrait qui a un compte.
 *
 * `retryAfterSeconds` porte le délai avant d'en redemander un, et il CROÎT —
 * cinq secondes, puis vingt-cinq, puis cent vingt-cinq. Il vient donc du
 * serveur : une formule recopiée côté client ferait appliquer deux règles au
 * parc, et celle du serveur resterait la seule qui compte.
 *
 * Il vivait en ligne dans le constructeur du contrat publié, où le client ne
 * pouvait pas l'importer. Ici, les deux le lisent au même endroit. */
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

export const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  isNewAccount: z.boolean(),
  /* L'identifiant de la LIGNÉE, celui que `/me/sessions` rend comme `id`.
   *
   * Il permet à l'application de reconnaître sa propre session dans la liste —
   * ce qu'elle ne pouvait pas faire : une installation fraîche n'a rien à
   * comparer, et le déduire du User-Agent désigne la mauvaise dès qu'un
   * téléphone a deux sessions ouvertes.
   *
   * Deux gestes en dépendent : cocher « cet appareil », et « déconnecter les
   * autres appareils » — dont le libellé promet aujourd'hui ce que le serveur
   * ne sait pas tenir, puisqu'il révoque aussi celle qui appelle. */
  sessionId: z.string().uuid(),
}).strict();

/* Ce que rend une vérification réussie : une session, ou une INVITATION À
 * S'INSCRIRE.
 *
 * Une adresse connue ouvre sa session et va droit à l'accueil. Une adresse
 * inconnue ne crée RIEN : elle rend un jeton d'inscription, et l'écran du
 * pseudo suit. Le compte naît à l'appel suivant, avec son pseudo et son code
 * de parrainage — d'un seul geste.
 *
 * Pourquoi ne pas créer le compte tout de suite, comme avant : le code de
 * parrainage se saisit à l'écran du pseudo, donc APRÈS. Créer d'abord et
 * rattacher ensuite ouvrirait un chemin pour réclamer un parrainage plus tard,
 * sur un compte de six mois. Les deux opérations doivent être atomiques, donc
 * elles se font ensemble ou pas du tout.
 *
 * Le jeton d'inscription n'est PAS une session : il n'ouvre aucune ressource,
 * il ne vaut que pour l'appel de création, une seule fois, et il expire vite. */
export const registrationSchema = z.object({
  registrationToken: z.string(),
  expiresIn: z.number().int().positive(),
  // L'adresse vérifiée, que l'écran du pseudo rappelle. Elle vient du serveur
  // et non de la saisie : c'est celle qui a reçu le code.
  email: z.string().email(),
  // Indicatif, et volontairement non bloquant ici : le plafond fait foi à la
  // création, sous verrou. Le rendre dès maintenant évite de faire choisir un
  // pseudo à quelqu'un dont la création sera refusée au bout.
  deviceLimitReached: z.boolean(),
}).strict();

export type Registration = z.infer<typeof registrationSchema>;

/* Une vérification rend l'un OU l'autre. Le discriminant est explicite plutôt
 * que déduit de la présence d'un champ : un client qui teste « si accessToken
 * existe » se trompera le jour où la forme gagnera un champ. */
export const verifyOutcomeSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("session") }).merge(sessionSchema).strict(),
  z.object({ outcome: z.literal("registration") }).merge(registrationSchema).strict(),
]);

export type VerifyOutcome = z.infer<typeof verifyOutcomeSchema>;

/* La création du compte : pseudo, appareil, et le code facultatif. Tout se
 * fait ici, en une transaction — le plafond par appareil, le compte, les
 * crédits d'inscription et le parrainage. */
export const registerSchema = z.object({
  registrationToken: z.string().min(1),
  // Le MÊME schéma que partout ailleurs — voir profile.ts. Le recopier ici
  // avait fait diverger les deux règles, et un pseudo accepté à l'inscription
  // pouvait être refusé à la première correction de profil.
  username: usernameSchema,
  deviceId: z.string().min(1).max(128),
  referralCode: z.string().max(16).optional(),
}).strict();

export type RegisterInput = z.infer<typeof registerSchema>;

/* Ce que l'écran de bienvenue affiche. Le DÉTAIL, pas un total : cadeau de
 * bienvenue et bonus de parrainage sont deux gestes distincts, et l'un des deux
 * se mérite — les confondre dans un solde unique efface la raison d'inviter
 * quelqu'un.
 *
 * `referral` est nul quand aucun code n'a été donné, et porte son issue sinon :
 * un code inconnu ou un code à soi ne casse pas l'inscription, il se signale. */
export const REFERRAL_OUTCOMES = ["credited", "unknown", "self"] as const;

export const registeredSchema = z.object({
  outcome: z.literal("session"),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  isNewAccount: z.literal(true),
  signupCredits: z.number().int().min(0),
  /* Le cadeau réservé à qui attendait sur la liste, EN PLUS du précédent.
   *
   * Nul quand la personne n'attendait pas — et l'écran de bienvenue ne doit
   * alors rien annoncer. Deux champs plutôt qu'un total, pour la même raison
   * que `signupCredits` et `referral` sont déjà séparés : ce sont deux gestes
   * distincts, et les confondre dans une somme unique effacerait la raison de
   * s'être inscrit à la liste.
   *
   * La détection s'est faite sur l'ADRESSE, pas sur un jeton porté par le
   * lien : un bonus dans le lien serait transférable. Le client n'a donc rien
   * à transmettre — il lit ce champ, c'est tout. */
  waitlistBonus: z.number().int().positive().nullable(),
  referral: z.object({
    outcome: z.enum(REFERRAL_OUTCOMES),
    // Le pseudo du parrain, pour « invité par … ». Nul si le code n'a mené
    // à personne.
    inviterUsername: z.string().nullable(),
    bonusCredits: z.number().int().min(0),
  }).nullable(),
}).strict();

export type Registered = z.infer<typeof registeredSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();

export const federatedSchema = z.object({
  provider: z.enum(["google", "apple"]),
  idToken: z.string().min(1),
  deviceId: z.string().min(1).max(128).optional(),
  // La §5.1 veut le code de parrainage sur les TROIS voies. Il manquait ici :
  // une inscription par Google ou Apple ne pouvait en porter aucun, et le
  // filleul perdait son bonus selon la porte qu'il avait empruntée.
  referralCode: z.string().max(16).optional(),
}).strict();

export type Session = z.infer<typeof sessionSchema>;
