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

  /* LE BUDGET, et il change la nature de la réponse plutôt que son ton.
   *
   * Sans lui, un modèle propose au hasard de l'échelle : un abonnement à
   * cinquante mille francs à côté d'un bracelet à huit cents. La liste devient
   * inutilisable non parce que les idées sont mauvaises, mais parce qu'on ne
   * peut en retenir aucune sans refaire le tri soi-même.
   *
   * Les deux bornes sont facultatives SÉPARÉMENT — « jusqu'à 20 000 » est la
   * façon dont on pense un budget bien plus souvent qu'un intervalle fermé.
   * Aucune devise ici : elle vient de la configuration. La demander au client
   * ferait entrer « FCFA » ou « francs » dans une colonne de trois caractères,
   * et surtout la rendrait négociable par qui envoie la requête. */
  budget: z.object({
    min: z.number().nonnegative().optional(),
    max: z.number().positive().optional(),
  }).strict().refine((b) => b.min !== undefined || b.max !== undefined, {
    message: "un budget porte au moins une borne",
  }).refine((b) => b.min === undefined || b.max === undefined || b.min <= b.max, {
    message: "la borne basse ne dépasse pas la haute",
  }).optional(),

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
  /* UN BUDGET NE VAUT QUE POUR DES IDÉES. On n'achète rien avec un message ni
     avec un portrait, et l'accepter en silence ferait croire qu'il agit — le
     genre de champ qu'on renseigne pendant des mois avant de découvrir qu'il
     n'a jamais rien changé. */
  if (v.budget && v.kind !== "gift_ideas") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["budget"], message: "un budget ne vaut que pour des idées de cadeaux" });
  }
});

export type StartGenerationInput = z.infer<typeof startGenerationSchema>;

/**
 * LE DÉPÔT D'UNE PHOTO DONT LE PORTRAIT S'INSPIRE.
 *
 * Même forme que `depotAvatarSchema`, et même doctrine : le client reçoit une
 * URL de dépôt et RIEN D'AUTRE. Pas la clé — la lui donner permettrait de la
 * remplacer par celle d'un reçu de paiement ou d'un export de données, et de
 * nous faire signer une lecture dessus.
 *
 * Pas de `tailleMax` ici, à la différence de l'avatar : ce qu'on refuse n'est
 * pas un poids mais une IMAGE — trop petite, trop sombre, trop plate. Ces
 * seuils se règlent au studio et ne se recopient pas au client : il ne saurait
 * pas mesurer la netteté, et les lui servir l'inviterait à refuser lui-même une
 * photo que le serveur aurait acceptée.
 */
export const depotPhotoSourceSchema = z.object({
  url: z.string().url(),
  /** Secondes avant que l'URL de dépôt ne meure. */
  expireDans: z.number().int().positive(),
  /** Ce que le stockage acceptera : le dépôt est signé POUR ce type. */
  typeMime: z.string(),
}).strict();

export type DepotPhotoSource = z.infer<typeof depotPhotoSourceSchema>;

/* LES TROIS REFUS, nommés. Ils voyagent dans le détail d'une erreur de
   validation, et c'est l'écran qui les traduit : « trop sombre » n'a pas la
   même phrase en français et en anglais, et la figer au serveur reviendrait à
   choisir la langue de quelqu'un d'autre. */
export const REFUS_PHOTO = ["trop_petite", "trop_sombre", "trop_floue"] as const;
export type RefusPhoto = (typeof REFUS_PHOTO)[number];

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

/* QUATRE MOMENTS, ET C'EST LE DEUXIÈME QUI MANQUAIT.
 *
 * `generated` — le brief seul : des mots et une phrase, aucune image.
 * `composed`  — l'image existe, personne n'a dit ce qu'il en pense.
 * `approved`  — « je garde celle-ci ».
 * `rejected`  — « celle-ci ne va pas ». L'image RESTE.
 *
 * Composer valait acceptation, si bien qu'aucun état ne portait « composée, pas
 * encore jugée » : on ne pouvait rejeter qu'un TEXTE, alors que ce qu'on juge
 * est ce qu'on a vu.
 *
 * `composed` EST UN ÉTAT TERMINAL LÉGITIME, et la plupart des portraits y
 * resteront. Refaire n'est pas rejeter : on peut en produire cinq en changeant
 * les réglages et les garder tous. Comme pour les idées, l'absence d'avis n'est
 * pas un « ni l'un ni l'autre » — c'est « personne n'a répondu ». */
export const PORTRAIT_STATUSES = ["generated", "composed", "approved", "rejected"] as const;
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

/* LA LISTE, EXPORTÉE — elle ne l'était pas, et `openapi.ts` la composait en
   ligne. Chaque client la rebâtissait donc chez lui, et deux recompositions
   finissent par diverger : c'est la même famille de piège que `personDisplayName`
   absent de la contribution. L'enveloppe `{ portraits }` plutôt qu'un tableau nu
   est ce que la route rend déjà ; on ne la change pas, on la nomme. */
export const portraitListSchema = z.object({
  portraits: z.array(portraitSchema),
}).strict();

export type PortraitList = z.infer<typeof portraitListSchema>;

/* CHANGER LA NOTE DE L'EXPÉDITEUR — « Fait avec soin par Valentine ».
 *
 * Elle est « proposée puis modifiable » (spec §79), et se retire : `null` est
 * donc une valeur, pas une absence. L'omettre voudrait dire « ne touche pas »,
 * c'est-à-dire l'inverse du geste.
 *
 * AVANT LA COMPOSITION SEULEMENT. Après, elle est dans les pixels du fichier :
 * la changer ne changerait plus l'image, et l'accepter promettrait un effet qui
 * n'arrive pas — exactement le genre de réglage qui ne règle rien. La route
 * rend 409 sur un portrait déjà composé.
 *
 * Cette route N'EXISTAIT PAS. L'écran envoyait pourtant ce `PATCH` depuis le
 * premier jour, et l'interrupteur échouait donc en silence. */
