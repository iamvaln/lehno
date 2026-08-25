import { z } from "zod";

// Les types de `/v1/admin` (spec technique §7). Le back-office n'a pas encore de
// serveur : ces formes servent d'abord à valider des fixtures. Le jour où l'API
// arrive, le câblage remplace une source, il ne réécrit pas les écrans.

export const adminRoleSchema = z.enum(["support", "admin"]);
export type AdminRole = z.infer<typeof adminRoleSchema>;

// « Les appels qui modifient l'état d'un compte, un solde ou un contenu exigent
// un motif. Sans lui, la requête échoue — c'est ce qui garantit que le journal
// d'audit dit quelque chose. » (§7) Un motif de deux caractères satisferait la
// lettre et viderait la règle : le plancher est celui d'une phrase utile.
export const motifSchema = z.string().trim().min(6).max(500);
export type Motif = z.infer<typeof motifSchema>;

// « Les listes se parcourent par curseur — plus sûr qu'un numéro de page quand
// les données bougent. » (§3) Le curseur suivant est nul quand on a tout lu.
// Aucun total : une API à curseur n'en connaît pas, et la pagination de
// l'interface s'en tient donc à « Précédent · Suivant ».
export function pageDeSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  }).strict();
}

export const requeteListeSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
  q: z.string().max(200).optional(),
}).strict();

// ——— Tableau de bord ———————————————————————————————————————————

// « Trois AlertPill au plus, sur une ligne, chacune menant à sa liste. » Le
// plafond vit dans le type : une quatrième alerte ne doit pas pouvoir arriver
// jusqu'à l'écran, où elle casserait la ligne.
export const alerteSchema = z.object({
  id: z.string(),
  cause: z.enum(["echec_modele", "paiement_bloque", "suppression_echeance", "moderation_ancienne"]),
  libelle: z.string(),
  ton: z.enum(["danger", "attention"]),
  section: z.string(),
  /** Horodatage du courriel déjà parti — le panel et le mail sont deux vues d'un même événement. */
  notifieA: z.string().nullable().optional(),
}).strict();

export const indicateurSchema = z.object({
  id: z.string(),
  libelle: z.string(),
  valeur: z.string(),
  /** Le sens de la variation, pas sa couleur : l'écran décide. */
  variation: z.object({ texte: z.string(), sens: z.enum(["hausse", "baisse", "neutre"]) }).nullable(),
  section: z.string().nullable(),
}).strict();

export const aTraiterSchema = z.object({
  id: z.string(),
  element: z.string(),
  section: z.string(),
  etat: z.string(),
  depuis: z.string(),
}).strict();

export const dashboardSchema = z.object({
  alertes: z.array(alerteSchema).max(3),
  indicateurs: z.array(indicateurSchema),
  aTraiter: z.array(aTraiterSchema),
}).strict();

export type Dashboard = z.infer<typeof dashboardSchema>;
export type Alerte = z.infer<typeof alerteSchema>;
export type Indicateur = z.infer<typeof indicateurSchema>;

// ——— Comptes ———————————————————————————————————————————————————

export const etatCompteSchema = z.enum(["actif", "suspendu", "suppression_en_cours", "efface"]);

export const compteLigneSchema = z.object({
  id: z.string(),
  pseudo: z.string(),
  email: z.string(),
  etat: etatCompteSchema,
  // Le solde est la somme signée des mouvements. Un compte sans mouvement a
  // bien zéro, ce qui n'est pas la même chose qu'une mesure absente : cette
  // colonne a été nullable le temps que credit_transaction existe, elle ne
  // l'est plus.
  credits: z.number().int(),
  inscritLe: z.string(),
}).strict();

