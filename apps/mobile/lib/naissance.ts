import { AGE_MAXIMAL_ANNEES } from "@lehno/contracts";

/* La date de naissance d'un proche — §3.18.
 *
 * ELLE VIT SUR LA PERSONNE, une seule fois. L'anniversaire s'en DÉDUIT : le
 * formulaire d'événement ne la redemande pas, et le contrat interdit d'y poser
 * une date pour un anniversaire.
 *
 * ET C'EST DE LA NAISSANCE QU'ON IGNORE L'ANNÉE, jamais de l'anniversaire. On
 * fête quelqu'un sans savoir son âge ; on ne fête personne sans savoir quel
 * jour.
 */

/* L'ANNÉE DE SUPPORT, quand on ne la connaît pas.
 *
 * Le contrat garde `birthDate` en date complète et laisse `birthYearKnown`
 * dire ce qu'on en sait — « l'année stockée n'est qu'un support ». Il faut donc
 * en choisir une, et le choix n'est pas indifférent : une année NON BISSEXTILE
 * rendrait le 29 février impossible à saisir, et personne né ce jour-là ne
 * pourrait entrer sa date.
 *
 * 2000 est bissextile, et assez neutre pour qu'on ne la lise pas comme un âge.
 */
export const ANNEE_DE_SUPPORT = 2000;

export interface Naissance {
  jour: number;
  mois: number;
  annee: number | null;
}

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

/* La date civile à envoyer. Toujours complète — c'est `birthYearKnown` qui
   porte l'ignorance, pas une date tronquée que le serveur ne saurait pas lire. */
export function dateDeNaissance({ jour, mois, annee }: Naissance): string {
  return `${annee ?? ANNEE_DE_SUPPORT}-${deuxChiffres(mois)}-${deuxChiffres(jour)}`;
}

/* Combien de jours porte un mois — pour que le choix du jour ne propose pas
   un 31 février. L'année compte : février en a 29 une fois sur quatre, et
   l'année de support est bissextile précisément pour ne pas fermer ce jour. */
export function joursDuMois(mois: number, annee: number | null): number {
  return new Date(Date.UTC(annee ?? ANNEE_DE_SUPPORT, mois, 0)).getUTCDate();
}

/* Le jour se BORNE quand le mois change, il ne disparaît pas.
 *
 * Quelqu'un qui a posé le 31 puis choisit février doit se retrouver au 28 ou
 * au 29 — pas devant un champ vide qu'il faut remplir à nouveau, ni devant une
 * date que le serveur refusera. */
export function bornerLeJour(jour: number, mois: number, annee: number | null): number {
  return Math.min(jour, joursDuMois(mois, annee));
}

export type RefusDeNaissance = "futur" | "trop_ancienne" | null;

/* Ce que le serveur refusera, dit AVANT l'envoi.
 *
 * Les mêmes deux bornes que `bornerLaNaissance` du contrat, et pour la même
 * raison : cent ans en arrière au plus — une date plus ancienne est une faute
 * de frappe, un 1825 pour 1925, et l'accepter ferait paraître un proche de deux
 * siècles sur une fiche.
 *
 * ANNÉE INCONNUE : AUCUNE BORNE. Seuls le jour et le mois comptent alors, et
 * l'année de support n'a pas à passer un examen qui n'a pas de sens pour elle.
 * Le contrat le dit de la même façon.
 */
export function refuseLaNaissance(
  { annee, mois, jour }: Naissance, aujourdhui: string,
): RefusDeNaissance {
  if (annee === null) return null;
  const civile = dateDeNaissance({ jour, mois, annee });
  if (civile > aujourdhui) return "futur";
  const limite = `${Number(aujourdhui.slice(0, 4)) - AGE_MAXIMAL_ANNEES}${aujourdhui.slice(4)}`;
  return civile < limite ? "trop_ancienne" : null;
}
