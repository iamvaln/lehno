import type { Langue } from "./langues.js";

/**
 * Une date « AAAA-MM-JJ » rendue en toutes lettres, dans la langue de lecture.
 *
 * **En UTC, toujours.** Le serveur envoie un jour civil, pas un instant : le
 * 7 mars est le 7 mars à Douala comme à Montréal. Laisser le fuseau du
 * navigateur intervenir décalerait la date d'un jour pour la moitié du monde,
 * et le rendu du serveur ne s'accorderait plus avec celui du client.
 */
export function dateEnToutesLettres(iso: string, langue: Langue): string {
  const [annee, mois, jour] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(annee ?? 1970, (mois ?? 1) - 1, jour ?? 1));
  return new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(date);
}

/** Le jour et le mois seuls, depuis « MM-JJ ». Le Mur annonce un anniversaire,
 *  pas une date de naissance : l'année dirait l'âge à tout visiteur. */
export function jourEtMois(mmjj: string, langue: Langue): string {
  const [mois, jour] = mmjj.split("-").map(Number);
  // Une année quelconque, jamais affichée : elle ne sert qu'à composer une date
  // valide pour la mise en forme. 2000 est bissextile — un 29 février existe.
  const date = new Date(Date.UTC(2000, (mois ?? 1) - 1, jour ?? 1));
  return new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
    day: "numeric", month: "long", timeZone: "UTC",
  }).format(date);
}

/** Le nombre de jours civils entre deux dates « AAAA-MM-JJ ».
 *
 *  En UTC, sur des jours entiers : un décompte qui passerait par l'heure locale
 *  afficherait « J−3 » d'un côté de l'Atlantique et « J−2 » de l'autre pour le
 *  même anniversaire. Négatif si l'échéance est passée. */
export function joursEntre(depuis: string, jusqu: string): number {
  const jour = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${jusqu}T00:00:00Z`) - Date.parse(`${depuis}T00:00:00Z`)) / jour);
}

/* LES DATES DE LA DÉMONSTRATION, TOUJOURS À VENIR.
 *
 * La landing montre un calendrier d'exemple, et ses dates étaient écrites en
 * dur — « 21 août », « 2 sept. ». Elles disaient vrai le jour où la maquette a
 * été livrée, puis elles ont vieilli : un visiteur d'octobre voyait une
 * application qui annonce des échéances passées. Pour un produit dont tout
 * l'argument est de ne rien laisser passer, c'est le pire démenti possible.
 *
 * CE QUI NE CHANGE PAS, ET C'EST LE POINT : les écarts. La maquette a composé
 * 0, 3, 9 et 12 jours, et la phrase d'accueil s'appuie dessus — « une date
 * aujourd'hui, deux cette semaine ». Les rendre dynamiques signifie recalculer
 * le LIBELLÉ depuis aujourd'hui, jamais toucher aux écarts : la composition
 * reste celle du designer, seule sa date d'ancrage suit le calendrier.
 *
 * EN UTC, pour la raison que ce fichier donne plus haut : un jour civil est le
 * même partout, et le rendu du serveur doit s'accorder avec celui du client.
 * Le décalage possible est d'un jour pour qui lit à l'autre bout du monde dans
 * la dernière heure de sa journée — sur un calendrier d'illustration, c'est
 * sans conséquence, et c'est le prix d'un rendu stable.
 *
 * `revalidate = 300` sur la page suffit à faire tourner ces libellés : cinq
 * minutes de retard au plus, sur une valeur qui change une fois par jour. */
export function dateDeDemonstration(dansJours: number, langue: Langue, aujourdhui = new Date()): string {
  const jour = 24 * 60 * 60 * 1000;
  const cible = new Date(Date.UTC(
    aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate(),
  ) + dansJours * jour);
  return new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
    day: "numeric", month: "short", timeZone: "UTC",
  }).format(cible);
}
