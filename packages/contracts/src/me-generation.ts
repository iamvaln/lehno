import { z } from "zod";

/* Les actions payantes — spec technique §5.4, dictionnaire : PremiumAction,
 * ActionRun, GeneratedProfile, GeneratedMessage.
 *
 * Ce que le studio règle n'est PAS ici. Orientations, voies d'image, familles,
 * ambiances, formats sont des explorations qui bougeront : elles viennent du
 * catalogue que le serveur rend (voir me-studio.ts), l'utilisateur choisit
 * dedans, et la sélection remonte telle quelle. Les geler dans un enum
 * obligerait à livrer une version de l'application pour ajouter une ambiance —
 * et un parc ne se met pas à jour d'un bloc.
 *
 * L'application ne compose rien : le portrait est une image, son assemblage
 * appartient au serveur, et l'écran affiche ce que l'API rend.
 */

// Le code de `premium_action`, lui, est un ensemble arrêté : c'est ce que le
// registre des crédits débite, et il ne change pas au gré des explorations.
export const GENERATION_KINDS = ["gift_ideas", "portrait", "wish_message"] as const;
export type GenerationKind = (typeof GENERATION_KINDS)[number];

export const startGenerationSchema = z.object({
  kind: z.enum(GENERATION_KINDS),

  // Un portrait vise le proche : il se génère à tout moment depuis sa fiche, et
  // plusieurs coexistent dans le temps pour donner à voir l'évolution.
  personId: z.string().uuid().optional(),
  // Les idées et le message de vœux visent l'occasion — c'est l'année
  // concernée qui les ancre.
  occurrenceId: z.string().uuid().optional(),

  /* La sélection du studio, telle que le catalogue la définit : un choix par
     groupe, désigné par son identifiant. Ce contrat ne connaît ni les groupes
     ni les choix, et c'est délibéré — il transporte, il ne juge pas. La
     cohérence se vérifie contre le catalogue reçu (valideSelection), puis de
     nouveau côté serveur, qui décide seul. */
  studioSelection: z.record(z.string().min(1).max(64), z.string().min(1).max(64)).optional(),

  // Ce que l'utilisateur ajoute pour orienter le dessin. Conservé le temps de
  // la génération seulement, et l'écran le dit là où on le remplit.
  briefText: z.string().trim().max(280).optional(),
  senderNote: z.string().trim().max(120).optional(),

  // Les paramètres absents prennent la valeur de la fiche.
  tone: z.string().trim().max(40).optional(),
  language: z.enum(["fr", "en"]).optional(),
  sourceFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),

  // Une même demande relancée rejoint la génération en cours plutôt que d'en
  // créer une seconde, et ne débite qu'une fois.
  idempotencyKey: z.string().min(1).max(128).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.kind === "portrait") {
    if (!v.personId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personId"], message: "un portrait vise un proche" });
    }
    if (v.occurrenceId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["occurrenceId"], message: "un portrait ne vise pas une occasion" });
    }
    return;
  }

  if (!v.occurrenceId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["occurrenceId"], message: "cette action vise une occasion" });
  }
  if (v.personId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personId"], message: "seule une occasion est visée ici" });
  }
  // Le studio ne règle qu'une image : les idées et le message n'en ont pas.
  if (v.studioSelection) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["studioSelection"], message: "le studio n'a de sens que pour un portrait" });
  }
});

export type StartGenerationInput = z.infer<typeof startGenerationSchema>;

/* L'état sur le fil est plus riche que `action_run.status`, qui ne connaît que
   `success` et `failure` — et n'existe qu'à la fin. Le lancement débite et rend
   aussitôt un identifiant, sans attendre la production : sans un état « en
   cours », le client ne distinguerait pas une génération qui travaille d'une
   qui a échoué sans le dire. */
