import type { Locale } from "./locale.js";

/* CE QUE LE SERVEUR COMPOSE, ET POURQUOI IL LE FAIT ICI.
 *
 * La règle du produit est que le serveur n'envoie jamais une phrase : il
 * transmet `titleKey` et `bodyParams`, et le client rend le texte dans la
 * langue du moment. C'est ce qui évite qu'une phrase figée reste dans la
 * langue d'hier quand quelqu'un change de langue après coup.
 *
 * Cette règle vaut pour le CENTRE DE NOTIFICATIONS, où le client est là pour
 * rendre. Elle ne peut pas valoir pour les deux autres surfaces :
 *
 * - le COURRIER part chez un fournisseur qui ne connaît ni nos clés ni nos
 *   traductions ; aujourd'hui il transporte la clé brute en objet et les
 *   paramètres en JSON, ce qui part et ne se lit pas ;
 * - la NOTIFICATION POUSSÉE est affichée par le système d'exploitation, sur un
 *   écran verrouillé, sans que l'application soit ouverte. Rien ne peut la
 *   rendre à notre place.
 *
 * D'où ce module, et d'où sa place dans @lehno/i18n plutôt que dans l'api :
 * les phrases doivent vivre là où le client peut aussi les lire, sinon les
 * mêmes libellés existeraient à deux endroits et divergeraient.
 */

export type Phrase = { titre: string; corps: string };

/* Une clé inconnue rend `null`, jamais une phrase de repli.
 *
 * Envoyer « notification.enrichment_nudge_person » à quelqu'un serait pire que
 * de se taire : c'est du vocabulaire interne, et ça n'apprend rien. Le silence
 * se rattrape au passage suivant ; un courrier illisible est déjà parti.
 */
type Composeur = (p: Record<string, unknown>) => Phrase | null;

// ─── Lecture des paramètres ──────────────────────────────────────────────────
// Les paramètres viennent d'une colonne JSON : rien ne garantit leur forme au
// type près. On lit défensivement, et un paramètre manquant fait taire la
// notification plutôt que d'écrire « undefined » dans un courrier.

const texte = (p: Record<string, unknown>, cle: string): string | null =>
  typeof p[cle] === "string" && p[cle] !== "" ? (p[cle] as string) : null;

const nombre = (p: Record<string, unknown>, cle: string): number | null =>
  typeof p[cle] === "number" && Number.isFinite(p[cle]) ? (p[cle] as number) : null;

/* La nature décide du ton, et son ABSENCE vaut « sensible ».
 *
 * C'est délibérément l'inverse du réflexe : un paramètre manquant donnerait
 * plutôt envie de retomber sur le cas courant, qui est `happy`. Mais l'erreur
 * n'est pas symétrique — un ton sobre sur un anniversaire heureux est fade,
 * un « c'est aujourd'hui, envoyez un mot » sur un anniversaire de décès est
 * impardonnable. On choisit de fader.
 */
const estSensible = (p: Record<string, unknown>): boolean => p["nature"] !== "happy";

const MOIS: Record<Locale, readonly string[]> = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin",
       "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  en: ["January", "February", "March", "April", "May", "June",
       "July", "August", "September", "October", "November", "December"],
};

/* La date arrive en `YYYY-MM-DD` et se découpe à la main.
 *
 * Surtout pas `new Date("2026-03-14")` : la chaîne est interprétée en UTC, et
 * un serveur à l'ouest de Greenwich rendrait « 13 mars ». Un rappel décalé
 * d'un jour est pire qu'un rappel absent — on croit l'avoir lu.
 */
