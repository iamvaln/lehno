import { z } from "zod";
import { ORIENTATIONS } from "./gabarits.js";
import { PERSON_REGISTERS, PERSON_RELATIONS } from "./me.js";
import { reglagesMessageSchema, reglagesPortraitSchema } from "./studio.js";

/* Le Studio du portrait, côté administration — `ux-admin-lehno.md` §5.9 et le
 * brief fonctionnel du 27 août.
 *
 * Le vocabulaire est celui du back-office : français, comme le reste de
 * `admin.ts`. Les surfaces `/me/*` parlent anglais parce qu'elles s'adressent
 * à un client tiers ; celle-ci s'adresse à un écran qu'on écrit nous-mêmes.
 */

export const ETATS_CONFIG_STUDIO = ["draft", "published", "superseded"] as const;
export type EtatConfigStudio = (typeof ETATS_CONFIG_STUDIO)[number];

/* Pourquoi une configuration ne se publie pas. Un booléen seul obligerait
 * l'écran à redeviner la règle — et à la redeviner faux le jour où elle
 * change. Ici le serveur dit ce qui manque, et le bouton peut le répéter. */
export const BLOCAGES_PUBLICATION = [
  /** Elle est déjà en service : republier la même n'a pas de sens. */
  "deja_en_service",
  /** Aucun essai réussi ne porte son empreinte (brief fonctionnel §4). */
  "aucun_essai_reussi",
  /** Une version dépassée ne se publie pas : on y REVIENT (retour arrière). */
  "etat_depasse",
] as const;
export type BlocagePublication = (typeof BLOCAGES_PUBLICATION)[number];

/* Une configuration, quelle que soit sa nature. Le corps est identique — seuls
   les `reglages` diffèrent —, d'où la fabrique plutôt que deux déclarations qui
   divergeraient au premier champ ajouté. */
const configurationAvec = <T extends z.ZodTypeAny>(reglages: T) =>
  z.object({
  id: z.string().uuid(),
  etat: z.enum(ETATS_CONFIG_STUDIO),
  /* Nul tant qu'elle n'a jamais été publiée.
   *
   * ÉCART ASSUMÉ AVEC LE DICTIONNAIRE, qui décrit `version` comme non nul et
   * s'incrémentant « à chaque publication ». Avec le chaînage des brouillons
   * (brief fonctionnel §1), une ligne naît à chaque prévisualisation : leur
   * donner un numéro ferait sauter la numérotation des versions publiées de
   * trente en trente, et le numéro cesserait de désigner un contenu servi. */
  version: z.number().int().positive().nullable(),
  /** L'empreinte de la partie lue par le modèle. C'est elle que la règle de
   *  publication compare, jamais `reglages` entier. */
  empreinte: z.string(),
  reglages,
  note: z.string().nullable(),
  publieeLe: z.string().nullable(),
  parQui: z.string().nullable(),
  creeeLe: z.string(),
  /** Le nombre d'essais RÉUSSIS couvrant cette empreinte, la sienne comprise. */
  essaisReussis: z.number().int().min(0),
  publiable: z.boolean(),
  blocage: z.enum(BLOCAGES_PUBLICATION).nullable(),
}).strict();

export const configurationMessageSchema = configurationAvec(reglagesMessageSchema);
export const configurationPortraitSchema = configurationAvec(reglagesPortraitSchema);

export type ConfigurationMessage = z.infer<typeof configurationMessageSchema>;
export type ConfigurationPortrait = z.infer<typeof configurationPortraitSchema>;

/* Les deux écrans du brief de design en un seul appel : ce qui tourne, et ce
   qu'on est en train de composer. Deux points d'entrée obligeraient l'atelier à
   deux allers-retours pour afficher son comparatif, qui les montre côte à
   côte. */
const etatAvec = <T extends z.ZodTypeAny>(config: T) =>
  z.object({ enService: config.nullable(), brouillon: config.nullable() }).strict();

export const etatMessageSchema = etatAvec(configurationMessageSchema);
export const etatPortraitSchema = etatAvec(configurationPortraitSchema);

