import { z } from "zod";
import type { WishOrigin } from "./me-wishes.js";

/* Le plan de mesure — spécification technique §16.
 *
 * Le registre vit dans le CODE, pour la même raison que celui des drapeaux :
 * un nom mal orthographié devient une erreur de compilation, pas un événement
 * qui n'arrive jamais dans l'outil et dont personne ne s'aperçoit avant qu'on
 * cherche une courbe. C'est le défaut classique de ces plans — ils pourrissent
 * en silence, et on ne le découvre qu'en voulant trancher une question.
 *
 * Les PROPRIÉTÉS sont typées événement par événement. Ce n'est pas du zèle :
 * §16.4 interdit de transporter du contenu — le texte d'une note, le nom d'un
 * proche, une adresse. Un type ouvert (`Record<string, unknown>`) laisserait
 * n'importe quel appelant en glisser un jour, et rien ne rougirait. Ici, une
 * propriété non déclarée ne compile pas.
 *
 * N'y figure que ce qui PEUT être émis aujourd'hui. Le reste du plan §16.3 —
 * génération, souhaits, studio, collecte — arrivera avec sa fonctionnalité :
 * déclarer un nom que rien n'émet donnerait l'illusion d'une mesure posée. */

// D'où vient le fait. Le serveur ne le devine pas : le client l'annonce.
export const SURFACES = ["app", "web", "admin"] as const;
export type Surface = (typeof SURFACES)[number];

/* Les propriétés COMMUNES à tout événement (§16.2).
 *
 * `userId` et `flags` viennent du serveur ; le reste vient du client, par
 * en-têtes. L'adresse électronique n'y figure pas et ne peut pas y figurer :
 * l'identifiant de compte suffit à recoller un parcours, et une adresse dans
 * un outil tiers est une fuite que rien ne rattrape. */
export type ProprietesCommunes = {
  readonly userId: string | null;
  readonly surface: Surface | null;
  readonly appVersion: string | null;
  readonly language: string | null;
  readonly theme: string | null;
  readonly sessionId: string | null;
  readonly correlationId: string | null;
  /* Les drapeaux ACTIFS au moment du fait (§16.2).
   *
   * Sans eux, une courbe qui monte le jour d'une bascule reste inexplicable :
   * on ne sait pas si le produit a changé ou si la population mesurée a
   * changé. Attachés ici, jamais au point d'appel — un appelant qui oublierait
   * ferait un trou dans la série. */
  readonly flags: readonly string[];
};

/* Les en-têtes par lesquels le client annonce son contexte.
 *
 * Des en-têtes plutôt qu'un corps : ils accompagnent CHAQUE appel sans que le
 * schéma de chaque route ait à les porter, et un client qui les oublie ne
 * casse rien — la propriété vaut simplement `null`. */
export const ENTETES_MESURE = {
  surface: "x-lehno-surface",
  appVersion: "x-lehno-app-version",
  language: "x-lehno-language",
  theme: "x-lehno-theme",
  sessionId: "x-lehno-session",
} as const;

// Par où l'on est entré. `code` est l'envoi d'un code à usage unique.
export const VOIES_ENTREE = ["code", "google", "apple"] as const;
export type VoieEntree = (typeof VOIES_ENTREE)[number];

// D'où vient une fiche de proche. La saisie à la volée depuis une note et la
// contribution publique se distinguent de la saisie directe : elles disent que
// le produit a fait le travail à la place de l'utilisateur.
export const ORIGINES_PROCHE = ["manual", "from_note", "public_submission"] as const;
export type OrigineProche = (typeof ORIGINES_PROCHE)[number];

// D'où une note a été prise. « au fil de l'eau, ou seulement à l'approche
// d'une date ? » est l'une des questions que le plan doit trancher (§16.1).
export const ORIGINES_NOTE = ["home", "person", "occasion"] as const;
export type OrigineNote = (typeof ORIGINES_NOTE)[number];