function dateEnClair(iso: string | null, locale: Locale): string | null {
  if (iso === null || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [, m, j] = iso.split("-");
  const mois = MOIS[locale][Number(m) - 1];
  if (mois === undefined) return null;
  const jour = Number(j);
  return locale === "fr"
    ? `${jour === 1 ? "1er" : jour} ${mois}`
    : `${mois} ${jour}`;
}

/* « demain » plutôt que « dans 1 jour », qui ne se dit pas.
 *
 * Et les nombres en chiffres dès deux, en lettres pour un seul — la règle du
 * ton. Ici le cas « un » n'existe pas puisqu'il devient « demain ».
 */
function delaiEnClair(jours: number, locale: Locale): string {
  if (locale === "fr") return jours <= 1 ? "demain" : `dans ${jours} jours`;
  return jours <= 1 ? "tomorrow" : `in ${jours} days`;
}

// ─── Français ────────────────────────────────────────────────────────────────

const FR: Record<string, Composeur> = {
  "notification.event_reminder": (p) => {
    const qui = texte(p, "person");
    const jours = nombre(p, "days");
    const quand = dateEnClair(texte(p, "date"), "fr");
    if (qui === null || jours === null || quand === null) return null;
    // §4.8 : sobre, court, sans compassion affichée. On accompagne en se taisant.
    if (estSensible(p)) {
      return { titre: `Le ${quand} approche`, corps: `Une date notée pour ${qui}.` };
    }
    // §4.4 : dire ce qui va se passer et ce qu'on peut faire, jamais l'urgence.
    return {
      titre: `Une date pour ${qui} approche`,
      corps: `Le ${quand}, ${delaiEnClair(jours, "fr")}. Le bon moment pour préparer un mot.`,
    };
  },

  "notification.event_day_of": (p) => {
    const qui = texte(p, "person");
    if (qui === null) return null;
    if (estSensible(p)) {
      return { titre: "C'est aujourd'hui", corps: `Une date notée pour ${qui}.` };
    }
    // Le seul message de la liste qui peut être chaleureux — et seulement ici.
    return { titre: `C'est aujourd'hui pour ${qui}`, corps: "Le bon moment pour lui envoyer un mot." };
  },

  // §4.6 : dire le bénéfice, pas l'ordre. Et surtout pas « vous n'avez rien
  // noté depuis un mois », qui reproche.
  "notification.enrichment_nudge_global": () => ({
    titre: "Une idée notée aujourd'hui sert dans six mois",
    corps: "Et quelqu'un est peut-être entré dans votre vie sans avoir encore sa fiche.",
  }),

  "notification.enrichment_nudge_person": (p) => {
    const qui = texte(p, "person");
    if (qui === null) return null;
    return {
      titre: `Une date approche pour ${qui}`,
      corps: "Il n'y a pas grand-chose de noté sur cette personne. Deux mots suffisent.",
    };
  },

  /* Les trois relances d'activation, et le second envoi qui dit AUTRE CHOSE.
   *
   * « La deuxième relance ne doit pas insister : elle dit autre chose, elle ne
   * répète pas plus fort. » Répéter le même texte deux fois se lit comme une
   * mécanique, et c'est ce qui fait cliquer sur « se désabonner ».
   */
  "notification.activation_first_person": (p) =>
    nombre(p, "envoi") === 2
      ? { titre: "Lehno ne sait pas encore qui compte pour vous",
          corps: "Un nom et une date, et il s'occupe du reste." }
      : { titre: "Une première fiche suffit pour commencer",
          corps: "Ajoutez un proche et sa date. Lehno s'occupe de vous le rappeler." },

  "notification.activation_first_note": (p) =>
    nombre(p, "envoi") === 2
      ? { titre: "Le jour venu, on cherche quoi dire",
          corps: "C'est ce qui a été noté avant qui répond." }
      : { titre: "Ce qui est noté sert le jour venu",
          corps: "Une phrase entendue au dîner suffit." },

  "notification.activation_unused_credits": (p) =>
    nombre(p, "envoi") === 2
      ? { titre: "Vos crédits offerts n'ont pas encore servi",
          corps: "Ils restent là. Un essai ne coûte rien de plus." }
      : { titre: "Vos crédits offerts sont déjà là",
          corps: "Le bon moment pour voir ce que Lehno sait faire, sans payer." },

  /* Réservée au centre : elle part en `in_app` seulement.
   *
   * Elle a quand même sa phrase ici, et c'est voulu — le jour où elle
   * s'ouvrira au courrier ou au téléphone, le canal changera d'un mot dans la
   * programmation, et rien n'obligera à se souvenir qu'il manquait un texte.
   */
  "notification.wish_reserved": (p) => {
    const souhait = texte(p, "wishLabel");
    if (souhait === null) return null;
    const par = texte(p, "by");
    return {
      titre: "Un souhait vient d'être réservé",
      // Le nom SEULEMENT s'il a été autorisé : nommer un anonyme gâcherait la
      // surprise plus sûrement qu'un écran, puisque ça s'affiche sans qu'on
      // l'ait demandé.
      corps: par === null ? `${souhait}.` : `${souhait}, par ${par}.`,
    };
  },
};

// ─── Anglais ─────────────────────────────────────────────────────────────────
// L'anglais s'écrit, il ne se traduit pas : la version française sert de
// référence de sens, pas de gabarit de phrase. Aucun point d'exclamation,
// contractions assumées, sentence case.

const EN: Record<string, Composeur> = {
  "notification.event_reminder": (p) => {
    const qui = texte(p, "person");
    const jours = nombre(p, "days");
    const quand = dateEnClair(texte(p, "date"), "en");
    if (qui === null || jours === null || quand === null) return null;
    if (estSensible(p)) {
      return { titre: `${quand} is coming up`, corps: `A date noted for ${qui}.` };
    }
    return {
      titre: `A date for ${qui} is coming up`,
      corps: `${quand}, ${delaiEnClair(jours, "en")}. A good moment to get a few words ready.`,
    };
  },

  "notification.event_day_of": (p) => {
    const qui = texte(p, "person");
    if (qui === null) return null;
    if (estSensible(p)) {
      return { titre: "It's today", corps: `A date noted for ${qui}.` };
    }
    return { titre: `It's today for ${qui}`, corps: "A good moment to send a few words." };
  },

  "notification.enrichment_nudge_global": () => ({
    titre: "A note made today is worth something in six months",
    corps: "And someone may have come into your life without a page yet.",
  }),

  "notification.enrichment_nudge_person": (p) => {
    const qui = texte(p, "person");
    if (qui === null) return null;
    return {
      titre: `A date is coming up for ${qui}`,
      corps: "There isn't much noted about them. Two words are enough.",
    };
  },

  "notification.activation_first_person": (p) =>
    nombre(p, "envoi") === 2
      ? { titre: "Lehno doesn't know who matters to you yet",
          corps: "A name and a date, and it takes care of the rest." }
      : { titre: "One page is enough to start",
          corps: "Add someone and their date. Lehno takes care of reminding you." },

  "notification.activation_first_note": (p) =>
    nombre(p, "envoi") === 2
      ? { titre: "When the day comes, you look for something to say",
          corps: "What answers is what was noted before." }
      : { titre: "What gets noted is what serves on the day",
          corps: "A sentence overheard at dinner is enough." },

  "notification.activation_unused_credits": (p) =>
    nombre(p, "envoi") === 2
      ? { titre: "Your free credits haven't been used yet",
          corps: "They're still there. One try costs nothing more." }
      : { titre: "Your free credits are already there",
          corps: "A good moment to see what Lehno can do, without paying." },

  "notification.wish_reserved": (p) => {
    const souhait = texte(p, "wishLabel");
    if (souhait === null) return null;
    const par = texte(p, "by");
    return {
      titre: "A wish has just been reserved",
      corps: par === null ? `${souhait}.` : `${souhait}, by ${par}.`,
    };
  },
};

const PHRASES: Record<Locale, Record<string, Composeur>> = { fr: FR, en: EN };

/* Les clés que ce module sait rendre.
 *
 * Exportée pour qu'un test puisse la confronter à ce que le serveur émet
 * réellement : une clé ajoutée à la programmation et oubliée ici part en
 * silence, et le silence ne se voit pas.
 */
export const CLES_COMPOSEES: readonly string[] = Object.keys(FR);

export function phraseDeNotification(
  titleKey: string,
  bodyParams: unknown,
  locale: Locale,
): Phrase | null {
  const composeur = PHRASES[locale][titleKey];
  if (composeur === undefined) return null;
  const params =
    bodyParams !== null && typeof bodyParams === "object" && !Array.isArray(bodyParams)
      ? (bodyParams as Record<string, unknown>)
      : {};
  return composeur(params);
}
