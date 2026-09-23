import {
  markNotificationsReadSchema,
  type MarkNotificationsReadInput, type Notification,
} from "@lehno/contracts";

/* Le centre de notifications — §3.13.
 *
 * « UNE NOTIFICATION MÈNE LÀ OÙ L'ON AGIT » — directement à l'écran concerné,
 * sans passer par la liste.
 */

/* ON NE DÉCOUPE JAMAIS `targetRoute`.
 *
 * Le contrat le dit, et donne la raison : « le client navigue par écran typé,
 * pas par chaîne. Lui faire découper `/occurrences/<uuid>` pour retrouver
 * l'identifiant, c'est lui faire réimplémenter la grammaire d'URL du serveur :
 * le jour où elle change, l'application se met à ouvrir des écrans vides sans
 * qu'aucun test ne tombe. »
 *
 * On lit donc les RÉFÉRENCES, jamais le chemin. C'est aussi la leçon de la
 * faille du lien sortant : une chaîne servie n'est pas une instruction.
 */
export type Cible =
  | { sorte: "occasion"; id: string }
  | { sorte: "proche"; id: string }
  | null;

/* UNE CIBLE DISPARUE REND L'ENTRÉE INERTE.
 *
 * « Les deux relations sont en `onDelete: SetNull`. Un proche supprimé vide
 * `personId` mais laisse `targetRoute` pointer sur sa fiche disparue. Rendre
 * les deux est ce qui permet au client de constater que la cible n'existe plus
 * et de rendre l'entrée inerte, au lieu d'ouvrir un écran mort. »
 *
 * L'occasion prime sur le proche : une notification qui vise une date mène à
 * cette date, pas à la fiche entière — on veut agir sur ce qui approche.
 */
export function cibleDeLaNotification(n: Notification): Cible {
  if (n.eventOccurrenceId) return { sorte: "occasion", id: n.eventOccurrenceId };
  if (n.personId) return { sorte: "proche", id: n.personId };
  return null;
}

/* CE QU'UNE ENTRÉE DIT, ou rien.
 *
 * Le serveur transporte `titleKey` et `bodyParams`, « JAMAIS une phrase
 * composée : la langue d'interface peut changer après l'envoi, et une phrase
 * figée resterait dans la langue d'hier ».
 *
 * Le NOM voyage avec la notification et ne se résout pas depuis `personId` :
 * « une notification est ce qu'on lit en premier, souvent hors connexion ».
 *
 * Une clé qu'on ne sait pas rendre donne `null` — l'entrée ne s'affiche pas.
 * Montrer « notification.activation_first_note » à quelqu'un serait pire que
 * de se taire : c'est du vocabulaire interne, et ça n'apprend rien.
 */
type Traductions = {
  notifRappel: (qui: string, j: number) => string;
  notifAujourdhui: (qui: string) => string;
  /* MA PROPRE DATE ne nomme personne : « Dans 7 jours : Valentine » lu par
     Valentine est exactement le défaut qu'on répare au serveur, et le répéter
     dans la liste du centre n'aurait rien valu de mieux. */
  notifMaDateRappel: (j: number) => string;
  notifMaDateAujourdhui: () => string;
  /* `notifContributionRecue`, et NON `notifContribution` : cette dernière
     existe déjà dans les deux dictionnaires, prend un NOMBRE et n'est employée
     nulle part — de la copie écrite pour une notification que rien n'écrivait.
     La réutiliser demanderait de grouper, ce que le serveur ne fait pas : il
     pose une entrée par contribution.

     DEUX FORMES, parce que le nom peut manquer et que ce n'est pas un défaut :
     un lien de collecte PUBLIC ne vise aucune fiche, et le serveur n'y met
     donc aucun nom. Une seule forme obligerait à en inventer un. */
  notifContributionRecue: (qui: string) => string;
  notifContributionRecueSansNom: () => string;
  /* Même arbitrage que la contribution : le nom du réservataire ne voyage que
     s'il a été autorisé, deux formes plutôt qu'un nom inventé. */
  notifSouhaitReserve: (libelle: string) => string;
  notifSouhaitReserveParQui: (qui: string, libelle: string) => string;
  notifActivationProche: () => string;
  notifActivationNote: () => string;
  notifActivationCredits: () => string;
  notifCarnetSilencieux: (j: number) => string;
  notifMatierePourProche: (qui: string) => string;
  notifBienvenue: (qui: string) => string;
};

