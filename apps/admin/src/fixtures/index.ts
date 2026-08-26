import type {
  Dashboard, CompteDetail, CompteLigne, DemandeSuppression,
  Intervention, Parametres, ProfilAdmin,
} from "@lehno/contracts";

// Des données de démonstration, pas des données inventées au hasard : elles
// reprennent celles du prototype de passation, pour que la comparaison écran à
// écran reste possible. Les chiffres sont illustratifs et le disent.
//
// Le ton suit specs/ton-et-ecriture-lehno.md §2.5 : on s'adresse à quelqu'un qui
// travaille. Des faits, pas de l'urgence — « bloqué depuis 26 h », jamais
// « Attention ». Un compte suspendu est suspendu.

type Page<T> = { items: T[]; nextCursor: string | null };

export const dashboard: Dashboard = {
  alertes: [
    {
      id: "al-1", cause: "echec_modele", ton: "danger", section: "parametres",
      libelle: "22 % d'échecs — Rédaction longue", notifieA: "14 h",
    },
    {
      id: "al-2", cause: "paiement_bloque", ton: "danger", section: "credits",
      libelle: "3 paiements bloqués depuis plus de 24 h", notifieA: "9 h",
    },
    {
      id: "al-3", cause: "suppression_echeance", ton: "attention", section: "suppressions",
      libelle: "2 suppressions arrivent à échéance ce soir", notifieA: null,
    },
  ],
  indicateurs: [
    { id: "actifs", libelle: "Comptes actifs", valeur: "1 284", variation: { texte: "+38 ce mois", sens: "hausse" }, section: "comptes" },
    { id: "credits", libelle: "Crédits vendus", valeur: "9 420", variation: { texte: "+612 ce mois", sens: "hausse" }, section: "credits" },
    { id: "cout", libelle: "Coût des modèles", valeur: "72 %", variation: { texte: "du revenu des crédits", sens: "neutre" }, section: "metriques" },
    { id: "generations", libelle: "Générations par jour", valeur: "341", variation: { texte: "−4 % sur 7 jours", sens: "baisse" }, section: "metriques" },
    { id: "suppressions", libelle: "Suppressions en cours", valeur: "6", variation: { texte: "dont 2 à effacer aujourd'hui", sens: "neutre" }, section: "suppressions" },
    { id: "moderation", libelle: "À modérer", valeur: "3", variation: { texte: "dont 1 depuis plus de 24 h", sens: "neutre" }, section: "moderation" },
  ],
  aTraiter: [
    { id: "t-1", element: "Contenu signalé sur un Mur", section: "Modération", etat: "À décider", depuis: "il y a 2 h" },
    { id: "t-2", element: "Paiement en attente chez l'opérateur", section: "Transactions", etat: "En attente", depuis: "il y a 5 h" },
    { id: "t-3", element: "Demande de restauration de compte", section: "Comptes", etat: "Délai de grâce", depuis: "hier" },
    { id: "t-4", element: "Délai de grâce échu — compte à effacer", section: "Demandes de suppression", etat: "À effacer", depuis: "aujourd'hui" },
  ],
};

export const comptes: Page<CompteLigne> = {
  items: [
    { id: "u-1", pseudo: "awa", email: "awa@example.cm", etat: "actif", credits: 12, inscritLe: "2026-03-04" },
    { id: "u-2", pseudo: "valery", email: "valery@example.cm", etat: "actif", credits: 0, inscritLe: "2026-04-18" },
    { id: "u-3", pseudo: "mathias", email: "mathias@example.cm", etat: "suspendu", credits: 5, inscritLe: "2026-01-27" },
    { id: "u-4", pseudo: "nour", email: "nour@example.cm", etat: "suppression_en_cours", credits: 3, inscritLe: "2025-11-09" },
    { id: "u-5", pseudo: "celarine", email: "celarine@example.cm", etat: "actif", credits: 41, inscritLe: "2026-06-02" },
  ],
  nextCursor: "u-5",
};

// Ni fiches, ni notes, ni souhaits : le cloisonnement tient en administration.
// Ce que l'équipe voit d'un compte, ce sont des volumétries et des mouvements.
export const compteDetail: CompteDetail = {
  id: "u-1",
  pseudo: "awa",
  email: "awa@example.cm",
  etat: "actif",
  suppressionDemandeeLe: null,
  langue: "fr",
  inscritLe: "2026-03-04",
  derniereConnexion: "2026-08-22",
  volumetrie: { proches: 14, occasions: 21, notes: 63, murs: 1 },
  credits: { solde: 12, achetes: 30, offerts: 5 },
};

export const suppressions: Page<DemandeSuppression> = {
  items: [
    { id: "s-1", compte: "nour", demandeeLe: "2026-07-25", echeance: "2026-08-24", joursRestants: 1, etat: "en_cours" },
    { id: "s-2", compte: "karim", demandeeLe: "2026-07-24", echeance: "2026-08-23", joursRestants: 0, etat: "echue" },
    { id: "s-3", compte: "fatou", demandeeLe: "2026-08-10", echeance: "2026-09-09", joursRestants: 17, etat: "en_cours" },
  ],
  nextCursor: null,
};

export const interventions: Page<Intervention> = {
  items: [
    { id: "i-1", date: "2026-08-22 14:02", auteur: "sam@lehno.app", action: "Compte suspendu", objet: "mathias", motif: "Contenu signalé à répétition sur son Mur" },
    { id: "i-2", date: "2026-08-20 09:41", auteur: "sam@lehno.app", action: "Solde ajusté (+5)", objet: "awa", motif: "Génération échouée de notre fait, crédit rendu" },
    { id: "i-3", date: "2026-08-18 17:13", auteur: "dora@lehno.app", action: "Remboursement déclenché", objet: "paiement 4f21", motif: "Demande du titulaire, opération jamais aboutie" },
  ],
  nextCursor: null,
};

// Les clés sont celles que la migration sème : une fixture qui inventerait des
// clés ne dirait rien du produit, et masquerait un libellé manquant.
export const parametres: Parametres = {
  economie: [
    { cle: "credit_unit_price", valeur: "100", type: "money", valeurPrecedente: "80", misAJourLe: "2026-08-20T09:00:00.000Z" },
    { cle: "signup_free_credits", valeur: "5", type: "number", valeurPrecedente: null, misAJourLe: "2026-08-20T09:00:00.000Z" },
    { cle: "account_grace_period_days", valeur: "30", type: "number", valeurPrecedente: null, misAJourLe: "2026-08-20T09:00:00.000Z" },
    { cle: "reminder_lead_days_default", valeur: "7", type: "number", valeurPrecedente: null, misAJourLe: "2026-08-20T09:00:00.000Z" },
  ],
  // Un enum du code : montré, pas réglable.
  typesEvenement: [
    { id: "birthday", actif: true, sensible: false, reglable: false },
    { id: "other", actif: true, sensible: false, reglable: false },
  ],
};

export const profil: ProfilAdmin = {
  email: "sam@lehno.app",
  role: "support",
  ajoutePar: "valentine@lehno.app",
  derniereConnexion: "2026-08-23 08:12",
  sessions: [
    { id: "se-1", appareil: "Chrome — macOS", ip: "102.244.18.7", depuis: "2026-08-23 08:12", courante: true },
    { id: "se-2", appareil: "Firefox — Windows", ip: "102.244.18.7", depuis: "2026-08-19 11:40", courante: false },
  ],
};
