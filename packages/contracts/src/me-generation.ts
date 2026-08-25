import { z } from "zod";

/* Les actions payantes — spec technique §5.4, dictionnaire : PremiumAction,
 * ActionRun, GeneratedProfile, GeneratedMessage.
 */

export const GENERATION_KINDS = ["gift_ideas", "portrait", "wish_message"] as const;
export type GenerationKind = (typeof GENERATION_KINDS)[number];

/* Ce que le portrait exprime. Elle commande le texte comme l'illustration, et
   c'est pour cela qu'elle est le premier choix du studio. Douze valeurs, dans
   l'ordre de fréquence de l'écran plutôt que dans celui du dictionnaire. */
export const PORTRAIT_ORIENTATIONS = [
  "relation", "character", "gratitude", "pride", "affection",
  "your_progress", "our_progress", "what_you_taught_me", "wish",
  "motivation", "support",
  // À part : `tribute` neutralise l'accent chaud, écarte toute illustration
  // joyeuse et emprunte un registre sobre. Une occasion sensible ne partage pas
  // le gabarit d'une déclaration de fierté.
  "tribute",
] as const;
export type PortraitOrientation = (typeof PORTRAIT_ORIENTATIONS)[number];

export const PORTRAIT_VISUALS = ["illustration", "photo", "none"] as const;
export const ILLUSTRATION_FAMILIES = ["nature", "animal", "abstract"] as const;

/* Le dictionnaire les laissait à arrêter — « trois styles définis par la
   marque ; leurs noms restent à arrêter ». Le design system les a nommés, et
   ce sont des noms de marque, pas des mots à traduire. */
export const PHOTO_STYLES = ["lumiere", "serigraphie", "silhouette"] as const;

const cible = z.object({
  // Un portrait vise le proche : il se génère à tout moment depuis sa fiche, et
  // plusieurs coexistent dans le temps pour donner à voir l'évolution.
  personId: z.string().uuid().optional(),
  // Un message de vœux vise l'occasion — c'est l'année concernée qui l'ancre.
  occurrenceId: z.string().uuid().optional(),
  // Une même demande relancée rejoint la génération en cours plutôt que d'en
  // créer une seconde, et ne débite qu'une fois.
  idempotencyKey: z.string().min(1).max(128).optional(),
});

const reglagesDuPortrait = z.object({
  orientation: z.enum(PORTRAIT_ORIENTATIONS).optional(),
  visualKind: z.enum(PORTRAIT_VISUALS).optional(),
  illustrationFamily: z.enum(ILLUSTRATION_FAMILIES).optional(),
  photoStyle: z.enum(PHOTO_STYLES).optional(),
  // Ce que l'utilisateur ajoute pour orienter le dessin. Conservé le temps de
  // la génération seulement, et l'écran le dit là où on le remplit.
  briefText: z.string().trim().max(280).optional(),
  senderNote: z.string().trim().max(120).optional(),
  // Les paramètres absents prennent la valeur de la fiche.
  tone: z.string().trim().max(40).optional(),
  language: z.enum(["fr", "en"]).optional(),
  sourceFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sourceTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const startGenerationSchema = z.object({ kind: z.enum(GENERATION_KINDS) })
  .merge(cible)
  .merge(reglagesDuPortrait)
  .strict()
  .superRefine((v, ctx) => {
    if (v.kind === "portrait" && !v.personId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personId"], message: "un portrait vise un proche" });
    }
    if (v.kind !== "portrait" && !v.occurrenceId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["occurrenceId"], message: "cette action vise une occasion" });
    }
    if (v.kind !== "portrait" && v.personId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personId"], message: "seule une occasion est visée ici" });
    }
    if (v.kind !== "portrait") return;

    /* Une seule voie d'image à la fois. L'écran le tient déjà — choisir
       « aucune image » retire la famille, le style et le texte libre — mais un
       client qui enverrait les deux produirait une image que rien ne décrit. */
    const illustre = v.visualKind === "illustration";
    const photographie = v.visualKind === "photo";

    if (illustre && v.photoStyle) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["photoStyle"], message: "une illustration n'a pas de style de photo" });
    }
    if (photographie && v.illustrationFamily) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["illustrationFamily"], message: "une photo n'a pas de famille d'illustration" });
    }
    if (illustre && !v.illustrationFamily) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["illustrationFamily"], message: "une illustration porte sa famille" });
    }
    if (photographie && !v.photoStyle) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["photoStyle"], message: "une photo porte son style" });
    }
    if (v.visualKind === "none" && (v.illustrationFamily || v.photoStyle || v.briefText)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visualKind"], message: "sans image, aucun réglage d'image" });
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
