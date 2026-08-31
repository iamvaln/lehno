import { z } from "zod";
import { currencySchema } from "./me-wishes.js";
import { usernameSchema } from "./profile.js";
import { COLLECTION_LINK_TYPES, WISH_REVIEWS, SUBMISSION_STATUSES } from "./me-contributions.js";
import { NATURES_EXPOSABLES } from "./me-app.js";

/* Le Mur et la collecte, CÔTÉ PUBLIC — spec technique §7, UX surfaces
 * publiques §3.2 à §3.5.
 *
 * Ces formes sont servies SANS SESSION. Le jeton porté par le lien désigne la
 * ressource et vaut permission, rien d'autre : il n'identifie personne. Tout
 * ce qui figure ici est donc lisible par quiconque détient le lien — et c'est
 * la seule question à se poser avant d'ajouter un champ.
 *
 * Les formes de l'espace privé vivent ailleurs (me-app.ts pour le Mur,
 * me-contributions.ts pour les contributions) et ne se réutilisent PAS ici :
 * elles portent des identifiants et des états que le public n'a pas à voir.
 * Deux publics, deux formes.
 */

// ── Le Mur public (§3.4) ────────────────────────────────────────────────────

export const publicWallInterestSchema = z.object({
  kind: z.enum(NATURES_EXPOSABLES),
  value: z.string(),
}).strict();

export const publicWallSchema = z.object({
  username: z.string(),
  /* Le nom sous lequel le propriétaire se présente. Jamais son adresse
     électronique, jamais son identifiant : la page dit qui reçoit, pas
     comment le joindre. */
  displayName: z.string(),
  welcomeMessage: z.string().nullable(),
  /* JOUR ET MOIS, « MM-DD », jamais l'année.
   *
   * Le Mur annonce un anniversaire, pas une date de naissance : l'année dirait
   * l'âge à tout visiteur, et §3.4 ne demande qu'une « simple mention » de la
   * date. Nulle si le propriétaire ne l'expose pas, ou s'il ne l'a pas
   * renseignée — les deux se confondent, et c'est voulu. */
  birthday: z.string().regex(/^\d{2}-\d{2}$/).nullable(),
  interests: z.array(publicWallInterestSchema),
  /* Le jeton de dépôt de vœux de l'occasion en cours, ou nul.
   *
   * Nul quand il n'y a pas d'occasion, quand la fenêtre est fermée, ou quand
   * le drapeau `wishes` est éteint. Le serveur RÉSOUT les trois : un client
   * n'a aucune règle à connaître, et ne peut donc pas proposer un bouton qui
   * mènerait à un 404. */
  wishLinkToken: z.string().nullable(),
}).strict();

export type PublicWall = z.infer<typeof publicWallSchema>;

// ── La collecte (§3.2 et §3.3) ──────────────────────────────────────────────

export const publicCollectFormSchema = z.object({
  type: z.enum(COLLECTION_LINK_TYPES),
  /* Qui invite. Un lien de collecte vient de quelqu'un — le formulaire le dit,
     sans quoi le répondant ne sait pas à qui il écrit. */
  ownerDisplayName: z.string(),
  /* La fiche visée, et sa date déjà connue : « pré-remplie si le propriétaire
     l'a déjà renseignée, à confirmer ou corriger » (§3.2). Nulles sur un lien
     PUBLIC, qui ne vise personne — les servir y révélerait une fiche à
     quiconque partage l'adresse. */
  personDisplayName: z.string().nullable(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /* Le CTA « visiter le mur de […] », discret et propre à la collecte (§5).
     Nul si le propriétaire n'a pas publié son Mur : proposer un lien vers une
     page dépubliée apprendrait qu'elle existe. */
  ownerWallUsername: z.string().nullable(),
}).strict();

export type PublicCollectForm = z.infer<typeof publicCollectFormSchema>;

/* Un souhait soumis. Pas de `details` ni d'image : le formulaire public reste
   court — on écrit ce qu'on voudrait, un lien et un prix si on les a. Le reste
   se dit dans le mot. */
export const submittedWishInputSchema = z.object({
  label: z.string().trim().min(1).max(200),
  link: z.string().url().max(2048).optional(),
  price: z.number().nonnegative().optional(),
  currency: currencySchema.optional(),
}).strict().superRefine((v, ctx) => {
  // Même règle que sur les souhaits du carnet : « 12 000 » ne dit ni des
  // francs CFA ni des euros, et le propriétaire lira ce montant.
  if (v.price != null && !v.currency) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["currency"], message: "un prix porte sa devise" });
  }
});

/* TOUT CE QUI ENTRE ICI VIENT D'UN INCONNU.
 *
 * Chaque champ est borné, y compris ceux que le propriétaire ne verra jamais :
 * une borne oubliée est une colonne texte qu'on remplit de mégaoctets. Les
 * bornes sont larges pour un humain et étroites pour un robot.
 */
