import {
  CONFIGURABLE_NOTIFICATION_TYPES, estActive,
  type DigestFrequency, type NotificationPreferenceItem, type NotificationType,
} from "@lehno/contracts";

/* Rappels et notifications — §3.11.
 *
 * LE SERVEUR RÈGLE CHAQUE NATURE SÉPARÉMENT ; l'écran en groupe onze en cinq.
 * Le contrat le dit et refuse de le faire à notre place : « on ne rejoue PAS ce
 * groupement ici — le coder côté serveur créerait une SECONDE source de vérité,
 * la maquette évoluerait, ce fichier resterait figé ». Le regroupement ne change
 * que l'AFFICHAGE, jamais ce qui part.
 *
 * C'est donc ici, une fois, et l'écran ne connaît que les groupes.
 */

export type CleDeGroupe =
  | "avant" | "jour" | "recap" | "valider" | "relances" | "vie";

export interface Groupe {
  cle: CleDeGroupe;
  /* Les natures que ce groupe commande. Basculer le groupe les bascule
     toutes : c'est la promesse de l'écran, « prévenez-moi de ceci », pas
     « prévenez-moi de trois des quatre choses qui composent ceci ». */
  types: readonly NotificationType[];
  /* Le drapeau sans lequel le groupe n'a aucun sens. Éteint, il disparaît :
     régler la réception d'une contribution qu'on ne peut pas recevoir
     serait un interrupteur sans effet, et un interrupteur sans effet apprend
     à ne pas croire les interrupteurs. */
  drapeau: string | null;
}

const GROUPES: readonly Groupe[] = [
  /* J−7 ET J−1 NE SE DISTINGUENT PAS ICI, et c'est voulu.
   *
   * La maquette propose trois interrupteurs — une semaine avant, la veille, le
   * jour même. Le contrat n'a que deux natures : `event_reminder` et
   * `event_day_of`. Le DÉLAI d'un rappel ne se règle pas globalement, il se
   * choisit par date au moment de la poser (`schedules`, de 0 à 30 jours).
   *
   * Offrir trois bascules dont deux commandent la même nature ferait qu'en
   * éteindre une éteindrait l'autre, sans qu'on comprenne pourquoi. Deux
   * interrupteurs qui disent vrai valent mieux que trois qui mentent. */
  { cle: "avant", types: ["event_reminder"], drapeau: null },
  { cle: "jour", types: ["event_day_of"], drapeau: null },
  { cle: "recap", types: ["digest"], drapeau: null },
  { cle: "valider", types: ["contribution_received", "wish_received"], drapeau: "collect" },
  {
    cle: "relances",
    types: ["enrichment_nudge_global", "enrichment_nudge_person"],
    drapeau: null,
  },
  /* La vie du compte : ce que deviennent les crédits, et la production qu'on
     attend. Trois natures que personne ne règle séparément — on veut savoir,
     ou on ne veut pas. */
  {
    cle: "vie",
    types: ["credits_received", "payment_succeeded", "payment_failed", "generation_ready"],
    drapeau: null,
  },
];

/* Les groupes que cet écran montre. Un groupe dont le drapeau est éteint sort
   entièrement — pas de bascule grisée. */
export function groupesOfferts(actives: readonly string[]): Groupe[] {
  return GROUPES.filter((g) => g.drapeau === null || estActive(actives, g.drapeau));
}

/* AUCUNE NATURE NE DOIT ÊTRE ORPHELINE. Le contrat peut en ajouter une ; si
   personne ne la groupe, elle devient invisible et donc irréglable — allumée
   pour toujours sans que rien à l'écran ne le dise. Cette fonction existe pour
   qu'un test le voie tout de suite. */
export function typesNonGroupes(): NotificationType[] {
  const groupees = new Set(GROUPES.flatMap((g) => g.types));
  return CONFIGURABLE_NOTIFICATION_TYPES.filter((t) => !groupees.has(t));
}

export type Canal = "push" | "email";

/* L'ÉTAT D'UN GROUPE SUR UN CANAL.
 *
 * Allumé seulement si TOUTES ses natures le sont. Le contraire — « allumé dès
 * qu'une l'est » — montrerait une bascule active alors qu'une partie ne part
 * pas, et c'est le silence qu'on ne pardonne pas : on croit être prévenu.
 *
 * Une nature ABSENTE de la liste vaut son défaut, qui est ALLUMÉ. Le serveur
 * rend pourtant l'état effectif de chaque type configurable, justement pour
 * que le client n'ait pas à connaître ce défaut ; on le tient quand même ici,
 * parce qu'une réponse tronquée ne doit pas se lire « éteint ».
 */
export function etatDuGroupe(
  groupe: Groupe,
  preferences: readonly NotificationPreferenceItem[],
  canal: Canal,
): boolean {
  return groupe.types.every((type) => {
    const ligne = preferences.find((p) => p.type === type);
    if (!ligne) return true;
    return canal === "push" ? ligne.pushEnabled : ligne.emailEnabled;
  });
}

/* CE QU'ON ENVOIE POUR BASCULER UN GROUPE.
 *
 * Toutes ses natures, avec la valeur voulue sur le canal touché et l'autre
 * canal INCHANGÉ — le schéma d'une préférence porte les deux, donc omettre
 * l'autre l'écraserait au défaut. On repart de l'état effectif servi, jamais
 * d'une supposition.
 *
 * Seules les natures du groupe partent : le contrat accepte une liste
 * partielle, et renvoyer les onze écraserait ce qu'un autre appareil vient de
 * changer.
 */
export function basculeDuGroupe(
  groupe: Groupe,
  preferences: readonly NotificationPreferenceItem[],
  canal: Canal,
  valeur: boolean,
): NotificationPreferenceItem[] {
  return groupe.types.map((type) => {
    const ligne = preferences.find((p) => p.type === type);
    const push = ligne?.pushEnabled ?? true;
    const email = ligne?.emailEnabled ?? true;
    return {
      type,
      pushEnabled: canal === "push" ? valeur : push,
      emailEnabled: canal === "email" ? valeur : email,
    };
  });
}

/* « Aucun canal n'est ouvert : rien ne vous parviendra. »
 *
 * L'avertissement se dit quand les DEUX canaux sont fermés partout — pas quand
 * l'un l'est. Fermer la poussée et garder le courriel est un réglage
 * ordinaire, pas un silence ; le dire alarmerait pour rien, et l'avertissement
 * cesserait d'être lu le jour où il compte.
 *
 * Les alertes de sécurité partent quoi qu'il arrive : elles ne sont pas dans
 * les natures configurables. L'écran le dit à part, et cette phrase-ci ne
 * parle donc que du reste. */
export function plusRienNeParvient(
  groupes: readonly Groupe[],
  preferences: readonly NotificationPreferenceItem[],
): boolean {
  return groupes.every((g) =>
    !etatDuGroupe(g, preferences, "push") && !etatDuGroupe(g, preferences, "email"));
}

/* LES DEUX RYTHMES QUI SE DISENT. Le contrat en porte trois — `never` compris —
   mais aucun libellé n'existe pour le troisième, et l'inventer serait écrire à
   la place de qui écrit les textes.
   
   Ce n'est pas une perte : le récapitulatif est un GROUPE comme les autres,
   avec ses deux interrupteurs de canal. Les fermer tous deux le fait taire
   aussi sûrement que `never`, et par le geste que l'écran emploie partout
   ailleurs. `never` reste au contrat pour qui saura le nommer. */
export const RYTHMES: readonly DigestFrequency[] = ["weekly", "monthly"];
