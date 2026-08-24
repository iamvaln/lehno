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
  volumetrie: z.object({
    proches: z.number().int().nonnegative(),
    occasions: z.number().int().nonnegative(),
    notes: z.number().int().nonnegative(),
    murs: z.number().int().nonnegative(),
  }).strict(),
  credits: z.object({
    solde: z.number().int(),
    achetes: z.number().int().nonnegative(),
    offerts: z.number().int().nonnegative(),
  }).strict(),
}).strict();

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

// ——— Configurations ———————————————————————————————————————————

// Un rang de formulaire rappelle la valeur précédente : c'est ce qui permet de
// voir ce qu'on change avant d'enregistrer.
export const parametreSchema = z.object({
  cle: z.string(),
  libelle: z.string(),
  aide: z.string().nullable(),
  valeur: z.union([z.string(), z.number()]),
  valeurPrecedente: z.union([z.string(), z.number()]).nullable(),
  unite: z.string().nullable(),
}).strict();

export const parametresSchema = z.object({
  economie: z.array(parametreSchema),
  typesEvenement: z.array(z.object({
    id: z.string(),
    libelle: z.string(),
    actif: z.boolean(),
    sensible: z.boolean(),
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