export const historiqueMessageSchema = z.object({
  items: z.array(configurationMessageSchema),
}).strict();

export const historiquePortraitSchema = z.object({
  items: z.array(configurationPortraitSchema),
}).strict();

/* L'enregistrement DIRECT : ce que seule l'application lit (brief §3).
 *
 * Il n'emporte pas de motif, et c'est cohérent avec la prévisualisation : un
 * brouillon ne change rien pour personne tant qu'il n'est pas publié. Exiger
 * une phrase à chaque réordonnancement la rendrait vide. */
/* Nommé PORTRAIT, et pas « direct » : c'est la nature qui décide de ce que le
   corps contient. Un atelier du message aura le sien le jour où il existera —
   déclarer aujourd'hui un schéma que rien n'emploie donnerait l'illusion d'une
   surface posée. */
export const enregistrementPortraitSchema = z.object({
  reglages: reglagesPortraitSchema,
}).strict();

/* La publication. `note` EST le motif : « ce que cette publication change, en
   une ligne ». Un champ pour l'historique et un autre pour le journal d'audit
   feraient écrire deux fois la même phrase, et la seconde serait bâclée. */
export const publicationStudioSchema = z.object({
  configId: z.string().uuid(),
  note: z.string().trim().max(500),
}).strict();

export const retourArriereStudioSchema = z.object({
  configId: z.string().uuid(),
  reason: z.string().trim().max(500),
}).strict();

// ── Les profils de simulation ───────────────────────────────────────────────

export const GENRES_SIMULES = ["female", "male", "other", "unspecified"] as const;

/* Le proche simulé. C'est, champ pour champ, ce que `ContexteMessage` attend :
 * un profil n'est pas une fiche allégée, c'est exactement la matière qu'un
 * gabarit reçoit. Une forme plus pauvre ferait essayer autre chose que ce que
 * la production exécute, et l'atelier prétendrait montrer ce qui tournera. */
export const profilContenuSchema = z.object({
  langue: z.enum(["fr", "en"]),
  orientation: z.enum(ORIENTATIONS),
  nomDUsage: z.string().trim().min(1).max(80),
  registre: z.enum(PERSON_REGISTERS),
  /* DEUX champs pour le lien, et ils ne font pas double emploi.
   *
   * `lien` est la classification que porte une fiche réelle : c'est elle qui
   * dit si la couverture des profils comprend bien une relation familiale ET
   * une professionnelle (brief de design §6). `relation` est ce que le modèle
   * lit, en clair — « ma marraine » vaut mieux que « famille étendue », et
   * c'est ce que le gabarit demande. Ne garder que la première appauvrirait
   * l'invite ; ne garder que la seconde rendrait la couverture indécidable
   * sans lire du texte libre. */
  lien: z.enum(PERSON_RELATIONS).nullable(),
  relation: z.string().trim().max(60).nullable(),
  genreDuProche: z.enum(GENRES_SIMULES),
  genreDeLAuteur: z.enum(GENRES_SIMULES),
  occasionSensible: z.boolean(),
  notes: z.array(z.object({
    categorie: z.string().trim().max(40).nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    contenu: z.string().trim().min(1).max(1000),
  }).strict()).max(60),
  aEviter: z.array(z.string().trim().min(1).max(200)).max(20),
  texteLibre: z.string().trim().max(280).nullable(),
  age: z.number().int().min(0).max(130).nullable(),
}).strict();

export type ProfilContenu = z.infer<typeof profilContenuSchema>;

export const profilStudioSchema = z.object({
  id: z.string().uuid(),
  libelle: z.string(),
  sensible: z.boolean(),
  contenu: profilContenuSchema,
  creeLe: z.string(),
}).strict();

/* Ce que la couverture EXIGE, et que l'écran doit pouvoir annoncer d'un mot :
 * « sept profils · aucun cas sensible » vaut mieux que sept lignes à lire
 * (brief de design §6). Le calcul est au serveur parce que la règle est au
 * dictionnaire, pas dans le dessin — deux implémentations de la même liste
 * finiraient par ne plus dire la même chose. */