/* Le registre. Chaque entrée déclare le nom exact et la forme de ses
 * propriétés. Convention §16.2 : `domaine.objet_action`, au passé, en
 * minuscules. */
export type EvenementsMesure = {
  /* §16.3 met la voie sur `started`, et « parrainé ou non » sur `completed` —
     c'est l'entonnoir qui compte : combien commencent par Google et combien
     finissent. Porter la voie sur les deux la rendrait redondante ; ne la
     porter que sur `completed` empêcherait de mesurer l'abandon par voie. */
  "signup.started": { method: VoieEntree };
  "signup.completed": { referred: boolean };
  "signin.completed": { method: VoieEntree };
  /* `onboarding.username_set` de §16.3 n'est PAS ici, et c'est délibéré : le
     pseudo se pose dans l'appel d'inscription lui-même, donc l'événement
     tomberait au même instant que `signup.completed` et ne mesurerait rien de
     plus. C'est l'écran atteint qui intéresse, et le serveur ne le voit pas —
     §16.5 le range explicitement du côté client. */
  // LE passage à l'usage : le premier proche. Distinct de `person.created`,
  // qu'il accompagne — un entonnoir d'activation se lit sur lui seul.
  "person.first_created": Record<string, never>;
  "person.created": { origin: OrigineProche; hasBirthDate: boolean };
  /* On compte les caractères, on ne transporte pas le texte (§16.4). Le nombre
     de proches désignés et la présence d'une occasion disent comment la
     capture est employée, sans rien dire de ce qui a été écrit. */
  "note.created": {
    persons: number;
    hasOccasion: boolean;
    length: number;
    origin: OrigineNote;
  };
  "event.created": { kind: string; scheduleCount: number };
  /* §16.3 : « `wish.added` (provenance) ». La provenance SEULE — ni le
     libellé, ni le lien, ni le prix : §16.4 interdit de transporter du
     contenu, et un souhait en est. Ce qu'on cherche à savoir est si les
     souhaits arrivent par la collecte, par une idée retenue ou de la main du
     propriétaire ; c'est ce qui dit laquelle des trois voies porte le produit. */
  "wish.added": { origin: WishOrigin };
  /* LA BOUCLE DES LISTES (§16.3), celle qui dit si le produit croît tout seul :
     combien de vues par liste partagée, combien de réservations par vue.
     Elle se lit d'un bout à l'autre, donc chaque maillon doit exister — un seul
     manquant, et le taux qu'on cherche n'est plus calculable.

     Aucun de ces événements ne porte de contenu (§16.4) : ni le libellé d'un
     souhait, ni le prénom du propriétaire, ni — surtout — l'adresse ou le nom
     du réservant. `identityRevealed` dit qu'un nom a été donné, jamais lequel. */
  "wishlist.created": Record<string, never>;
  "wishlist.wish_added": { hasPhoto: boolean; hasPrice: boolean };
  "wishlist.shared": Record<string, never>;
  "shared_list.viewed": { authenticated: boolean; wishCount: number };
  "reservation.started": { authenticated: boolean };
  "reservation.confirmed": { identityRevealed: boolean; secondsToConfirm: number };
};

export type NomEvenement = keyof EvenementsMesure;

// Les noms, à l'exécution — pour un test qui vérifie la convention, et pour
// l'adaptateur qui n'a pas les types.
export const NOMS_EVENEMENTS = [
  "signup.started", "signup.completed", "signin.completed",
  "person.first_created", "person.created", "note.created", "event.created",
  "wish.added",
  "wishlist.created", "wishlist.wish_added", "wishlist.shared",
  "shared_list.viewed", "reservation.started", "reservation.confirmed",
] as const satisfies readonly NomEvenement[];

// La forme qu'un adaptateur reçoit. Le nom, ses propriétés propres, et les
// communes — assemblées par le service, jamais par l'appelant.
export const evenementMesureSchema = z
  .object({
    name: z.string(),
    properties: z.record(z.unknown()),
    common: z.record(z.unknown()),
  })
  .strict();
