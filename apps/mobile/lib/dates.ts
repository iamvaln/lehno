import type { Occurrence } from "@lehno/contracts";

/* Vos dates — §3.14.
 *
 * DEUX VUES DU MÊME CONTENU, et ce n'est pas une redondance. La LISTE répond
 * « qu'est-ce qui m'attend » : elle se lit du plus proche au plus loin, et le
 * décompte y est la valeur qu'on cherche. Le CALENDRIER répond « comment mon
 * mois est rempli » : c'est la densité qu'on y lit, pas le détail. Une même
 * personne revient ici pour deux raisons différentes.
 *
 * CE QUI EXISTE NE SE MASQUE JAMAIS. Le kit filtre l'agenda sur `events.other`
 * — « une nature éteinte n'a jamais pu être posée ». C'est vrai d'un
 * déploiement neuf, et faux partout ailleurs : le contrat l'écrit sur le
 * chemin même, « le drapeau garde la CRÉATION, jamais l'existant. Un événement
 * libre créé avant l'extinction reste lisible, modifiable, et ses échéances
 * continuent de tomber. NE LE MASQUEZ PAS. »
 *
 * Rien ici ne consulte donc un drapeau. Faire disparaître les dates de
 * quelqu'un parce qu'on a éteint un interrupteur serait le pire défaut
 * possible dans un produit dont c'est la seule promesse.
 */

/* La fenêtre que l'écran demande. Un mois en arrière, parce que `daysUntil` est
   signé et que la vue montre le mois écoulé — on revient voir ce qu'on a
   manqué, et une liste qui commencerait à aujourd'hui l'effacerait. */
export const MOIS_EN_ARRIERE = 1;
export const MOIS_EN_AVANT = 12;

export function fenetreDesDates(aujourdhui: string): { from: string; to: string } {
  return {
    from: decaleDeMois(aujourdhui, -MOIS_EN_ARRIERE),
    to: decaleDeMois(aujourdhui, MOIS_EN_AVANT),
  };
}

/* Les dates civiles s'écrivent « YYYY-MM-DD » et se comparent en chaînes. On
   décale par le calendrier, jamais par un nombre de jours : « dans un mois »
   n'est pas « dans trente jours », et le 31 janvier plus un mois n'existe pas. */
export function decaleDeMois(civile: string, mois: number): string {
  const [a, m, j] = civile.split("-").map(Number);
  const cible = new Date(Date.UTC(a ?? 0, (m ?? 1) - 1 + mois, 1));
  // Le dernier jour du mois d'arrivée, quand le jour d'origine n'y existe pas.
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j ?? 1, dernier));
  return cible.toISOString().slice(0, 10);
}

export interface BlocDeMois {
  /* « YYYY-MM » — la clé du mois, pas son nom : le nom se met en forme dans la
     langue de lecture, et deux vues qui le composeraient chacune finiraient par
     ne pas l'écrire pareil. */
  mois: string;
  echeances: Occurrence[];
}

/* La liste, groupée par mois, dans l'ordre où elles viennent.
 *
 * Le serveur trie déjà : on ne retrie pas ici. Un tri côté client sur une liste
 * plafonnée mettrait en tête le plus proche DE LA PAGE, pas du calendrier. */
export function parMois(echeances: readonly Occurrence[]): BlocDeMois[] {
  const blocs: BlocDeMois[] = [];
  for (const e of echeances) {
    const mois = e.occurrenceDate.slice(0, 7);
    const dernier = blocs[blocs.length - 1];
    if (dernier?.mois === mois) dernier.echeances.push(e);
    else blocs.push({ mois, echeances: [e] });
  }
  return blocs;
}

/* La grille d'un mois, en semaines qui commencent LUNDI.
 *
 * Elle se calcule, elle ne s'écrit pas : le kit l'avait figée sur août 2026, et
 * une grille écrite ne suit pas le mois qu'on navigue. `null` marque les cases
 * d'avant le premier et d'après le dernier — la grille garde sa forme, et une
 * case vide n'est pas le jour 0.
 */
export const JOURS_PAR_SEMAINE = 7;

export function grilleDuMois(mois: string): (number | null)[] {
  const [a, m] = mois.split("-").map(Number);
  const premier = new Date(Date.UTC(a ?? 0, (m ?? 1) - 1, 1));
  // `getUTCDay()` compte à partir de dimanche ; la semaine commence lundi ici.
  const decalage = (premier.getUTCDay() + 6) % JOURS_PAR_SEMAINE;
  const jours = new Date(Date.UTC(a ?? 0, m ?? 1, 0)).getUTCDate();

  const cases: (number | null)[] = Array.from({ length: decalage }, () => null);
  for (let j = 1; j <= jours; j++) cases.push(j);
  // On complète la dernière semaine : une grille tronquée décale la colonne
  // du samedi d'un mois à l'autre, et l'œil y lit une densité qui n'est pas là.
  while (cases.length % JOURS_PAR_SEMAINE !== 0) cases.push(null);
  return cases;
}

/* Ce que porte chaque jour d'un mois. Plusieurs échéances peuvent tomber le
   même jour — la pastille en compte, elle n'en montre pas qu'une. */
export function echeancesParJour(
  echeances: readonly Occurrence[], mois: string,
): Map<number, Occurrence[]> {
  const carte = new Map<number, Occurrence[]>();
  for (const e of echeances) {
    if (!e.occurrenceDate.startsWith(mois)) continue;
    const jour = Number(e.occurrenceDate.slice(8, 10));
    const deja = carte.get(jour);
    if (deja) deja.push(e);
    else carte.set(jour, [e]);
  }
  return carte;
}
