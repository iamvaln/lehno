import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* « RIEN SOUS CE NOM » NE SE DIT JAMAIS SANS OFFRIR DE SORTIE.
 *
 * Trois écrans cherchent un proche dans le carnet. Sur un carnet vide — le cas
 * du PREMIER LANCEMENT, précisément — deux d'entre eux affichaient cette phrase
 * en texte nu : la feuille demandait POUR QUI et n'offrait aucun moyen de
 * répondre. Le seul qui s'en sortait était l'écran de recherche du carnet, qui
 * proposait « Ajouter ce proche ».
 *
 * C'EST LE FLUX VOULU QUI EST EN JEU, pas une commodité : la date est l'acte
 * concret, et c'est son parcours qui doit amener le proche. Une feuille de date
 * sans issue casse ce parcours au premier écran de l'application.
 *
 * La garde balaie la source : le quatrième sélecteur sera écrit par quelqu'un
 * qui n'aura pas lu ce fichier.
 */

const fichiers = (racine: string): string[] =>
  readdirSync(racine, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(racine, e.name);
    if (e.isDirectory()) return fichiers(chemin);
    return /\.tsx$/.test(e.name) ? [chemin] : [];
  });

// Un écran qui annonce qu'aucun proche ne correspond.
const annonceLeVide = (texte: string): boolean => /t\.videRechercheTitre/.test(texte);
// Il offre d'en créer un, et mène là où on les crée.
const offreUneIssue = (texte: string): boolean =>
  /t\.ajouterCeProche/.test(texte) && /proches\/identite/.test(texte);

describe("les sélecteurs de proche", () => {
  const sources = fichiers("app").map((chemin) => ({
    chemin, texte: readFileSync(chemin, "utf8"),
  }));
  const annoncent = sources.filter((s) => annonceLeVide(s.texte));

  // Sans ça, une expression rationnelle cassée rendrait tout vert à vide.
  it("trouve bien les écrans qui cherchent un proche", () => {
    expect(annoncent.length).toBeGreaterThan(2);
  });

  it("offrent tous d'en créer un quand le carnet ne répond pas", () => {
    for (const { chemin, texte } of annoncent) {
      expect(
        offreUneIssue(texte),
        `${chemin} dit « rien sous ce nom » sans offrir d'en créer un : sur un carnet vide, la question reste sans réponse possible`,
      ).toBe(true);
    }
  });
});
