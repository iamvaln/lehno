import { z } from "zod";
import { dateCivileSchema, bornerLaNaissance } from "./me-events.js";

// Le registre de langage gouverne le ton de ce que le produit écrira pour ce
// proche. Ensemble fixe : enum person_register du dictionnaire.
export const PERSON_REGISTERS = ["familier", "amical", "formel"] as const;
export type PersonRegister = (typeof PERSON_REGISTERS)[number];

// Le lien avec ce proche. Il oriente le ton et les idées de cadeaux — d'où une
// énumération, que la génération sait lire, plutôt qu'un texte libre.
export const PERSON_RELATIONS = [
  "famille_proche", "famille_etendue", "ami", "partenaire",
  "collegue", "relation_pro", "connaissance",
] as const;
export type PersonRelation = (typeof PERSON_RELATIONS)[number];

// Signal de DERNIER recours : il oriente des idées de cadeaux lorsque rien
// d'autre n'est disponible. Une seule note bien prise vaut mieux que lui.
// « unspecified » est une valeur légitime, jamais un champ à remplir.
export const PERSON_GENDERS = ["female", "male", "other", "unspecified"] as const;
export type PersonGender = (typeof PERSON_GENDERS)[number];

// Par où on lui écrit d'ordinaire : oriente la LONGUEUR du message produit —
// on n'écrit pas la même chose par SMS et par courriel.
export const CONTACT_CHANNELS = ["whatsapp", "sms", "email", "autre"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const personSchema = z
  .object({
    id: z.string().uuid(),
    displayName: z.string(),
    // Comment on l'APPELLE, par opposition à comment on le liste. C'est ce nom
    // qui paraît dans les contenus générés ; à défaut, displayName.
    callingName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    isSelf: z.boolean(),
    // `relation` et `relationHint` coexistent, et ce n'est pas une redondance :
    // l'énumération sert la génération, le texte libre garde la nuance qu'elle
    // écrase — « on a fait la fac ensemble » ne rentre dans aucune case.
    relation: z.enum(PERSON_RELATIONS).nullable(),
    relationHint: z.string().nullable(),
    // Sa date de naissance — un fait de son IDENTITÉ. L'anniversaire n'en est
    // qu'une conséquence : le prochain jour de l'année portant le même jour et
    // le même mois.
    birthDate: z.string().nullable(),
    // Faux quand on connaît le jour et le mois sans l'année : on suit alors
    // l'anniversaire sans pouvoir annoncer d'âge.
    birthYearKnown: z.boolean(),
    gender: z.enum(PERSON_GENDERS).nullable(),
    city: z.string().nullable(),
    country: z.string().nullable(),
    register: z.enum(PERSON_REGISTERS).nullable(),
    language: z.string().nullable(),
    preferredChannel: z.enum(CONTACT_CHANNELS).nullable(),
    createdAt: z.string(),
  })
  .strict();

export type Person = z.infer<typeof personSchema>;

// userId n'y figure pas, et c'est délibéré : une colonne d'appartenance ne
// franchit jamais la frontière. Le serveur sait à qui appartient la fiche, le
// client n'a pas à le lui rappeler — ni à pouvoir l'écrire.
/* La FORME, séparée de ses règles — et EXPORTÉE.
 *
 * Elle sort d'ici parce qu'un test s'en sert pour vérifier que le service
 * écrit bien TOUS les champs du contrat : il dérive la liste attendue de cette
 * forme plutôt que de la recopier, et rougit donc dès qu'un champ est ajouté
 * ici sans l'être là-bas.
 *
 * `.superRefine()` rend un ZodEffects, sur lequel `.partial()` n'existe pas :
 * dériver la correction de la création écrirait un code qui ne compile pas.
 * On garde donc l'objet nu ici, et chacun des deux schémas y ajoute les
 * règles qui le concernent. */
export const champsDeProche = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    callingName: z.string().trim().max(80).optional(),
    avatarUrl: z.string().url().max(2048).optional(),
    relation: z.enum(PERSON_RELATIONS).optional(),
    register: z.enum(PERSON_REGISTERS).optional(),
    // Langue de ce que le produit écrira POUR ce proche — distincte de la langue
    // d'interface du propriétaire.
    language: z.enum(["fr", "en"]).optional(),
    // « ma sœur », « mon voisin » : une aide à la génération, pas une taxonomie.
    relationHint: z.string().trim().max(80).optional(),
    // Les bornes s'appliquent PLUS BAS, au niveau de l'objet : elles dépendent
    // de `birthYearKnown`, que ce champ seul ne voit pas.
    birthDate: dateCivileSchema.optional(),
    birthYearKnown: z.boolean().optional(),
    gender: z.enum(PERSON_GENDERS).optional(),
    city: z.string().trim().max(120).optional(),
    // ISO 3166-1 alpha-2, en majuscules. Deux lettres exactement : un pays
    // écrit en toutes lettres ne sert à rien à qui doit le comparer.
    country: z.string().trim().length(2).regex(/^[A-Za-z]{2}$/).toUpperCase().optional(),
    preferredChannel: z.enum(CONTACT_CHANNELS).optional(),
  })
  .strict();

