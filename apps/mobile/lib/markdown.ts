/* Rendre un document légal sans embarquer un moteur Markdown.
 *
 * Les trois documents servis sont du Markdown simple : des titres, des
 * paragraphes, des listes, un peu de gras. Embarquer une bibliothèque pour ça
 * ajouterait des dizaines de milliers de lignes au paquet — et surtout leurs
 * surprises — pour trois écrans qu'on ouvre rarement.
 *
 * Ce qu'on ne sait pas rendre, on le rend en TEXTE : un tableau ou un lien
 * s'affichera avec sa syntaxe plutôt que de disparaître. Un document légal
 * incomplet serait pire qu'un document un peu brut.
 */

export type Bloc =
  | { sorte: "titre"; rang: 1 | 2 | 3; texte: string }
  | { sorte: "point"; texte: string }
  | { sorte: "paragraphe"; texte: string };

/* Le gras et l'italique sont RETIRÉS, pas rendus : les marques d'emphase au
   milieu d'une phrase demanderaient de découper le texte en fragments stylés,
   et une phrase juridique coupée se relit mal. Le sens est dans les mots. */
function sansEmphase(ligne: string): string {
  return ligne
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "$1")
    .replace(/(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])/g, "$1")
    .trim();
}

export function blocsDeMarkdown(texte: string): Bloc[] {
  const blocs: Bloc[] = [];
  for (const brute of texte.split("\n")) {
    const ligne = brute.trim();
    // Une ligne vide sépare, elle ne se rend pas : l'espacement vient des
    // marges, pas de paragraphes vides qui trouent la page.
    if (ligne === "") continue;

    const titre = /^(#{1,3})\s+(.*)$/.exec(ligne);
    if (titre) {
      blocs.push({
        sorte: "titre",
        rang: titre[1]!.length as 1 | 2 | 3,
        texte: sansEmphase(titre[2]!),
      });
      continue;
    }

    const point = /^[-*+]\s+(.*)$/.exec(ligne);
    if (point) {
      blocs.push({ sorte: "point", texte: sansEmphase(point[1]!) });
      continue;
    }

    blocs.push({ sorte: "paragraphe", texte: sansEmphase(ligne) });
  }
  return blocs;
}