export function libelleDeLaNotification(n: Notification, t: Traductions): string | null {
  const qui = typeof n.bodyParams?.person === "string" ? n.bodyParams.person : null;
  const jours = typeof n.bodyParams?.days === "number" ? n.bodyParams.days : null;
  const libelleSouhait = typeof n.bodyParams?.wishLabel === "string" ? n.bodyParams.wishLabel : null;
  const reservePar = typeof n.bodyParams?.by === "string" ? n.bodyParams.by : null;
  const silence = typeof n.bodyParams?.silenceDays === "number" ? n.bodyParams.silenceDays : null;
  const pseudo = typeof n.bodyParams?.pseudo === "string" ? n.bodyParams.pseudo : null;

  switch (n.titleKey) {
    case "notification.event_reminder":
      return qui !== null && jours !== null ? t.notifRappel(qui, jours) : null;
    case "notification.event_day_of":
      return qui !== null ? t.notifAujourdhui(qui) : null;
    case "notification.own_date_reminder":
      return jours !== null ? t.notifMaDateRappel(jours) : null;
    case "notification.own_date_day_of":
      return t.notifMaDateAujourdhui();
    /* Le nom vient de `bodyParams`, jamais de `personId` : une notification se
       lit souvent hors connexion, et résoudre une fiche demanderait le réseau.
       Absent sur un lien public, où la contribution ne vise personne. */
    case "notification.contribution_received":
      return qui !== null ? t.notifContributionRecue(qui) : t.notifContributionRecueSansNom();
    // Même règle : le nom du réservataire ne paraît que s'il a été autorisé.
    case "notification.wish_reserved":
      if (libelleSouhait === null) return null;
      return reservePar !== null
        ? t.notifSouhaitReserveParQui(reservePar, libelleSouhait)
        : t.notifSouhaitReserve(libelleSouhait);
    // Les trois relances d'activation ne portent rien de variable à afficher —
    // `envoi` ne sert qu'au serveur, à plafonner l'envoi.
    case "notification.activation_first_person":
      return t.notifActivationProche();
    case "notification.activation_first_note":
      return t.notifActivationNote();
    case "notification.activation_unused_credits":
      return t.notifActivationCredits();
    case "notification.enrichment_nudge_global":
      return silence !== null ? t.notifCarnetSilencieux(silence) : null;
    case "notification.enrichment_nudge_person":
      return qui !== null ? t.notifMatierePourProche(qui) : null;
    // Distincte de l'écran de bienvenue : elle vit dans le centre pour qui
    // ferme l'application avant d'avoir vu cet écran-là.
    case "notification.welcome":
      return pseudo !== null ? t.notifBienvenue(pseudo) : null;
    default:
      return null;
  }
}

/* CE QUE LE SERVEUR ÉMET ET QUE LA COPIE NE SAIT PAS DIRE.
 *
 * Rendu visible par un test plutôt que perdu dans un commentaire : ces
 * notifications partent, arrivent, et n'apparaissent nulle part. C'est un
 * silence, pas une panne — mais il se voit d'autant moins qu'il est silencieux.
 */
export const CLES_SERVIES: readonly string[] = [
  "notification.event_reminder",
  // Écrite par `mur/collecte.service.ts` à chaque contribution reçue.
  "notification.contribution_received",
  "notification.event_day_of",
  "notification.activation_first_person",
  "notification.activation_first_note",
  "notification.activation_unused_credits",
  "notification.enrichment_nudge_global",
  "notification.enrichment_nudge_person",
  // Avec son préfixe, comme le serveur l'émet réellement
  // (shared-wishlist.service.ts). Sans lui, cette liste auditait une clé qui
  // n'existe pas et manquait celle qui part — un audit faux est pire qu'un
  // audit absent, parce qu'on le croit.
  "notification.wish_reserved",
  "notification.own_date_reminder",
  "notification.own_date_day_of",
  // Écrite par `signup.service.ts`, une seule fois à l'inscription.
  "notification.welcome",
];

export function clesSansLibelle(t: Traductions): string[] {
  /* Le gabarit porte les paramètres des ONZE clés à la fois — `wishLabel`,
     `silenceDays`, `pseudo` compris — pour que l'audit exerce chaque branche
     du `switch`, pas seulement celles qui se contentent de `person`/`days`. */
  const gabarit: Notification = {
    id: "", type: "event_reminder", titleKey: "",
    bodyParams: {
      person: "Ana", days: 3, wishLabel: "Un carnet", silenceDays: 30, pseudo: "Ana",
    },
    targetRoute: null, personId: null, eventOccurrenceId: null, readAt: null,
    notifiedAt: "2026-08-01T00:00:00.000Z",
  };
  return CLES_SERVIES.filter(
    (cle) => libelleDeLaNotification({ ...gabarit, titleKey: cle }, t) === null,
  );
}

/* AUJOURD'HUI, PUIS AVANT — sur `notifiedAt`, jamais sur la date de création.
 *
 * « La programmation pose les rappels jusqu'à un mois d'avance : un rappel J-7
 * pour une date dans cinq semaines existe en base depuis quatre semaines quand
 * il devient enfin visible. Servir `created_at` afficherait *il y a 28 jours*
 * sur un rappel arrivé ce matin. »
 */
export function estDAujourdhui(n: Notification, aujourdhui: string): boolean {
  return n.notifiedAt.slice(0, 10) === aujourdhui;
}

/* MARQUER COMME LU : une liste, ou TOUT — jamais un corps vide.
 *
 * « Un `{}` qui vaudrait *tout* ferait qu'un client bogué — un tableau
 * d'identifiants resté vide parce que rien n'était sélectionné — viderait la
 * pastille de quelqu'un qui n'a rien lu. »
 *
 * On refuse donc de composer un corps depuis une liste vide, plutôt que de
 * l'envoyer et de laisser le serveur trancher.
 */
export function corpsDeLecture(ids: readonly string[]): MarkNotificationsReadInput {
  return markNotificationsReadSchema.parse({ ids: [...ids] });
}

export function corpsDeToutLire(): MarkNotificationsReadInput {
  return markNotificationsReadSchema.parse({ all: true });
}