/* Les bornes de la naissance se vérifient au niveau de l'OBJET, parce
   qu'elles dépendent de DEUX champs : la date, et le fait que son année soit
   connue. Un contrôle posé sur le seul champ de date ne verrait pas le
   second, et rejetterait l'année sentinelle d'une naissance dont on ne
   connaît que le jour et le mois. */
const bornerLaNaissanceDe = (
  v: { birthDate?: string | undefined; birthYearKnown?: boolean | undefined },
  ctx: z.RefinementCtx,
): void => {
  if (v.birthDate !== undefined) {
    bornerLaNaissance(v.birthDate, v.birthYearKnown ?? true, ctx, ["birthDate"]);
  }
};

export const createPersonSchema = champsDeProche.superRefine(bornerLaNaissanceDe);

export type CreatePersonInput = z.infer<typeof createPersonSchema>;

// Le partiel de la création : mêmes champs, mêmes bornes, tous facultatifs.
// Dérivé plutôt que réécrit — deux déclarations divergeraient, et la
// validation d'une correction finirait par être plus laxiste que celle d'une
// création.
export const updatePersonSchema = champsDeProche
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "au moins un champ doit être fourni",
  })
  // Les mêmes bornes qu'à la création : une naissance corrigée après coup ne
  // doit pas pouvoir devenir ce qu'elle n'aurait jamais pu être à la saisie.
  .superRefine(bornerLaNaissanceDe);

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

// ── Les notes ───────────────────────────────────────────────────────────────

// L'ensemble FIXE du système : aucune catégorie personnalisée. Cinq
// ponctuelles, deux durables — voir la doc fonctionnelle §8.
export const CATEGORY_CODES = [
  "gift_ideas", "message_ideas", "facts", "encouragements", "challenges",
  "interests", "dislikes_nogo",
] as const;
export type CategoryCode = (typeof CATEGORY_CODES)[number];

export const noteSchema = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid(),
  content: z.string(),
  // Nul pour une note DURABLE — elle décrit le proche et vaut d'une année sur
  // l'autre. Renseigné pour une note de circonstance, qui appartient à une
  // occasion. C'est ce champ, et lui seul, qui distingue les deux natures.
  eventOccurrenceId: z.string().uuid().nullable(),
  // Peut être VIDE, et c'est un état valide : une note que le système n'a pas
  // su ranger reste telle qu'elle a été saisie. Aucun repli sur une catégorie
  // fourre-tout — « Faits marquants » a un sens précis et n'est pas une
  // corbeille. La génération lit le CONTENU, rangé ou non.
  categories: z.array(z.enum(CATEGORY_CODES)),
  createdAt: z.string(),
}).strict();

export type Note = z.infer<typeof noteSchema>;

export const createNoteSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  eventOccurrenceId: z.string().uuid().optional(),
}).strict();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

// Une même note, écrite pour plusieurs proches à la fois. Elle se DUPLIQUE :
// chaque proche reçoit la sienne, indépendante ensuite — corriger le
// classement de l'une ne touche pas les autres, et supprimer un proche
// n'emporte pas les notes des autres.
export const createNotesSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  // Au moins un proche, et pas cinquante : une note se partage entre quelques
  // personnes, elle ne se diffuse pas.
  personIds: z.array(z.string().uuid()).min(1).max(20),
  eventOccurrenceId: z.string().uuid().optional(),
}).strict();

export type CreateNotesInput = z.infer<typeof createNotesSchema>;
