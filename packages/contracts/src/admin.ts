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


// ——— Modèles d'IA —————————————————————————————————————————————

/**
 * Un modèle du catalogue, et son rang dans l'ordre de repli.
 *
 * Les coûts sont ceux du fournisseur, par million de jetons, tels qu'on les a
 * relevés — ils peuvent manquer pour un modèle qu'on n'a pas encore tarifé.
 *
 * Ce que ce contrat **ne porte pas** : la dépense réelle et ce qu'elle a
 * rapporté. Le §5.8 les demande face à face, mais `AIUsage` et `ActionRun`
 * n'existent pas encore. Les inventer ici donnerait un écran qui affiche des
 * zéros là où il devrait afficher une marge.
 */
export const modeleIaSchema = z.object({
  id: z.string(),
  fournisseur: z.string(),
  modele: z.string(),
  /** Le plus petit d'abord : c'est l'ordre dans lequel on essaie. */
  rang: z.number().int(),
  actif: z.boolean(),
  coutEntree: z.number().nullable(),
  coutSortie: z.number().nullable(),
  misAJourLe: z.string(),
}).strict();

export const catalogueIaSchema = z.object({
  items: z.array(modeleIaSchema),
}).strict();

export type ModeleIa = z.infer<typeof modeleIaSchema>;
export type CatalogueIa = z.infer<typeof catalogueIaSchema>;

// ——— Drapeaux de fonctionnalité ————————————————————————————————

/**
 * Un drapeau, avec ce qu'il gouverne et ce qu'il emporte.
 *
 * Deux états, et la distinction n'est pas un détail. `actif` est ce que
 * l'interrupteur dit ; `effectif` est ce qui se produit vraiment, dépendances
 * résolues. Un drapeau allumé dont un prérequis est éteint reste inerte : ne
 * montrer que le premier laisserait croire qu'une fonctionnalité tourne alors
 * que personne ne la voit.
 *
 * `emporte` est l'inverse de `requiert`, calculé de proche en proche : ce que
 * l'extinction de ce drapeau éteindra en cascade. C'est ce que le §5.7 demande
 * d'annoncer **avant** la bascule, plutôt que de le laisser découvrir.
 *
 * Couverture, dépendances et portée viennent du registre — il est en code, et
 * c'est le serveur qui le lit. Le back-office ne duplique rien.
 */
export const drapeauAdminSchema = z.object({
  cle: z.string(),
  gouverne: z.string(),
  portee: z.array(z.enum(["app", "public"])),
  requiert: z.array(z.string()),
  /** Ce que l'éteindre éteindra aussi, transitivement. */
  emporte: z.array(z.string()),
  ecrans: z.array(z.string()),
  chemins: z.array(z.string()),
  actif: z.boolean(),
  effectif: z.boolean(),
  misAJourLe: z.string(),
  /** Qui a basculé en dernier. Nul tant que personne n'y a touché. */
  parQui: z.string().nullable(),
}).strict();

export const drapeauxAdminSchema = z.object({
  items: z.array(drapeauAdminSchema),
}).strict();

/** La bascule. Le motif est obligatoire : chaque changement est journalisé. */
export const basculeDrapeauSchema = z.object({
  cle: z.string().min(1).max(64),
  actif: z.boolean(),
  reason: motifSchema,
}).strict();

export type DrapeauAdmin = z.infer<typeof drapeauAdminSchema>;
export type DrapeauxAdmin = z.infer<typeof drapeauxAdminSchema>;

// ——— Les réglages du paiement ————————————————————————————————

/**
 * Un palier d'achat. Aucune saisie libre d'un montant : on achète un palier,
 * et le plus petit fixe le minimum. La remise s'affiche — c'est un argument de
 * vente, pas un calcul caché.
 */
export const palierSchema = z.object({
  id: z.string(),
  montant: z.number(),
  devise: z.string(),
  credits: z.number().int().positive(),
  remisePourcent: z.number().int().nullable(),
  position: z.number().int(),
  actif: z.boolean(),
}).strict();

/**
 * Ce que le **service** propose : un opérateur, un pays, un barème.
 *
 * À ne pas confondre avec la méthode qu'un **client** a enregistrée. Les fondre
 * reviendrait à porter un taux de frais sur le numéro de téléphone de chaque
 * client, et à devoir tous les corriger le jour où un opérateur change son
 * barème.
 */
export const canalSchema = z.object({
  id: z.string(),
  nature: z.enum(["mobile_money", "card"]),
  operateur: z.string(),
  /** Les frais diffèrent d'un pays à l'autre, même chez le même opérateur. */
  pays: z.string(),
  libelle: z.string(),
  fraisPourcent: z.number(),
  fraisFixe: z.number(),
  fraisMin: z.number().nullable(),
  fraisMax: z.number().nullable(),
  /** `payer` : le client verse en plus. `payee` : c'est prélevé sur le versement. */
  fraisPortesPar: z.enum(["payer", "payee"]),
  devise: z.string(),
  actif: z.boolean(),
  position: z.number().int().nullable(),
}).strict();