export const AXES_COUVERTURE = [
  "fiche_riche", "fiche_pauvre", "nom_court", "nom_long",
  "langue_fr", "langue_en", "relation_familiale", "relation_professionnelle",
  "cas_sensible",
] as const;
export type AxeCouverture = (typeof AXES_COUVERTURE)[number];

export const profilsStudioSchema = z.object({
  items: z.array(profilStudioSchema),
  /** Les axes qu'aucun profil ne couvre. Vide veut dire « rien ne manque ». */
  manquant: z.array(z.enum(AXES_COUVERTURE)),
}).strict();

export const creationProfilSchema = z.object({
  libelle: z.string().trim().min(1).max(80),
  sensible: z.boolean(),
  contenu: profilContenuSchema,
}).strict();

/* La modification remplace le contenu ENTIER plutôt que de le rapiécer champ
   par champ. Un profil est une éprouvette : la mise à jour partielle d'un
   tableau de notes n'a pas de sens évident — « en ajoute-t-elle une ou
   remplace-t-elle toutes ? » — et chaque lecteur en déciderait autrement. */
export const modificationProfilSchema = z.object({
  libelle: z.string().trim().min(1).max(80).optional(),
  sensible: z.boolean().optional(),
  contenu: profilContenuSchema.optional(),
}).strict().refine(
  (v) => v.libelle !== undefined || v.sensible !== undefined || v.contenu !== undefined,
  { message: "au moins un champ doit être fourni" },
);

// ── Les essais ──────────────────────────────────────────────────────────────

/* Les mêmes états que `ai_usage_status`, `refused` compris.
 *
 * Un refus du modèle N'EST PAS une panne, et l'atelier doit les distinguer : le
 * brief de design §12 en fait trois gestes différents — réessayer, reprendre
 * la consigne, recharger le compte du fournisseur. Un seul « échec » les
 * confondrait, et on réessaierait trente fois une demande que le modèle
 * refusera toujours. */
export const ETATS_ESSAI = ["success", "error", "timeout", "refused"] as const;
export type EtatEssai = (typeof ETATS_ESSAI)[number];

/* Ce qu'on a PENSÉ du résultat, et non ce que l'appel a rendu : `etat` dit déjà
 * si le modèle a répondu.
 *
 * Nul tant qu'on n'a pas tranché — un essai qu'on n'a pas jugé n'est pas un
 * essai jugé mauvais, et l'écran des essais doit pouvoir les distinguer.
 *
 * « Publié » n'en fait pas partie : ce n'est pas l'essai qu'on publie, c'est sa
 * configuration. L'écran le déduit de l'état de celle-ci, et un troisième
 * membre ici mentirait sur ce qui se range où. */
export const VERDICTS_ESSAI = ["kept", "discarded"] as const;
export type VerdictEssai = (typeof VERDICTS_ESSAI)[number];

/* Le sort se pose SANS MOTIF, comme la prévisualisation : un essai ne change
   rien pour personne, et une séance de réglage en compte trente — la phrase
   serait vide dès la troisième. */
export const verdictEssaiSchema = z.object({
  verdict: z.enum(VERDICTS_ESSAI),
}).strict();

export const essaiStudioSchema = z.object({
  id: z.string().uuid(),
  configId: z.string().uuid(),
  profilId: z.string().uuid().nullable(),
  etat: z.enum(ETATS_ESSAI),
  /** Le modèle DEMANDÉ, qui est aussi le seul appelé : l'essai ne replie pas. */
  modele: z.object({ fournisseur: z.string(), cle: z.string() }).strict(),
  /** Le message produit. Nul quand l'essai n'a rien rendu. */
  sortie: z.unknown().nullable(),
  /** Nul quand le modèle n'est pas tarifé — « on ne sait pas », jamais « gratuit ». */
  cout: z.number().nullable(),
  /** Le code de l'échec, nommé. Nul en cas de succès. */
  erreur: z.string().nullable(),
  parQui: z.string().nullable(),
  quand: z.string(),
  /** Nul tant que personne n'a tranché. Voir `VERDICTS_ESSAI`. */
  verdict: z.enum(VERDICTS_ESSAI).nullable(),
  /* L'ambiance éprouvée. C'est elle qui décide du modèle appelé, et sans elle
     la galerie ne peut pas dire ce qu'on regarde : deux portraits du même
     modèle, sous deux ambiances, s'y ressemblent.
     Nulle sur les essais antérieurs à la colonne — on ne la reconstitue pas. */
  ambianceId: z.string().max(60).nullable(),
}).strict();