export const GENERATION_STATUSES = ["running", "succeeded", "failed"] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export const generationSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(GENERATION_KINDS),
  /**
   * **La cible, et elle est indispensable à l'écran d'attente.**
   *
   * Sans elle, une génération en cours n'a ni nom à afficher ni décompte à
   * montrer — l'écran dirait « une production est en cours » sans dire pour
   * qui, et la liste des reprises serait une liste d'identifiants.
   *
   * L'une des deux est nulle selon la nature : un portrait vise un proche, un
   * message et des idées visent une occasion. Le client n'a pas à en déduire
   * laquelle — il affiche celle qui est là.
   */
  personId: z.string().uuid().nullable(),
  occurrenceId: z.string().uuid().nullable(),
  status: z.enum(GENERATION_STATUSES),
  creditsSpent: z.number().int().min(0),
  // « En cas d'échec, le crédit est rendu au solde et la raison portée par la
  // réponse. » Un échec muet laisserait l'écran d'attente tourner sans fin.
  failureReason: z.string().nullable(),
  // Le portrait, le message ou le jeu d'idées produit — nul tant que la
  // génération n'a pas abouti.
  resultId: z.string().uuid().nullable(),
  createdAt: z.string(),
}).strict();

export type Generation = z.infer<typeof generationSchema>;

// ── Le portrait produit ─────────────────────────────────────────────────────

export const PORTRAIT_STATUSES = ["generated", "approved"] as const;
export type PortraitStatus = (typeof PORTRAIT_STATUSES)[number];

/* Ce que l'écran affiche. Aucun réglage n'y figure : ils ont servi à composer
   l'image, et c'est l'image qui reste. Le portrait ne s'expose à aucune adresse
   publique — l'utilisateur l'enregistre et l'envoie lui-même. */
export const portraitSchema = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid(),
  status: z.enum(PORTRAIT_STATUSES),
  content: z.string(),
  // Version courte du message, pour le format vertical.
  contentShort: z.string().nullable(),
  senderNote: z.string().nullable(),
  /* « L'image composée, produite à l'approbation » : avant elle, il n'y en a
     pas. Nulle plutôt qu'absente — l'écran est ainsi obligé de traiter
     l'attente au lieu de l'oublier. */
  imageUrl: z.string().url().nullable(),
  createdAt: z.string(),
}).strict();

export type Portrait = z.infer<typeof portraitSchema>;

// ── Le brouillon de message ─────────────────────────────────────────────────

export const MESSAGE_STATUSES = ["generated", "edited", "sent"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/**
 * Le message produit pour une occasion.
 *
 * Il vit à part de l'exécution qui l'a produit, et ce n'est pas de la
 * redondance : l'exécution dit ce qui a été payé et ce que ça a coûté, le
 * brouillon dit ce que l'utilisateur en a fait. Il se corrige, il se marque
 * envoyé — l'exécution, elle, ne bouge plus.
 *
 * **`contentShort` peut manquer.** La version courte sort du même appel que le
 * message, mais un modèle la rend parfois trop brève ou pas du tout. Elle n'a
 * pas de crédit à elle : mieux vaut rendre le message sans elle que perdre les
 * deux. Le client se replie alors sur le texte long.
 */
export const generatedMessageSchema = z.object({
  id: z.string().uuid(),
  occurrenceId: z.string().uuid(),
  content: z.string(),
  contentShort: z.string().nullable(),
  status: z.enum(MESSAGE_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

export type GeneratedMessage = z.infer<typeof generatedMessageSchema>;

/**
 * Corriger un brouillon, ou le marquer envoyé.
 *
 * `markSent` est **déclaratif** : l'application n'envoie rien elle-même — le
 * message se copie ailleurs, dans la messagerie de son choix. Le marquer est
 * donc une affirmation de l'utilisateur, pas un constat du serveur, et l'écrire
 * autrement ferait croire à une preuve d'envoi qui n'existe pas.
 */
export const updateMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000).optional(),
  markSent: z.boolean().optional(),
}).strict().refine((v) => v.content !== undefined || v.markSent !== undefined, {
  message: "au moins un champ doit être fourni",
});

export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;

/**
 * Ce que rend le lancement, puis chaque interrogation.
 *
 * Les deux voyagent ensemble parce que le client suit **un seul objet** : lui
 * faire recoller un état et un résultat venus de deux chemins l'obligerait à
 * gérer le moment où l'un est arrivé et l'autre pas.
 */
export const generationResultSchema = z.object({
  generation: generationSchema,
  /** Nul tant que l'exécution n'a pas abouti — et pour toujours si elle échoue. */
  message: generatedMessageSchema.nullable(),
}).strict();

export const generationsSchema = z.object({
  generations: z.array(generationResultSchema),
}).strict();

export type GenerationResult = z.infer<typeof generationResultSchema>;

