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
  /* LE SOCLE GARDE LES ANNIVERSAIRES. Ce drapeau ne gouverne que les AUTRES
   * types — fête, jalon, mariage, date à échéances multiples. Éteint, on lance
   * avec les seuls anniversaires : la promesse du produit resserrée, et toute
   * la complexité de §3.6 (récurrences libres, jalons, libellés) écartée.
   *
   * Il n'est PAS de la même nature que les autres, et c'est assumé. Les autres
   * gouvernent des écrans et des chemins : le garde rend 404, la surface
   * n'existe pas. Celui-ci gouverne une VALEUR dans une requête — `kind:
   * "other"` sur un chemin que les anniversaires empruntent aussi. Un 404 y
   * serait faux : le chemin existe, et tout le monde le sait.
   *
   * Il garde la CRÉATION, jamais l'existant. Éteint après usage, les événements
   * libres déjà créés restent visibles et modifiables, leurs échéances
   * continuent de tomber — seul le bouton « autre type » disparaît. Éteindre
   * une fonctionnalité ne doit pas effacer ce que les gens ont écrit.
   *
   * Le client n'a AUCUNE règle à connaître : `/me/metadata` filtre `eventKinds`
   * d'après ce drapeau, et l'écran propose ce que la liste contient. */
  "events.other": {
    gouverne: "Les événements autres qu'un anniversaire — fête, jalon, date à échéances",
    portee: ["app"],
    requiert: [],
    ecrans: ["3.6 (choix du type)"],
    chemins: ["/me/events (kind: other)", "/me/metadata (eventKinds)"],
  },
  "generation.message": {
    gouverne: "Le message généré",
    /* Portée PUBLIQUE en plus de l'application, et ce n'est pas une erreur :
       la landing montre ses sections d'après les drapeaux, comme l'application
       masque les siennes. Même source, donc une page ne peut pas promettre ce
       qui est éteint — pas plus qu'un écran ne peut proposer ce qui est fermé.
       
       C'est structurel plutôt que discipliné : sans ça, quelqu'un devrait
       PENSER à mettre la landing à jour le jour où un drapeau bascule. Ça
       marche trois fois, puis la page promet « bientôt » ce qui est livré
       depuis un mois.
       
       La correspondance section → drapeaux, elle, vit côté landing : une
       section peut dépendre d'un drapeau ou d'un « ou » entre plusieurs, et
       c'est éditorial. Le serveur dit ce qui est ACTIF, pas ce qu'on en montre. */
    portee: ["app", "public"],
    // Pas de dépendance à `credits`, et c'est le piège que §6.4 signale :
    // éteindre l'achat ne doit pas éteindre le produit. Sans crédits, les
    // générations restent disponibles et GRATUITES si leur drapeau est allumé.
    requiert: [],
    ecrans: ["3.7 (message)"],
    chemins: ["/me/generations", "/me/messages/{id}"],
  },
  "generation.ideas": {
    gouverne: "Les idées de cadeaux",
    portee: ["app", "public"],
    requiert: [],
    ecrans: ["3.7 (idées)"],
    chemins: ["/me/generations"],
  },
  "generation.portrait": {
    gouverne: "Le studio et le portrait",
    portee: ["app", "public"],
    requiert: [],
    ecrans: ["3.22", "le studio"],
    chemins: ["/me/studio/options", "/me/generations", "/me/portraits/*"],
  },
  /* « Les crédits existent et s'achètent » — le fait, pas le canal.
   *
   * Il mélangeait les deux jusqu'ici, et ça rendait un lancement en paiement
   * manuel seul INEXPRIMABLE : l'éteindre pour couper l'opérateur emportait
   * `/me/credit-bundles`, or le versement manuel achète les MÊMES paliers
   * (contrat commun §5). Le manuel tombait avec l'automatique.
   *
   * Éteint, les générations restent disponibles et GRATUITES si leur propre
   * drapeau est allumé (§6.4) : fermer le paiement ne ferme pas le produit. */
  credits: {
    gouverne: "Les crédits : ils existent, ils s'achètent par paliers",
    portee: ["app", "public"],
    requiert: [],
    ecrans: ["3.9 (achat)"],
    chemins: ["/me/credit-bundles", "/me/payments"],
  },
  /* Le canal AUTOMATIQUE, seul. Éteint, on encaisse par versement manuel
   * pendant que l'intégration opérateur attend — et les paliers, eux, restent
   * servis. C'est ce qui rend « lancer en manuel seul » exprimable :
   * `credits` allumé, `topup.manual` allumé, celui-ci éteint. */
  "topup.provider": {
    gouverne: "Le paiement par opérateur : méthodes enregistrées et sollicitation sur le téléphone",
    // Il n'y a rien à payer si les crédits n'existent pas.
    requiert: ["credits"],
    portee: ["app"],
    ecrans: ["3.25", "3.9 (attente opérateur)"],
    chemins: ["/me/payment-methods*", "/me/payments (mode provider)"],
  },
  "topup.manual": {
    gouverne: "Le versement manuel : verser sur un compte affiché, puis déposer son reçu",
    portee: ["app"],
    // Comme le canal automatique : il achète les mêmes paliers, donc il n'a
    // aucun sens sans les crédits.
    requiert: ["credits"],
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
