import { z } from "zod";
import { PERSON_GENDERS } from "./me.js";

// LE pseudo, déclaré ICI et nulle part ailleurs.
//
// Il forme l'adresse du Mur — lehno.io/valentine — donc ce qui n'entre pas
// dans une URL n'a pas sa place ici : lettres, chiffres, point, tiret, tiret
// bas. Il commence par une lettre ou un chiffre, pour qu'une adresse ne débute
// jamais par un séparateur.
//
// Une SEULE déclaration, et c'est le point. /auth/register portait sa propre
// copie de la règle, plus permissive : deux formulaires du même champ
// acceptaient des pseudos différents, et un compte créé à l'inscription
// pouvait devenir irrecevable à la première correction de profil.
/* Les langues de l'interface ET DES COURRIELS. Une seule liste : l'inscription
   accepte la langue de l'appareil, le profil la corrige, et les deux doivent
   accepter exactement les mêmes valeurs — recopiées, elles finiraient par
   diverger, et une langue acceptée à l'inscription serait refusée à la
   première correction de profil. */
export const UI_LANGUAGES = ["fr", "en"] as const;

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
  /* Une URL SIGNÉE, valable quelques minutes, et non ce qui est rangé en base
     — la colonne porte une clé. Le serveur la signe à chaque lecture et décide
     à ce moment-là si celui qui demande a le droit : un compartiment public
     laisserait un lien partagé une fois ouvert pour toujours.
     À ranger nulle part côté client : elle sera morte au prochain écran. */
  avatarUrl: z.string().url().nullable(),
  /* LA CLÉ, à côté de l'URL, et c'est ce qui rend le cache possible.
   *
   * L'URL est un laissez-passer jetable : elle change à chaque lecture, donc un
   * cache HTTP indexé dessus retélécharge à chaque affichage. La clé, elle, ne
   * change que quand la photo change — c'est sur elle qu'un client range son
   * fichier, et c'est elle qui lui dit qu'il n'a rien à retélécharger.
   *
   * Elle ne donne aucun accès par elle-même : il faut la présenter à
   * `/me/media/url`, qui vérifie qu'elle appartient bien au demandeur. */
  avatarKey: z.string().nullable(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  uiLanguage: z.enum(UI_LANGUAGES),
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

// ── La photo de profil ──────────────────────────────────────────────────────

/* Le dépôt se fait EN DIRECT sur le stockage, sans traverser l'API : une photo
 * de deux mégaoctets qui passe par le serveur occupe une connexion pour rien, et
 * un téléphone en zone lente la tiendrait longtemps.
 *
 * Le client reçoit une URL de dépôt — et RIEN D'AUTRE. Pas la clé : c'est le
 * serveur qui l'engendre et la retient. La lui donner permettrait de la
 * remplacer par celle d'un autre — un reçu de paiement, un export de données —
 * et de nous faire signer une lecture dessus.
 */
export const depotAvatarSchema = z.object({
  url: z.string().url(),
  /** Secondes avant que l'URL de dépôt ne meure. */
  expireDans: z.number().int().positive(),
  /** Ce que le stockage acceptera : le dépôt est signé POUR ce type. */
  typeMime: z.string(),
  /** La taille au-delà de laquelle le serveur refusera à la confirmation.
   *  Servie pour que le client n'ait pas à recopier la règle. */
  tailleMax: z.number().int().positive(),
}).strict();

export type DepotAvatar = z.infer<typeof depotAvatarSchema>;

/* La confirmation ne porte AUCUN corps : le serveur sait déjà quelle clé il a
   délivrée, à qui, et pour quel type. Le client dit seulement « c'est
   déposé ». */

/* Une URL de lecture, à la demande, pour une clé qu'on possède déjà.
 *
 * Elle existe pour le CACHE : un client qui garde ses images localement les
 * range par clé, et ne redemande une URL que lorsqu'il n'a pas le fichier — ou
 * que le laissez-passer a expiré en cours de téléchargement.
 *
 * La clé seule ne vaut RIEN : cette route vérifie qu'elle appartient au
 * demandeur. Sans ce contrôle, une clé aperçue une fois se rejouerait
 * indéfiniment, et le serveur cesserait de décider à chaque lecture.
 */
export const urlMediaSchema = z.object({ cle: z.string().min(1).max(200) }).strict();

export const urlMediaRenduSchema = z.object({
  url: z.string().url(),
  /** Secondes avant que l'URL ne meure. Le client redemande, il ne devine pas. */
  expireDans: z.number().int().positive(),
}).strict();

export type UrlMedia = z.infer<typeof urlMediaRenduSchema>;
