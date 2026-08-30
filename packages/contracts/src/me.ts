import { z } from "zod";
import { dateCivileSchema, bornerLaNaissance } from "./me-events.js";

/**
 * Les genres, pour l'accord grammatical — et **deux valeurs seulement**.
 *
 * C'est ce que les deux écrans d'identité proposent (§3.18, §3.23), et rien
 * d'autre. La colonne en base porte encore `other` et `unspecified` : le
 * contrat les refuse plutôt que de les migrer, parce qu'un état qu'aucun écran
 * ne produit n'a pas à pouvoir s'écrire. Ce que la base tolère et ce que le
 * produit accepte ne sont pas la même chose.
 *
 * `unspecified` reste possible EN LECTURE, et seulement là : c'est l'état d'une
 * ligne écrite avant cette règle, ou d'un compte dont l'inscription n'a jamais
 * posé la question — l'inscription se fait par code à usage unique, pas par
 * formulaire. Le contrat le rend `null` : une absence de réponse est une
 * absence, pas une troisième réponse.
 */
export const PERSON_GENDERS = ["female", "male"] as const;
export type PersonGender = (typeof PERSON_GENDERS)[number];

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
    /* Le genre sert L'ACCORD GRAMMATICAL, et rien d'autre — « fier » ou
     * « fière ». Ce n'est pas un signal d'orientation des cadeaux, c'est de la
     * grammaire, et c'est l'aide sous le champ qui le dit : « Pour que les
     * messages soient écrits correctement. »
     *
     * Le libellé, lui, est « Genre » — celui du kit. Un commentaire du kit
     * proposait « Accord du message » ; sa copy dit « Genre », et c'est la copy
     * qui fait foi. Un libellé n'est pas une explication : « Accord du message »
     * décrit à quoi la réponse sert, pas ce qu'on demande, et personne ne
     * reconnaît son propre champ derrière une périphrase.
     *
     * IL SE LIT, et il le faut : le formulaire d'identité (§3.18) porte un
     * sélecteur, donc l'ouvrir pour corriger autre chose doit montrer ce qui a
     * été répondu. L'en retirer ferait repartir le champ à vide à chaque
     * modification, et redemanderait la question sans raison.
     *
     * Ce qui reste vrai, et qui est une règle de RÉDACTION : « aucune phrase de
     * l'interface ne s'en sert » (handoff mobile). Il remplit son propre champ
     * et ne paraît nulle part ailleurs — ni dans une liste de proches, ni dans
     * un tri, ni dans une copy.
     *
     * Ce commentaire disait auparavant « déduit côté serveur ». C'était faux :
     * un genre ne se devine pas, il se demande — et le déduire d'un prénom est
     * exactement le raccourci qui se trompe sur les gens.
     *
     * NULLABLE en lecture seulement, pour les fiches antérieures à la règle. Une
     * fiche créée aujourd'hui en porte toujours un : voir `champsDeProche`. */
    gender: z.enum(PERSON_GENDERS).nullable(),
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
    /* La recherche du carnet (§3.15). Elle vit ICI et non sur un chemin à part
       parce qu'elle doit se COMBINER au tri et à la pagination : §3.15 demande
       des résultats « classés par proximité de leur prochaine échéance », donc
       le même tri que la liste, et un carnet fourni peut rendre plus de vingt
       correspondances.
       
       Sans elle, l'écran de recherche filtrait la page déjà chargée — vingt
       fiches — et un proche de la troisième page restait introuvable. Le
       contourner en demandant tout le carnet annulerait la pagination qu'on
       vient de poser. */
    q: z.string().trim().min(1).max(120).optional(),
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
    /* OBLIGATOIRE, et c'est le seul champ de la fiche qui le soit avec le nom.
     *
     * En français on n'écrit pas à quelqu'un sans le savoir. Le rendre
     * facultatif produirait des messages en tournures contournées pour tous
     * ceux qui auraient sauté le champ — c'est-à-dire la plupart —, et
     * personne n'aurait su pourquoi les textes sonnaient bizarrement.
     *
     * Le libellé à l'écran est « Genre », celui du kit. Ce qui le distingue
     * d'un signal d'orientation des cadeaux n'est pas son nom mais l'aide qui
     * l'accompagne : « Pour que les messages soient écrits correctement. » */
    gender: z.enum(PERSON_GENDERS),
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
}).strict().superRefine((v, ctx) => {
  /* UNE OCCASION APPARTIENT À UN SEUL PROCHE.
   *
   * Quand plusieurs proches partagent une date — un mariage, une sortie —, ce
   * sont plusieurs occasions, une par personne : le rappel les nomme une à une,
   * et la génération de message lit UN profil. Il n'existe donc aucune
   * occurrence qui couvre vingt proches.
   *
   * Sans ce refus, dix-neuf notes se rattachaient à la date de quelqu'un
   * d'autre. Elles ne partent nulle part — un proche n'est pas destinataire —,
   * mais elles ressortent : ouvrir une occasion affiche ses notes, et on lirait
   * là ce qui a été écrit sur d'autres.
   *
   * Le service le vérifie AUSSI, et pour une autre raison : le schéma sait que
   * l'occurrence ne peut pas couvrir vingt proches, il ne sait pas si elle
   * couvre CELUI-LÀ. */
  if (v.eventOccurrenceId !== undefined && new Set(v.personIds).size > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["eventOccurrenceId"],
      message: "une note de circonstance ne vaut que pour le proche dont c'est l'occasion",
    });
  }
});

