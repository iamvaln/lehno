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
    // `gender` NE FIGURE PAS ici, et c'est le point : le carnet ne pose pas la
    // question (handoff proches, « Le genre n'a pas de champ »). Tant qu'il
    // traversait jusqu'au client, la règle ne tenait que par la retenue de
    // celui-ci — rien n'empêchait un écran de l'afficher un jour. Retiré du
    // contrat, il devient inécrivable, pas seulement non demandé. La colonne
    // reste en base : c'est un signal de génération, déduit côté serveur.
    city: z.string().nullable(),
    country: z.string().nullable(),
    register: z.enum(PERSON_REGISTERS).nullable(),
    language: z.string().nullable(),
    preferredChannel: z.enum(CONTACT_CHANNELS).nullable(),
    createdAt: z.string(),
    // Le décompte des notes DURABLES. Il paraît sur chaque ligne du carnet
    // (« 3 notes »), et l'obtenir autrement demanderait un appel par proche —
    // quarante-trois sur le carnet d'essai du handoff.
    notesCount: z.number().int().nonnegative(),
    // La prochaine échéance de ce proche, ou rien s'il n'a aucune date. La
    // ligne l'affiche en repère, le décompte s'y calcule, et c'est sur elle que
    // porte le tri « par date » : sans elle côté serveur, ce tri ne peut pas
    // être servi. Un proche sans date passe en FIN de liste dans les deux sens
    // — jamais en tête, où il occuperait la place de ce qui presse.
    nextOccurrence: z
      .object({
        id: z.string().uuid(),
        occurrenceDate: z.string(),
        // Signé : négatif si l'échéance est passée, comme sur /me/occurrences.
        daysUntil: z.number().int(),
        kind: z.enum(["birthday", "other"]),
        label: z.string().nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type Person = z.infer<typeof personSchema>;

/* Le carnet se pagine et se trie — les deux sont arrêtés par le handoff, pas à
   re-trancher : vingt par page, « Voir plus · n restants », et changer de tri
   revient à la première page.
   
   Deux critères seulement, chacun avec sa direction : « par date » ne dit rien
   tant qu'on ne sait pas de quel bout. */
export const PERSON_SORTS = ["date", "alpha"] as const;
export type PersonSort = (typeof PERSON_SORTS)[number];

export const SORT_DIRECTIONS = ["asc", "desc"] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

// Vingt : la page du handoff. Écrite ici plutôt que dans le service, pour que
// le client puisse omettre le paramètre et obtenir la page que l'écran attend.
export const PAGE_PROCHES = 20;

export const listPersonsQuerySchema = z
  .object({
    sort: z.enum(PERSON_SORTS).optional(),
    direction: z.enum(SORT_DIRECTIONS).optional(),
    offset: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().max(100).optional(),
  })
  .strict();

export type ListPersonsQuery = z.infer<typeof listPersonsQuerySchema>;

/* Une enveloppe, non plus un tableau nu : « Voir plus · n restants » a besoin
   du total, et un curseur ne sait pas le donner. À l'échelle d'un carnet
   personnel — quelques centaines de fiches au plus — le décalage numéroté est
   exact et suffit ; il faudrait un curseur si la liste pouvait changer sous le
   lecteur entre deux pages, ce qui n'est pas le cas ici : c'est son carnet. */
export const personListSchema = z
  .object({
    persons: z.array(personSchema),
    total: z.number().int().nonnegative(),
  })
  .strict();

export type PersonList = z.infer<typeof personListSchema>;

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

/* Ce que `/me/persons/{id}/notes` rend. Un tableau nu n'a pas de nom, et sans
   nom chaque appelant refait le sien — le client mobile embarquait zod pour
   écrire `z.array(noteSchema)` que voici. Pas d'enveloppe ici, contrairement au
   carnet : les notes d'un proche se comptent en dizaines, elles ne paginent
   pas, et un total n'apprendrait rien qu'on ne voie déjà. */
export const noteListSchema = z.array(noteSchema);

export type NoteList = z.infer<typeof noteListSchema>;

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
