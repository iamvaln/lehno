import { z } from "zod";
import { EVENT_KINDS, EVENT_NATURES, SCHEDULE_UNITS } from "./me-events.js";
import {
  CATEGORY_CODES, PERSON_RELATIONS, PERSON_REGISTERS, CONTACT_CHANNELS,
  ATTRIBUT_NATURES,
} from "./me.js";

/* Le Mur, la recherche, les reprises et les métadonnées — spec technique
 * §5.5, §5.7 et §5.8. Les préférences de notification et le centre de
 * notifications vivent à part, dans me-notifications.ts (§3.11 et §3.13) :
 * un domaine assez chargé de règles pour mériter son propre fichier plutôt
 * que de s'ajouter au fourre-tout des surfaces restantes.
 */

// ── Le Mur ──────────────────────────────────────────────────────────────────

/* Les natures d'attribut qu'un Mur peut exposer.
 *
 * Un SOUS-ENSEMBLE de `ATTRIBUT_NATURES`, et le tri n'est pas cosmétique.
 * `clothing_size` et `shoe_size` sont des mesures du corps : elles servent à
 * choisir un cadeau, sur une liste partagée, pas à se présenter à un inconnu
 * qui passe. `avoid` est un signal négatif, utile à qui offre, déplacé sur une
 * page d'accueil. Les laisser publiables serait s'en remettre au discernement
 * de chacun au moment où il coche — or l'écran les afficherait toutes, et
 * quelqu'un finirait par tout cocher.
 *
 * §3.4 dit « intérêts / goûts » : c'est exactement ce qui reste ici. */
export const NATURES_EXPOSABLES = [
  "color", "animal", "food", "drink", "fragrance", "style", "hobby", "occupation",
] as const satisfies readonly (typeof ATTRIBUT_NATURES)[number][];

export type NatureExposable = (typeof NATURES_EXPOSABLES)[number];

/* Un goût du propriétaire, tel qu'il le voit dans la gestion de son Mur :
   avec son identifiant, parce que c'est par lui qu'il en règle la visibilité,
   et avec `isPublic`, qui dit ce que le Mur montre aujourd'hui. */
export const wallInterestSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(NATURES_EXPOSABLES),
  value: z.string(),
  isPublic: z.boolean(),
}).strict();

export type WallInterest = z.infer<typeof wallInterestSchema>;

export const wallSchema = z.object({
  /* Le segment d'adresse. C'est LE PSEUDO, servi tel quel — pas une colonne.
     Une seconde colonne, à tenir égale au pseudo, dériverait le jour où
     quelqu'un se renomme sans que le Mur suive : l'ancienne adresse resterait
     servie, et personne ne s'en apercevrait avant qu'un proche ne se plaigne.
     Voir la déclaration unique de `usernameSchema` (profile.ts). */
  slug: z.string(),
  isEnabled: z.boolean(),
  showBirthdayDate: z.boolean(),
  // S'affiche sous le message d'accueil que le produit compose à partir du
  // prénom : il l'accompagne, il ne le remplace pas.
  welcomeMessage: z.string().nullable(),
  // L'adresse existe avant la publication — l'écran la montre pour qu'on sache
  // ce qu'on s'apprête à ouvrir.
  publicUrl: z.string().url(),
  /* « Le Mur expose le lien de l'occurrence courante ; une nouvelle occurrence
     chaque année ⇒ un nouveau lien. » Hors fenêtre de vœux, il n'y en a pas. */
  wishLinkUrl: z.string().url().nullable(),
  /* Ce que le propriétaire peut exposer, et ce qu'il expose. TOUS ses goûts
     figurent ici, publics ou non : l'écran de gestion est celui où l'on coche,
     il lui faut donc la liste entière. La page publique, elle, ne reçoit que
     ceux qui sont cochés — deux formes distinctes, à dessein. */
  interests: z.array(wallInterestSchema),
}).strict();

export type Wall = z.infer<typeof wallSchema>;

export const updateWallSchema = z.object({
  isEnabled: z.boolean().optional(),
  showBirthdayDate: z.boolean().optional(),
  welcomeMessage: z.string().trim().max(500).nullable().optional(),
  /* L'ENSEMBLE de ce qui est exposé, pas un ajout ni un retrait.
     Un patch élément par élément laisserait une case décochée à l'écran rester
     cochée en base si l'appel qui la retirait s'est perdu ; ici, ce qui reste
     public après l'appel est toujours exactement ce qui a été envoyé.
     Tableau vide = plus rien d'exposé, et c'est un geste légitime. */
  publicInterestIds: z.array(z.string().uuid()).max(50).optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: "au moins un champ" });