/**
 * Un compte d'opérateur sur lequel les clients versent.
 *
 * Le numéro est rendu **en entier** à l'administration : c'est celui qu'on
 * dicte à un client au téléphone, et qu'on va lire sur l'application de
 * l'opérateur pour vérifier une réception. Ce n'est pas une donnée de client,
 * c'est un compte du service.
 */
export const compteCollecteSchema = z.object({
  id: z.string(),
  libelle: z.string(),
  operateur: z.string(),
  numero: z.string(),
  /** Ce que le client voit. Distinct de `actif`, qui dit ce qui reste employable. */
  visibleDansApp: z.boolean(),
  actif: z.boolean(),
  position: z.number().int().nullable(),
}).strict();

export const paliersSchema = z.object({ items: z.array(palierSchema) }).strict();
export const canauxSchema = z.object({ items: z.array(canalSchema) }).strict();
export const comptesCollecteSchema = z.object({ items: z.array(compteCollecteSchema) }).strict();

export type Palier = z.infer<typeof palierSchema>;
export type Canal = z.infer<typeof canalSchema>;
export type CompteCollecte = z.infer<typeof compteCollecteSchema>;

// ——— La saisie manuelle d'un paiement —————————————————————————

/**
 * Ce qu'un administrateur saisit pour enregistrer un versement reçu.
 *
 * Le paiement naît `pending`. La spécification dit qu'il « se confirme du même
 * geste » : c'est l'écran qui enchaîne les deux appels, pas le serveur qui les
 * fond. Séparer garde une seule porte de décision — celle qui exige le montant
 * réellement constaté et journalise son motif.
 */
export const saisiePaiementSchema = z.object({
  utilisateurId: z.string().uuid(),
  palierId: z.string().uuid(),
  compteCollecteId: z.string().uuid(),
  canalId: z.string().uuid(),
  /** Le numéro depuis lequel le client déclare avoir versé. */
  numeroPayeur: z.string().max(32).optional(),
  /** La référence de la transaction chez l'opérateur, si elle est déjà connue. */
  reference: z.string().max(200).optional(),
  /** Le reçu déposé. Il ne prouve rien — la réception sur le compte fait foi. */
  recu: z.string().max(500).optional(),
  reason: motifSchema,
}).strict();

export const paiementCreeSchema = z.object({
  id: z.string(),
  etat: z.enum(["pending", "succeeded", "failed", "expired", "refunded"]),
  montant: z.number(),
  frais: z.number(),
  /** Ce qu'on doit voir arriver sur le compte, frais appliqués. */
  attenduSurLeCompte: z.number(),
  credits: z.number().int(),
  devise: z.string(),
}).strict();

export type SaisiePaiement = z.infer<typeof saisiePaiementSchema>;
export type PaiementCree = z.infer<typeof paiementCreeSchema>;

// ——— La décision sur un paiement —————————————————————————————

/**
 * Confirmer ou rejeter un paiement en attente.
 *
 * **Le montant reçu se renseigne toujours**, même sans écart : c'est lui qui
 * permet de constater qu'il n'y en a pas. Sans ce champ, on ne saurait jamais
 * si le silence vaut « rien à signaler » ou « personne n'a regardé ».
 *
 * Le reçu ne prouve rien — un montage est facile. C'est la réception **sur le
 * compte de l'opérateur** qui fait foi, et c'est ce que l'administrateur
 * consigne ici.
 */
export const decisionPaiementSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("confirmer"),
    montantRecu: z.number().nonnegative(),
    /** La référence chez l'opérateur, consignée au moment de confirmer. */
    reference: z.string().min(1).max(200),
    reason: motifSchema,
  }).strict(),
  z.object({
    decision: z.literal("rejeter"),
    /** Renseigné quand on a regardé et constaté un manque ; nul sinon. */
    montantRecu: z.number().nonnegative().nullable().optional(),
    reason: motifSchema,
  }).strict(),
]);

export const paiementDecideSchema = z.object({
  id: z.string(),
  etat: z.enum(["pending", "succeeded", "failed", "expired", "refunded"]),
  creditsOctroyes: z.number().int(),
  /** L'écart constaté : reçu moins attendu. Négatif quand il manque. */
  ecart: z.number().nullable(),
}).strict();

export type DecisionPaiement = z.infer<typeof decisionPaiementSchema>;

// ——— Les deux listes du §5.4 ——————————————————————————————————

/**
 * Une ligne de la liste des paiements.
 *
 * La méthode n'y paraît que par ses éléments d'identification — opérateur et
 * derniers chiffres. Le numéro complet d'un compte mobile money demeure masqué,
 * **y compris pour l'administrateur** : il est chiffré au repos, déchiffré pour
 * la seule communication avec le prestataire, et n'entre dans aucun journal.
 *
 * À ne pas confondre avec le numéro d'un compte de **collecte**, qui est rendu
 * en entier : celui-là est un compte du service, pas d'un client.
 */