export type CreateNotesInput = z.infer<typeof createNotesSchema>;

// ——— Le topo d'un proche ——————————————————————————————————————————

/**
 * Ce qu'une note a appris d'une personne.
 *
 * **Rien ne se saisit.** Ces valeurs sont extraites des notes par la passe qui
 * les classe déjà — aucun appel de plus, les mêmes valeurs de sortie avec
 * quelques champs en plus. Corriger, c'est écrire une note nouvelle.
 *
 * C'est ce qui distingue ce bloc du résumé qu'on avait écarté pour l'accueil :
 * là il fallait **composer** un texte, ici il n'y a qu'à **extraire**.
 */
export const ATTRIBUT_NATURES = [
  "color", "animal", "food", "drink", "clothing_size", "shoe_size",
  "fragrance", "style", "hobby", "occupation", "avoid",
] as const;

export type AttributNature = (typeof ATTRIBUT_NATURES)[number];

export const personAttributeSchema = z
  .object({
    kind: z.enum(ATTRIBUT_NATURES),
    /** La valeur, telle qu'elle a été dite. Aucun libellé : le client traduit `kind`. */
    value: z.string(),
    /**
     * La note d'où l'attribut vient, et sa date. **La provenance voyage avec la
     * valeur** : sans elle, un attribut est une affirmation sans source — on ne
     * peut ni la vérifier, ni remonter à ce qui a été écrit. Un appui y ramène.
     *
     * `noteId` peut être nul si la note a été supprimée depuis ; la valeur
     * demeure, ce qu'elle a appris ne s'efface pas avec sa phrase.
     */
    noteId: z.string().uuid().nullable(),
    observedAt: z.string(),
  })
  .strict();

/**
 * Le topo entier.
 *
 * **Une liste vide est un état normal**, pas un défaut : une fiche neuve n'a
 * rien appris encore. Le client n'affiche alors aucun bloc — jamais une grille
 * de cases vides qui attendraient d'être remplies.
 *
 * Et la composition doit tenir **avec deux valeurs comme avec onze**.
 */
export const personAttributesSchema = z
  .object({ attributes: z.array(personAttributeSchema) })
  .strict();

export type PersonAttribute = z.infer<typeof personAttributeSchema>;
export type PersonAttributes = z.infer<typeof personAttributesSchema>;