export const updatePortraitSchema = z.object({
  senderNote: z.string().trim().max(120).nullable(),
}).strict();

export type UpdatePortraitInput = z.infer<typeof updatePortraitSchema>;

// ── Le brouillon de message ─────────────────────────────────────────────────

/* `rejected` est DISTINCT d'`edited`, qui dit « je l'ai arrangé » : un message
   corrigé reste un message qu'on garde, et les confondre mesurerait la retouche
   au lieu du ratage. */
export const MESSAGE_STATUSES = ["generated", "edited", "sent", "rejected"] as const;
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
  /* « Celui-là ne va pas. » C'est l'avis qui manquait, et sans lequel publier
     une configuration ne se mesure pas : un pouce en bas dit quelque chose,
     l'absence de geste ne dit rien.
     Il ne se combine à RIEN — ni à une correction, ni à un envoi. Corriger un
     message qu'on rejette n'a pas de sens, et l'envoyer non plus ; les accepter
     ensemble laisserait deux gestes contradictoires décider par leur ordre
     d'application. */
  markRejected: z.boolean().optional(),
}).strict()
  .refine(
    (v) => v.content !== undefined || v.markSent !== undefined || v.markRejected !== undefined,
    { message: "au moins un champ doit être fourni" },
  )
  .refine(
    (v) => v.markRejected !== true || (v.content === undefined && v.markSent !== true),
    { message: "un rejet ne se combine ni à une correction ni à un envoi" },
  );

export type UpdateMessageInput = z.infer<typeof updateMessageSchema>;

// ── Les idées produites ─────────────────────────────────────────────────────

/**
 * Une idée du jeu.
 *
 * **Noter et retenir sont deux gestes distincts**, et les confondre détruirait
 * le signal qu'on vient chercher. Quelqu'un peut trouver une idée excellente et
 * ne pas la retenir — budget, déjà offerte l'an dernier, pas pour cette
 * personne-là. « Bonne idée, mauvais moment » est précisément ce qui distingue
 * une invite qui produit du juste d'une invite qui produit du plausible.
 */
export const generatedIdeaSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  /** Ce qui, dans les notes, mène à cette idée. C'est lui qui la rend retenable
   *  plutôt que générique : « un carnet » ne vaut rien, « un carnet, parce
   *  qu'elle écrit dans le train tous les matins » se retient. */
  details: z.string().nullable(),
  /** Une fourchette indicative, ou rien. Jamais une borne seule : un prix qu'on
   *  ne sait pas lire vaut moins que pas de prix du tout. */
  priceMin: z.number().nullable(),
  priceMax: z.number().nullable(),
  currency: z.string().nullable(),
  /** `null` = personne n'a répondu, ce qui n'est PAS « ni l'un ni l'autre » et
   *  ne se compte pas de la même façon dans une moyenne. */
  feedback: z.enum(["up", "down"]).nullable(),
  /** Le souhait né de cette idée, s'il y en a un. Reste nul quand on l'a notée
   *  sans la retenir — et c'est le cas le plus fréquent. */
  wishlistItemId: z.string().uuid().nullable(),
}).strict();

export type GeneratedIdea = z.infer<typeof generatedIdeaSchema>;

/** Le jeu produit par une génération. C'est lui que `resultId` désigne. */
export const generatedIdeaSetSchema = z.object({
  id: z.string().uuid(),
  occurrenceId: z.string().uuid().nullable(),
  ideas: z.array(generatedIdeaSchema),
  createdAt: z.string(),
}).strict();

export type GeneratedIdeaSet = z.infer<typeof generatedIdeaSetSchema>;

/** Ce qu'on porte sur une idée. `null` retire l'avis — un avis se change et se
 *  reprend, sans quoi un doigt qui glisse serait définitif. */
/* L'AVIS SUR UNE PRODUCTION — une seule forme, partout.
 *
 * Les idées le portaient les premières, d'où l'ancien nom. Le portrait et le
 * message le portent désormais aussi, et la forme est la même : un pouce, ou
 * son retrait. En écrire une seconde pour les deux autres ferait deux vérités
 * à tenir d'accord, et l'une prendrait un jour un troisième cran que l'autre
 * n'aurait pas.
 *
 * `null` RETIRE l'avis : un doigt qui glisse serait sinon définitif, et une
 * note qu'on ne peut pas corriger est une note qu'on cesse de donner. */
export const avisSchema = z.object({
  feedback: z.enum(["up", "down"]).nullable(),
}).strict();

export type AvisInput = z.infer<typeof avisSchema>;

/** L'ancien nom, gardé : il est câblé au contrat publié et à la route des idées. */
export const ideaFeedbackSchema = avisSchema;
export type IdeaFeedbackInput = AvisInput;

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
  /* Le jeu d'idées, quand c'en était une. Un champ par nature plutôt qu'un
     `result` polymorphe : le client sait ce qu'il a demandé, et une union
     l'obligerait à discriminer avant de lire. Les deux sont nuls sur une
     génération qui a échoué. */
  ideas: generatedIdeaSetSchema.nullable(),
}).strict();

export const generationsSchema = z.object({
  generations: z.array(generationResultSchema),
}).strict();

export type GenerationResult = z.infer<typeof generationResultSchema>;

