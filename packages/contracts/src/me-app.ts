import { z } from "zod";
import { EVENT_KINDS, EVENT_NATURES, SCHEDULE_UNITS } from "./me-events.js";
import {
  CATEGORY_CODES, PERSON_RELATIONS, PERSON_REGISTERS, CONTACT_CHANNELS,
} from "./me.js";

/* Le Mur, la recherche, les reprises et les métadonnées — spec technique
 * §5.5, §5.7 et §5.8. Les préférences de notification et le centre de
 * notifications vivent à part, dans me-notifications.ts (§3.11 et §3.13) :
 * un domaine assez chargé de règles pour mériter son propre fichier plutôt
 * que de s'ajouter au fourre-tout des surfaces restantes.
 */

// ── Le Mur ──────────────────────────────────────────────────────────────────

export const wallSchema = z.object({
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
}).strict();

export type Wall = z.infer<typeof wallSchema>;

export const updateWallSchema = z.object({
  isEnabled: z.boolean().optional(),
  showBirthdayDate: z.boolean().optional(),
  welcomeMessage: z.string().trim().max(500).nullable().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, { message: "au moins un champ" });

export type UpdateWallInput = z.infer<typeof updateWallSchema>;

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
  // `personGenders` n'y figure pas : deux valeurs seulement, et l'écran
  // d'identité les porte déjà dans sa copy. Servir une liste de deux éléments
  // fixes ferait un aller-retour pour rien.
  contactChannels: z.array(z.enum(CONTACT_CHANNELS)),

  /**
   * Ce que chaque action payante coûte, **lu en base**.
   *
   * Le prix se règle en administration sans livraison : une constante côté
   * client afficherait l'ancien tarif sur tout un parc jusqu'à la mise à jour
   * suivante — et un écran qui annonce un prix avant de débiter ne peut pas se
   * tromper.
   *
   * **Une action absente n'est pas disponible.** Même convention que les
   * drapeaux : ce qui n'est pas là est éteint, et « absent » se confond avec
   * « inconnu » à dessein — un client d'une version antérieure ignore un code
   * qu'il ne connaît pas au lieu de refuser la réponse entière.
   *
   * C'est ici et non dans `/me/studio/options`, qui ne sert que le portrait :
   * le message et les idées ont aussi un prix à annoncer, et ils n'ouvrent
   * aucun studio.
   */
  premiumActions: z.array(z.object({
    code: z.string(),
    credits: z.number().int().min(0),
  }).strict()),
}).strict();

export type Metadata = z.infer<typeof metadataSchema>;