export const collectSubmitSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  wishes: z.array(submittedWishInputSchema).max(20).optional(),
  personalNote: z.string().trim().max(2000).optional(),
  /* « Simple champ de contact, pas un abonnement : aucune case à cocher »
     (§3.2). Il sert au propriétaire à demander une précision, à rien d'autre. */
  submitterEmail: z.string().email().max(254).optional(),
  /* AUTO-DÉCLARÉ, sur un formulaire sans connexion : un rattachement souple,
     confirmé à la validation, jamais une authentification. Même forme que
     partout ailleurs — `usernameSchema` est déclaré une seule fois. */
  submitterUsername: usernameSchema.optional(),
  // Lien PUBLIC seulement ; sur un nominatif, le propriétaire sait déjà qui il
  // a invité, et les redemander ferait douter le répondant d'être au bon endroit.
  submitterName: z.string().trim().max(80).optional(),
  relationHint: z.string().trim().max(120).optional(),
  /* Champ leurre et instant de rendu : même rôle et même unique code de refus
     qu'aux formulaires de liste d'attente et de contact (voir public.ts). Ils
     figurent au contrat, sinon le `.strict()` les refuserait par une erreur de
     validation — ce qui apprendrait au robot que le leurre existe. */
  website: z.string().max(254).optional(),
  renderedAt: z.number().int().positive().optional(),
}).strict().superRefine((v, ctx) => {
  // Une soumission vide n'apprend rien et encombre la file de validation. Ce
  // n'est pas une protection — c'est le formulaire qui refuse d'être envoyé à
  // blanc, comme l'écran le fait déjà côté client.
  const rien = v.birthDate === undefined
    && (v.wishes === undefined || v.wishes.length === 0)
    && (v.personalNote === undefined || v.personalNote === "");
  if (rien) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "une contribution porte au moins une date, un souhait ou un mot" });
  }
});

export type CollectSubmitInput = z.infer<typeof collectSubmitSchema>;

export const collectSubmitResponseSchema = z.object({ submitted: z.literal(true) }).strict();

/* Ce que CE répondant a déjà envoyé, avec le sort de chaque souhait (§3.2,
 * « à la réouverture »).
 *
 * Servi sur les seuls liens NOMINATIFS. Un lien public est partagé au monde :
 * y rendre les contributions ferait lire à n'importe quel visiteur ce que tous
 * les autres ont écrit — leur nom, leur mot, leur adresse. Le jeton d'un lien
 * nominatif, lui, ne désigne qu'une personne, et c'est ce qui rend la relecture
 * légitime.
 *
 * Ni l'adresse ni le pseudo du répondant n'y reparaissent : il les a écrits, il
 * les connaît, et les rendre ferait de ce chemin un moyen de les lire pour qui
 * détiendrait le lien.
 */
export const publicSubmissionSchema = z.object({
  createdAt: z.string(),
  status: z.enum(SUBMISSION_STATUSES),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  personalNote: z.string().nullable(),
  wishes: z.array(z.object({
    label: z.string(),
    reviewStatus: z.enum(WISH_REVIEWS),
  }).strict()),
}).strict();

export type PublicSubmission = z.infer<typeof publicSubmissionSchema>;

export const publicSubmissionsSchema = z.object({
  submissions: z.array(publicSubmissionSchema),
}).strict();

export type PublicSubmissions = z.infer<typeof publicSubmissionsSchema>;

// ── Le dépôt de vœux (§3.5) ─────────────────────────────────────────────────

/* La page s'ouvre MÊME HORS FENÊTRE, et rend alors les dates.
 *
 * §3.9 demande « les vœux pour cet anniversaire ne sont pas ouverts en ce
 * moment (± indiquer quand) » : une page qui refuse de se charger ne peut pas
 * dire quand revenir. C'est le DÉPÔT qui refuse (`wish_window_closed`), pas la
 * lecture — « jamais un formulaire qui échoue en silence » (§6).
 */
export const publicWishFormSchema = z.object({
  recipientDisplayName: z.string(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowOpensOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  windowClosesOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isOpen: z.boolean(),
}).strict();

export type PublicWishForm = z.infer<typeof publicWishFormSchema>;

export const submitWishSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  // « Nom de l'auteur (ou signature libre) ; facultatif » (§3.5). Absent, le
  // vœu arrive anonyme — et le propriétaire le lit tel quel.
  authorName: z.string().trim().max(80).optional(),
  // Mêmes deux filtres, même unique code de refus.
  website: z.string().max(254).optional(),
  renderedAt: z.number().int().positive().optional(),
}).strict();

export type SubmitWishInput = z.infer<typeof submitWishSchema>;

export const submitWishResponseSchema = z.object({ submitted: z.literal(true) }).strict();