// Le cloisonnement tient en administration : consulter un compte donne son état,
// ses volumétries et ses mouvements. **Le contenu de ses fiches et de ses notes
// demeure hors de portée** — aucun écran ne doit l'exposer, donc aucun type ne
// le porte. C'est la forme qui rend la faute impossible, pas la vigilance.
export const compteDetailSchema = z.object({
  id: z.string(),
  pseudo: z.string(),
  email: z.string(),
  etat: etatCompteSchema,
  langue: z.enum(["fr", "en"]),
  inscritLe: z.string(),
  derniereConnexion: z.string().nullable(),
  /** Renseigné pendant le délai de grâce, nul sinon. */
  suppressionDemandeeLe: z.string().nullable(),
  volumetrie: z.object({
    proches: z.number().int().nonnegative(),
    occasions: z.number().int().nonnegative(),
    notes: z.number().int().nonnegative(),
    // Nul tant que la table des Murs n'existe pas — voir compteLigneSchema.
    murs: z.number().int().nonnegative().nullable(),
  }).strict(),
  /** Acheté et offert se distinguent : payer n'est pas être entretenu. */
  credits: z.object({
    solde: z.number().int(),
    achetes: z.number().int().nonnegative(),
    offerts: z.number().int().nonnegative(),
  }).strict(),
}).strict();

/** La page d'une liste : pas de total, un curseur (spec technique §3). */
export const pageComptesSchema = z.object({
  items: z.array(compteLigneSchema),
  nextCursor: z.string().nullable(),
}).strict();
export type PageComptes = z.infer<typeof pageComptesSchema>;

export type CompteLigne = z.infer<typeof compteLigneSchema>;
export type CompteDetail = z.infer<typeof compteDetailSchema>;

// ——— Traçabilité ———————————————————————————————————————————————

// « La traçabilité se lit depuis l'objet » : le même type sert au pied d'un
// détail et à la section Journal d'audit.
export const interventionSchema = z.object({
  id: z.string(),
  date: z.string(),
  auteur: z.string(),
  action: z.string(),
  objet: z.string(),
  motif: motifSchema,
}).strict();

export type Intervention = z.infer<typeof interventionSchema>;

// ——— Demandes de suppression ———————————————————————————————————

export const demandeSuppressionSchema = z.object({
  id: z.string(),
  compte: z.string(),
  demandeeLe: z.string(),
  echeance: z.string(),
  /** Le délai de grâce est de trente jours (dictionnaire de données, User). */
  joursRestants: z.number().int(),
  etat: z.enum(["en_cours", "echue"]),
}).strict();

export type DemandeSuppression = z.infer<typeof demandeSuppressionSchema>;

/** La file des demandes : une page à curseur, la plus urgente d'abord. */
export const pageSuppressionsSchema = z.object({
  items: z.array(demandeSuppressionSchema),
  nextCursor: z.string().nullable(),
}).strict();
export type PageSuppressions = z.infer<typeof pageSuppressionsSchema>;

// ——— Configurations ———————————————————————————————————————————

// Un rang de formulaire rappelle la valeur précédente : c'est ce qui permet de
// voir ce qu'on change avant d'enregistrer.
// Le serveur transporte des clés, jamais des phrases composées (contrat commun
// §2) : c'est ce qui rend l'outil bilingue sans que le serveur ait à connaître
// la langue de qui l'appelle. Libellé, aide et unité vivent donc dans le
// dictionnaire de l'outil, indexés par cette clé — et une clé qu'il ne connaît
// pas s'affiche telle quelle, ce qui se voit, plutôt que vide.
export const parametreSchema = z.object({
  cle: z.string(),
  valeur: z.union([z.string(), z.number()]),
  /** Le type dit comment saisir : un prix n'est pas un délai. */
  type: z.enum(["number", "money", "duration", "boolean", "string"]),
  /** « Modifier une valeur, avec rappel de la précédente » (ux-admin §5.6). */
  valeurPrecedente: z.union([z.string(), z.number()]).nullable(),
  misAJourLe: z.string(),
}).strict();

export const parametresSchema = z.object({
  economie: z.array(parametreSchema),
  // Les types d'occasion sont un enum du code, pas une table : leur activation
  // n'est stockée nulle part et ne peut donc pas se régler ici. Le serveur les
  // rend pour qu'on voie lesquels existent ; l'écran les montre en lecture.
  typesEvenement: z.array(z.object({
    id: z.string(),
    actif: z.boolean(),
    sensible: z.boolean(),
    /** Faux tant qu'aucune table ne porte l'activation. */
    reglable: z.boolean(),
  }).strict()),
}).strict();

