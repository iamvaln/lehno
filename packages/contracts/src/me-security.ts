import { z } from "zod";
import { federatedSchema } from "./auth.js";

/* Sécurité et connexions — spec mobile §3.24, dictionnaire : RefreshToken,
 * FederatedIdentity.
 *
 * Trois chemins seulement : lister les connexions récentes, se déconnecter de
 * partout, lister les moyens de connexion externes rattachés. La suppression
 * du compte (§3.24, en trois temps, avec remboursement et délai de grâce) est
 * un chantier à part — son design est encore en cours.
 */

// Le même schéma que celui posé par /auth/federated : une seule déclaration
// de la liste des fournisseurs, comme usernameSchema pour le pseudo. Un
// troisième fournisseur ajouté un jour n'aurait qu'un seul endroit à changer.
export const identityProviderSchema = federatedSchema.shape.provider;

/* Une SESSION, pas un jeton.
 *
 * `RefreshToken` crée un jeton enfant à chaque rafraîchissement, dans la même
 * `familyId` : un téléphone resté ouvert deux mois y correspond à des
 * dizaines de lignes. Ce que l'écran affiche par « connexion récente » est la
 * LIGNÉE entière — `id` en est le `familyId`, `createdAt` la date de son
 * premier jeton (l'ouverture), `lastActiveAt` celle de son plus récent (la
 * dernière fois qu'elle a servi, chaque rotation l'avançant).
 *
 * Pas de lieu approximatif : la spec le demande, mais `RefreshToken.ip` ne
 * doit PAS traverser telle quelle jusqu'à l'affichage (voir son commentaire
 * dans prisma/schema.prisma — elle sert aux investigations, pas à l'écran).
 * En rendre une géolocalisation demanderait un service tiers qui n'existe pas
 * encore ; plutôt qu'une adresse brute affichée comme un « lieu », ce champ
 * est absent. Il rejoindra ce schéma le jour où un service de géolocalisation
 * existe pour la produire honnêtement.
 *
 * Pas de champ « courant » non plus : /me/sessions ne reçoit qu'un jeton
 * d'accès, qui ne dit pas de quelle lignée il descend (voir TokenService,
 * dont le jeton d'accès ne porte que `sub`). Le client sait déjà quel
 * appareil est le sien ; il n'a pas besoin du serveur pour ça.
 */
export const sessionSummarySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  lastActiveAt: z.string(),
  // Déclaré par l'appareil à chaque appel (l'en-tête User-Agent), jamais
  // vérifié : un indice de reconnaissance pour la personne qui lit l'écran,
  // pas une preuve. Nul quand l'appareil ne l'a pas fourni.
  userAgent: z.string().nullable(),
}).strict();

export const sessionsListSchema = z.object({
  sessions: z.array(sessionSummarySchema),
}).strict();

export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type SessionsList = z.infer<typeof sessionsListSchema>;

/* Un moyen de connexion EXTERNE rattaché — Google ou Apple. La connexion par
 * e-mail et code n'a pas de ligne ici : elle n'a pas de désactivation
 * possible (§3.24 : « la connexion par code restant l'accès de secours »),
 * l'écran l'affiche donc comme toujours active sans appeler le serveur.
 */
export const externalIdentitySchema = z.object({
  provider: identityProviderSchema,
  linkedAt: z.string(),
  lastUsedAt: z.string().nullable(),
}).strict();

export const identitiesListSchema = z.object({
  identities: z.array(externalIdentitySchema),
}).strict();

export type ExternalIdentity = z.infer<typeof externalIdentitySchema>;
export type IdentitiesList = z.infer<typeof identitiesListSchema>;
