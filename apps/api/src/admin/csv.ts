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

/**
 * Ce qu'un tableur prend pour une formule, et qu'il exécute à l'ouverture.
 *
 * Excel et Sheets lisent `=`, `+`, `-` et `@` en tête de cellule comme le début
 * d'un calcul — et `=HYPERLINK(...)`, `=cmd|...` ou une formule qui appelle une
 * adresse distante s'exécutent sans que personne ait cliqué. Les guillemets de
 * RFC 4180 n'y changent rien : ils protègent le découpage du fichier, pas son
 * interprétation.
 *
 * Le chemin est court et n'exige aucun compte. L'agent utilisateur d'une
 * requête n'est ni validé ni contraint : il suffit d'un `User-Agent: =…` sur
 * une tentative de connexion pour que la chaîne atterrisse dans la table, puis
 * dans le fichier qu'un administrateur ouvrira. L'adresse tentée d'un code à
 * usage unique suit le même chemin.
 */
const DEBUTS_DE_FORMULE = /^[=+\-@\t\r]/;

function cellule(valeur: string | null): string {
  if (valeur === null) return '""';

  // Une apostrophe en tête : le tableur la lit comme « ce qui suit est du
  // texte », et ne l'affiche pas. C'est la neutralisation d'usage, et elle
  // coûte un caractère visible à qui lit le fichier en clair — le prix est
  // faible devant une formule qui part toute seule.
  const sain = DEBUTS_DE_FORMULE.test(valeur) ? `'${valeur}` : valeur;

  // Un guillemet se double : c'est ainsi que RFC 4180 le veut, et tout tableur
  // le lit. Cela protège le DÉCOUPAGE ; la ligne au-dessus protège de
  // l'INTERPRÉTATION. Les deux sont nécessaires, et aucune ne remplace l'autre.
  return `"${sain.replace(/"/g, '""')}"`;
}

/** Le document entier : l'entête, puis les lignes. */
export function documentCsv(colonnes: string[], lignes: (string | null)[][]): string {
  // L'entête n'est pas cité : ce sont des identifiants que nous écrivons, sans
  // virgule ni guillemet, et un tableur les lit mieux nus.
  return [colonnes.join(","), ...lignes.map(ligneCsv)].join("\n");
}