export type Parametres = z.infer<typeof parametresSchema>;
export type Parametre = z.infer<typeof parametreSchema>;

// ——— Le compte connecté ————————————————————————————————————————

export const profilAdminSchema = z.object({
  email: z.string(),
  role: adminRoleSchema,
  ajoutePar: z.string().nullable(),
  derniereConnexion: z.string().nullable(),
  sessions: z.array(z.object({
    id: z.string(),
    appareil: z.string(),
    ip: z.string(),
    depuis: z.string(),
    courante: z.boolean(),
  }).strict()),
}).strict();

export type ProfilAdmin = z.infer<typeof profilAdminSchema>;

// ——— Connexion ————————————————————————————————————————————————

// « L'écran répond la même chose à une adresse connue et à une adresse
// inconnue — il ne dit jamais si un compte existe. » La réponse ne porte donc
// aucun indice, pas même un booléen.
export const demandeCodeSchema = z.object({ email: z.string().email().max(254) }).strict();
export const demandeCodeReponseSchema = z.object({ envoye: z.literal(true) }).strict();

export const verificationCodeSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
}).strict();

// La paire rendue par une entrée réussie comme par un échange. Le rôle repart
// à chaque tour : il peut avoir changé depuis l'ouverture de la session, et
// l'outil doit suivre sans attendre une reconnexion.
export const sessionAdminSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  role: adminRoleSchema,
}).strict();
export type SessionAdmin = z.infer<typeof sessionAdminSchema>;

// L'échange du jeton long. Il ne porte pas de jeton d'accès : c'est justement
// parce que celui-ci a expiré qu'on passe ici.
export const rafraichissementSchema = z.object({ refreshToken: z.string().min(1) }).strict();


// ——— Journal d'audit ——————————————————————————————————————————

/**
 * Une trace, telle qu'elle fait foi. Rien ici ne se modifie ni ne s'efface :
 * il n'existe aucun chemin d'écriture vers le journal depuis l'extérieur.
 *
 * `acteurId` n'est pas une clé étrangère en base — une trace qui doit faire foi
 * ne disparaît pas avec le compte qu'elle décrit. L'écran affiche donc un
 * identifiant, pas toujours un nom.
 */
export const traceAuditSchema = z.object({
  id: z.string(),
  date: z.string(),
  acteurType: z.enum(["admin", "user"]),
  acteurId: z.string(),
  action: z.string(),
  /** Obligatoire pour un administrateur, absent pour un utilisateur chez lui. */
  motif: z.string().nullable(),
  cibleType: z.string().nullable(),
  cibleId: z.string().nullable(),
  details: z.unknown().nullable(),
}).strict();

export const pageAuditSchema = z.object({
  items: z.array(traceAuditSchema),
  nextCursor: z.string().nullable(),
}).strict();

export type TraceAudit = z.infer<typeof traceAuditSchema>;
export type PageAudit = z.infer<typeof pageAuditSchema>;

// ——— Connexions ———————————————————————————————————————————————

/**
 * Une tentative d'entrée, réussie ou non.
 *
 * Pas d'adresse IP : la spécification technique §9 dit qu'elle ne descend pas
 * en base. Ce qu'on garde est un lieu approximatif — assez pour voir qu'une
 * série d'essais vient d'ailleurs, pas assez pour suivre quelqu'un.
 *
 * L'adresse tentée reste visible même quand aucun compte n'y correspond : c'est
 * elle qui montre qu'on essaie mille adresses à la suite.
 */
export const connexionSchema = z.object({
  id: z.string(),
  date: z.string(),
  compte: z.string().nullable(),
  adresseTentee: z.string().nullable(),
  resultat: z.enum(["success", "failure"]),
  appareil: z.string().nullable(),
  lieu: z.string().nullable(),
}).strict();

export const pageConnexionsSchema = z.object({
  items: z.array(connexionSchema),
  nextCursor: z.string().nullable(),
}).strict();

export type Connexion = z.infer<typeof connexionSchema>;
export type PageConnexions = z.infer<typeof pageConnexionsSchema>;