export const paiementLigneSchema = z.object({
  id: z.string(),
  utilisateur: z.string(),
  mode: z.enum(["provider", "semi_manual", "manual"]),
  etat: z.enum(["pending", "succeeded", "failed", "expired", "refunded"]),
  montant: z.number(),
  devise: z.string(),
  credits: z.number().int(),
  /** « MTN MoMo •••4321 », ou nul quand aucune méthode n'est rattachée. */
  methode: z.string().nullable(),
  attenduSurLeCompte: z.number().nullable(),
  recuSurLeCompte: z.number().nullable(),
  /** Reçu moins attendu. Nul tant que personne n'a constaté. */
  ecart: z.number().nullable(),
  creeLe: z.string(),
}).strict();

/** Un état traversé, et **combien de temps** il a duré. */
export const etatTraverseSchema = z.object({
  etat: z.enum(["pending", "succeeded", "failed", "expired", "refunded"]),
  debut: z.string(),
  fin: z.string().nullable(),
  /** En secondes. Nul pour l'état courant, qui dure encore. */
  dureeSecondes: z.number().int().nullable(),
  origine: z.enum(["user", "webhook", "polling", "admin", "system"]),
  parQui: z.string().nullable(),
  motif: z.string().nullable(),
}).strict();

export const paiementDetailSchema = paiementLigneSchema.extend({
  reference: z.string().nullable(),
  motifEchec: z.string().nullable(),
  frais: z.number().nullable(),
  compteCollecte: z.string().nullable(),
  histoire: z.array(etatTraverseSchema),
}).strict();

export const pagePaiementsSchema = z.object({
  items: z.array(paiementLigneSchema),
  nextCursor: z.string().nullable(),
}).strict();

/** Un mouvement de crédits, tel que l'administration le lit. */
export const mouvementCreditSchema = z.object({
  id: z.string(),
  utilisateur: z.string(),
  type: z.enum(["grant", "purchase", "consumption", "adjustment"]),
  /** D'où il vient. Le type dit ce qu'il est, la source ce qui l'a produit. */
  source: z.string(),
  montant: z.number().int(),
  paiementId: z.string().nullable(),
  note: z.string().nullable(),
  creeLe: z.string(),
}).strict();

export const pageMouvementsSchema = z.object({
  items: z.array(mouvementCreditSchema),
  nextCursor: z.string().nullable(),
}).strict();

export type PaiementLigne = z.infer<typeof paiementLigneSchema>;
export type PaiementDetail = z.infer<typeof paiementDetailSchema>;
export type MouvementCredit = z.infer<typeof mouvementCreditSchema>;

// ——— L'ajustement manuel d'un solde ——————————————————————————

/**
 * « Ajuster manuellement le solde d'un utilisateur, avec motif obligatoire »
 * (ux-admin §5.4).
 *
 * Le montant est **signé** : positif pour créditer, négatif pour reprendre. Un
 * champ « sens » séparé se désynchroniserait du signe au premier oubli, et le
 * mouvement écrit ne dirait plus ce qu'on a voulu faire.
 */
export const ajustementCreditsSchema = z.object({
  montant: z.number().int().refine((n) => n !== 0, "un ajustement de zéro ne dit rien"),
  /**
   * Ce que le mouvement **est**, et que le client lira.
   *
   * Choisi, jamais deviné. « admin_adjustment » disait « on a corrigé une
   * erreur » pour annoncer « on vous offre quelque chose » : deux nouvelles
   * opposées sous un même nom. Quelqu'un dont on reprend cinq crédits par
   * erreur ne doit pas lire « Cadeau », et l'inverse non plus.
   */
  nature: z.enum(["gift", "reward", "correction"]),
  reason: motifSchema,
}).strict();

export const soldeApresAjustementSchema = z.object({
  utilisateurId: z.string(),
  montant: z.number().int(),
  solde: z.number().int().nonnegative(),
}).strict();

export type AjustementCredits = z.infer<typeof ajustementCreditsSchema>;

// ——— Les comptes d'exploitation ———————————————————————————————

/**
 * Un compte d'administration, tel que la liste le montre.
 *
 * Ni condensé de code, ni jeton : cette liste dit **qui a accès**, pas comment
 * entrer. C'est aussi pourquoi le serveur y fait une sélection explicite plutôt
 * que de rendre la ligne entière — un champ ajouté demain à la table ne doit
 * pas sortir sans qu'on l'ait voulu.
 */
export const compteAdminSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string().nullable(),
  role: adminRoleSchema,
  /** Un compte révoqué est désactivé, jamais effacé : le journal doit encore
   *  pouvoir nommer qui a fait quoi. */
  isActive: z.boolean(),
  createdAt: z.string(),
}).strict();

export const comptesAdminSchema = z.object({ items: z.array(compteAdminSchema) }).strict();

export type CompteAdmin = z.infer<typeof compteAdminSchema>;
