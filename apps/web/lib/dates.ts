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
