import { z } from "zod";

// Le registre des drapeaux de fonctionnalité — spécification technique §6.
//
// Le registre vit dans le CODE, l'état vit en base. Ici : quelles clés
// existent, ce que chacune gouverne, sa portée, ses dépendances et ce qu'elle
// couvre. En base : un booléen, et rien d'autre.
//
// Pourquoi en code : la clé de @Feature en dérive par le type. Une faute de
// frappe devient une erreur de compilation, pas une fonctionnalité éteinte en
// silence dont personne ne s'aperçoit. Le défaut classique de ces systèmes est
// le drapeau dont la clé ne correspond à rien — il ne protège plus, et rien ne
// rougit. Ici cette erreur ne peut pas s'écrire.
//
// La COUVERTURE est la référence commune entre les équipes : ce que le mobile
// masque et ce que le serveur ferme doivent désigner la même chose, et le
// back-office l'affiche pour qu'un administrateur voie ce qu'il éteint avant
// de basculer.

// Où une fonctionnalité se manifeste. Un même drapeau peut porter les deux :
// le Mur a un écran dans l'application ET une page publique.
export type PorteeDrapeau = "app" | "public";

export type EntreeDrapeau = {
  readonly gouverne: string;
  readonly portee: readonly PorteeDrapeau[];
  // Les drapeaux dont celui-ci dépend. Éteindre un prérequis éteint celui-ci,
  // et la résolution se fait côté serveur avant d'envoyer la liste — le client
  // n'a aucune règle à connaître (§6.4).
  readonly requiert: readonly string[];
  readonly ecrans: readonly string[];
  readonly chemins: readonly string[];
};

// LE SOCLE N'A PAS DE DRAPEAU : proches, notes, dates, occasions, rappels et
// notifications, compte. S'il s'éteint, il n'y a plus d'application — un
// interrupteur dessus ne servirait qu'à casser le produit.
export const DRAPEAUX = {
  wishlist: {
    gouverne: "Les souhaits notés sur la fiche d'un proche",
    portee: ["app"],
    requiert: [],
    ecrans: ["3.19"],
    chemins: ["/me/occurrences/{id}/wishes", "/me/wishes/{id}"],
  },
  "wishlist.own": {
    gouverne: "Mes propres listes, leur partage et leur réservation",
    portee: ["app", "public"],
    requiert: [],
    ecrans: ["3.29", "public 3.6"],
    chemins: ["/me/wishlists*", "/me/owner-wishes/{id}", "/public/wishlists/{token}"],
  },
  wall: {
    gouverne: "Le Mur, sa gestion et sa page publique",
    portee: ["app", "public"],
    requiert: [],
    ecrans: ["3.10", "public 3.4"],
    chemins: ["/me/wall*", "/public/walls/{username}"],
  },
  collect: {
    gouverne: "Les liens de collecte et la validation des contributions",
    portee: ["app", "public"],
    requiert: [],
    ecrans: ["3.8", "3.20", "public 3.2", "public 3.3"],
    chemins: ["/me/collection-links*", "/me/submissions*", "/public/collect/{token}"],
  },
  wishes: {
    gouverne: "Le dépôt de vœux et les vœux reçus",
    portee: ["app", "public"],
    // Le dépôt de vœux passe par le Mur : sans Mur, pas de porte d'entrée.
    requiert: ["wall"],
    ecrans: ["public 3.5"],
    chemins: ["/me/wall/wish-link", "/me/received-wishes*", "/public/wishes/{token}"],
  },
  reservation: {
    gouverne: "La réservation d'un souhait par un visiteur",
    portee: ["app", "public"],
    // Les DEUX, et c'est voulu (§6.4) : la réservation passe par le Mur, et
    // sans liste partagée il n'y a plus rien à réserver.
    requiert: ["wall", "wishlist.own"],
    ecrans: ["3.27"],
    chemins: ["/me/reservations", "/public/owner-wishes/{id}/reserve*"],
  },
  "generation.message": {
    gouverne: "Le message généré",
    portee: ["app"],
    // Pas de dépendance à `credits`, et c'est le piège que §6.4 signale :
    // éteindre l'achat ne doit pas éteindre le produit. Sans crédits, les
    // générations restent disponibles et GRATUITES si leur drapeau est allumé.
    requiert: [],
    ecrans: ["3.7 (message)"],
    chemins: ["/me/generations", "/me/messages/{id}"],
  },
  "generation.ideas": {
    gouverne: "Les idées de cadeaux",
    portee: ["app"],
    requiert: [],
    ecrans: ["3.7 (idées)"],
    chemins: ["/me/generations"],
  },
  "generation.portrait": {
    gouverne: "Le studio et le portrait",
    portee: ["app"],
    requiert: [],
    ecrans: ["3.22", "le studio"],
    chemins: ["/me/studio/options", "/me/generations", "/me/portraits/*"],
  },
  credits: {
    gouverne: "L'achat de crédits dans l'application",
    portee: ["app"],
    requiert: [],
    ecrans: ["3.9 (achat)", "3.25"],
    chemins: ["/me/credit-bundles", "/me/payments", "/me/payment-methods*"],
  },
  "topup.manual": {
    gouverne: "Le versement manuel : verser sur un compte affiché, puis déposer son reçu",
    portee: ["app"],
    requiert: [],
    ecrans: ["3.9 (autre chemin)"],
    chemins: ["/me/collection-accounts", "/me/payments (mode semi-manuel)"],
  },
  referral: {
    gouverne: "Le parrainage et la page d'invitation",
    portee: ["app", "public"],
    requiert: [],
    ecrans: ["3.9 (inviter)", "public 3.7"],
    chemins: ["/me/referral", "/public/invitations/{code}"],
  },
  "launch.live": {
    gouverne: "Sur la landing : les liens vers les magasins, ou le formulaire de liste d'attente",
    portee: ["public"],
    requiert: [],
    ecrans: ["public 3.1"],
    chemins: ["/public/waitlist"],
  },
} as const satisfies Record<string, EntreeDrapeau>;

export type CleDrapeau = keyof typeof DRAPEAUX;

export const CLES_DRAPEAUX = Object.keys(DRAPEAUX) as CleDrapeau[];

// Dérivé de `portee` plutôt que réécrit à la main : rendre une clé publique se
// fait à un seul endroit.
export const CLES_PUBLIQUES: readonly CleDrapeau[] = CLES_DRAPEAUX.filter((c) =>
  (DRAPEAUX[c].portee as readonly PorteeDrapeau[]).includes("public"),
);

export const CLES_APPLICATION: readonly CleDrapeau[] = CLES_DRAPEAUX.filter((c) =>
  (DRAPEAUX[c].portee as readonly PorteeDrapeau[]).includes("app"),
);

// Ce que rendent /me/features et /public/features : la liste RÉSOLUE de ce qui
// est actif pour le demandeur, jamais l'état brut des drapeaux (§6.2).
//
// Un tableau de chaînes, pas un dictionnaire clé → booléen, et pas une
// énumération fermée : « éteint » et « inconnu » doivent se confondre côté
// client, puisque les deux valent éteint et que le parc ne se met pas à jour
// d'un bloc. Un client d'une version antérieure ignore une clé qu'il ne
// connaît pas, au lieu de refuser la réponse entière.
export const featuresResponseSchema = z
  .object({ features: z.array(z.string()) })
  .strict();

export type FeaturesResponse = z.infer<typeof featuresResponseSchema>;
