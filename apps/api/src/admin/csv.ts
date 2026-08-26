/**
 * Un fichier de valeurs séparées, écrit à la main.
 *
 * La règle qui compte est l'échappement. Un motif d'administration est du texte
 * libre — « Suspendu, puis rétabli », « Motif dit "urgent" », parfois un retour
 * à la ligne. Sans guillemets, la virgule scinde la ligne et toutes les
 * colonnes suivantes glissent d'un cran : le fichier reste lisible, il dit
 * simplement autre chose. C'est le pire des défauts, celui qui ne se voit pas.
 *
 * On cite donc **toujours**, plutôt que « seulement si nécessaire » : la règle
 * conditionnelle est celle qu'on oublie d'appliquer au champ qu'on vient
 * d'ajouter.
 */
export function ligneCsv(valeurs: (string | null)[]): string {
  return valeurs.map(cellule).join(",");
}

function cellule(valeur: string | null): string {
  if (valeur === null) return '""';
  // Un guillemet se double : c'est ainsi que RFC 4180 le veut, et tout tableur
  // le lit.
  return `"${valeur.replace(/"/g, '""')}"`;
}

/** Le document entier : l'entête, puis les lignes. */
export function documentCsv(colonnes: string[], lignes: (string | null)[][]): string {
  // L'entête n'est pas cité : ce sont des identifiants que nous écrivons, sans
  // virgule ni guillemet, et un tableur les lit mieux nus.
  return [colonnes.join(","), ...lignes.map(ligneCsv)].join("\n");
}