export const essaisStudioSchema = z.object({
  items: z.array(essaiStudioSchema),
}).strict();

/* Lancer un essai, c'est-à-dire PRÉVISUALISER — le geste qui enregistre.
 *
 * Les réglages voyagent avec la demande, et le brouillon naît AVANT l'appel
 * (brief §11.2). L'ordre inverse ferait perdre dix minutes de composition à
 * chaque fournisseur en panne, et l'essai porte une référence vers la
 * configuration, qui doit donc exister quand il commence. */
/* L'essai du PORTRAIT appelle un modèle d'IMAGE, et c'est tout le sujet du
   découpage : avant lui, publier un changement de style de dessin se débloquait
   avec un essai qui avait produit un texte. */
export const lancementEssaiPortraitSchema = z.object({
  reglages: reglagesPortraitSchema,
  profileId: z.string().uuid(),
  /* L'AMBIANCE ÉPROUVÉE, et il en faut une.
   *
   * C'est elle qui décide du modèle appelé : une famille d'illustration et un
   * style de photo ne passent pas par le même. Sans elle, l'essai choisirait
   * pour nous — et prouverait une voie qu'on ne voulait pas éprouver.
   *
   * C'est aussi ce que dit l'établi du kit : on compose POUR une ambiance, et
   * la règle des deux rangs se compte par ambiance. */
  ambianceId: z.string().min(1).max(60),
}).strict();

// ── Les valeurs candidates ──────────────────────────────────────────────────

/* Ce dans quoi l'atelier choisit. Le prix est là comme FICHE TECHNIQUE du
 * modèle, à côté de son nom — jamais comme un décompte : le brief de design §8
 * retire tout compteur de dépense de l'écran.
 *
 * `tarifs` est nul tant que personne ne les a saisis en administration, et
 * c'est un état normal à dessiner. Zéro se prendrait pour un fait. */
export const modeleCandidatSchema = z.object({
  id: z.string().uuid(),
  cle: z.string(),
  fournisseur: z.string(),
  modele: z.string(),
  capacite: z.string(),
  actif: z.boolean(),
  /** Non nul quand le disjoncteur l'a écarté du routage automatique. L'atelier
   *  l'appelle quand même si on le lui demande : c'est là qu'on va voir. */
  enPanneJusqua: z.string().nullable(),
  tarifs: z.object({
    entree: z.number().nullable(),
    sortie: z.number().nullable(),
  }).strict(),
}).strict();

export const candidatsStudioSchema = z.object({
  modeles: z.array(modeleCandidatSchema),
  orientations: z.array(z.string()),
  groupesAmbiance: z.array(z.string()),
  motifs: z.array(z.string()),
  champsDuProche: z.array(z.string()),
  /** Les gabarits en service, par genre et par clé. Vide tant que le Studio
   *  n'a rien publié en base — voir la note de `gabarits.ts`. */
  gabarits: z.array(z.object({
    id: z.string(), genre: z.string(), cle: z.string(), version: z.number().int(),
  }).strict()),
}).strict();

export type EtatMessage = z.infer<typeof etatMessageSchema>;
export type EtatPortrait = z.infer<typeof etatPortraitSchema>;
export type ProfilStudio = z.infer<typeof profilStudioSchema>;
export type ProfilsStudio = z.infer<typeof profilsStudioSchema>;
export type EssaiStudio = z.infer<typeof essaiStudioSchema>;
export type CandidatsStudio = z.infer<typeof candidatsStudioSchema>;