export type UpdateWallInput = z.infer<typeof updateWallSchema>;

/* L'invitation à laisser un mot, pour l'occasion en cours (§3.10).
 *
 * `closesOn` accompagne le lien parce que c'est ce que l'écran partage : « à
 * partager pour que les proches viennent écrire », et un lien sans date de
 * fermeture se partage encore un mois après qu'il a cessé d'accepter.
 *
 * Il n'y a pas de forme « pas de lien » ici : hors fenêtre, le chemin refuse
 * par `wish_window_closed` plutôt que de rendre des nuls. Un objet dont tous
 * les champs peuvent être nuls oblige chaque client à réinventer la règle. */
export const wishLinkSchema = z.object({
  token: z.string(),
  url: z.string().url(),
  occurrenceId: z.string().uuid(),
  closesOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).strict();

export type WishLink = z.infer<typeof wishLinkSchema>;

// ── La recherche ────────────────────────────────────────────────────────────

/* Chaque ligne reprend la présentation de l'annuaire : de quoi reconnaître la
   bonne personne sans ouvrir sa fiche. */
export const searchResultSchema = z.object({
  personId: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  /* Un proche sans date n'a pas de prochaine échéance, et la recherche doit
     quand même le rendre : c'est souvent lui qu'on cherche, précisément pour
     lui en ajouter une. */
  nextOccurrenceKind: z.enum(EVENT_KINDS).nullable(),
  nextOccurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  daysUntil: z.number().int().nullable(),
}).strict();

export type SearchResult = z.infer<typeof searchResultSchema>;

// ── Les reprises ────────────────────────────────────────────────────────────

export const RESUMABLE_KINDS = ["message_draft", "portrait"] as const;

// L'état où en est l'élément, que la ligne affiche telle quelle.
export const RESUMABLE_STATES = ["draft", "to_approve", "to_share"] as const;

/* « Rien ne se perd : ce qu'on a lancé se retrouve ici. » Classées par urgence —
   ce qui touche une échéance proche vient en tête, puis les plus récents. */
export const resumableSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(RESUMABLE_KINDS),
  state: z.enum(RESUMABLE_STATES),
  personId: z.string().uuid(),
  personDisplayName: z.string(),
  /* Un portrait se génère hors de toute échéance : il n'a ni occasion ni
     décompte, et le classement par urgence le range après ceux qui en ont. */
  occurrenceId: z.string().uuid().nullable(),
  daysUntil: z.number().int().nullable(),
  updatedAt: z.string(),
}).strict();

export type Resumable = z.infer<typeof resumableSchema>;

// ── Les métadonnées ─────────────────────────────────────────────────────────

/* Les valeurs dont les écrans composent leurs listes. La plupart sont des
 * énumérations FIGÉES qu'un client typé connaît déjà à la compilation — les
 * servir ici évite seulement d'aller les chercher à deux endroits.
 *
 * `categories` est la seule à ne PAS l'être : `Category` vit en base, et
 * porte `kind` et `isConstraint`. Un client ne peut déduire d'aucune
 * énumération nue que `dislikes_nogo` est une contrainte ACTIVE — or c'est ce
 * qui change ce que le produit PROPOSE, pas seulement ce qu'il affiche.
 *
 * Aucun libellé ici : ils vivent dans les ressources de traduction de
 * l'application, indexés par `code`. En rendre depuis le serveur ferait deux
 * sources de vérité pour un même mot, et l'obligerait à connaître la langue
 * du demandeur. */
export const metadataSchema = z.object({
  categories: z.array(z.object({
    code: z.enum(CATEGORY_CODES),
    kind: z.enum(["ponctuelle", "durable"]),
    isConstraint: z.boolean(),
  }).strict()),
  eventKinds: z.array(z.enum(EVENT_KINDS)),
  eventNatures: z.array(z.enum(EVENT_NATURES)),
  scheduleUnits: z.array(z.enum(SCHEDULE_UNITS)),
  personRelations: z.array(z.enum(PERSON_RELATIONS)),
  personRegisters: z.array(z.enum(PERSON_REGISTERS)),
  // `personGenders` n'y figure pas : il alimenterait un sélecteur que le carnet
  // ne dessine pas. Servir la liste des valeurs, c'est inviter à poser la
  // question — voir la note de `personSchema`.
  contactChannels: z.array(z.enum(CONTACT_CHANNELS)),
}).strict();

export type Metadata = z.infer<typeof metadataSchema>;
