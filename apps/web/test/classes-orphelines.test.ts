import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

// Un composant qui pose une classe sans définition CSS livre soit du texte
// destiné aux seuls lecteurs d'écran affiché à l'écran, soit une mise en page
// qui ne se replie plus sur mobile — une régression silencieuse tant qu'aucun
// test ne relie les deux côtés (voir le tour de correction 1 de la tâche 5).

// Classes posées par next/font (lib/fonts.ts) sur <html>, via l'expression
// `${fraunces.variable} ${karla.variable}` — jamais une chaîne littérale dans
// un className="...". Ce test ne lit que des chaînes littérales : il ne les
// verrait de toute façon pas, mais on les nomme pour ne rien exclure en
// silence. Aucun module CSS ni bibliothèque tierce de classes n'est employé
// ailleurs dans ce dossier à ce jour.
const CLASSES_TIERCES_EXCLUES = new Set<string>([]);

function listerFichiers(dossier: string, extensions: string[]): string[] {
  const resultats: string[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) resultats.push(...listerFichiers(chemin, extensions));
    else if (extensions.includes(extname(entree.name))) resultats.push(chemin);
  }
  return resultats;
}

// Seules les chaînes littérales de className="..." sont lues : une classe posée
// par une expression (voir CLASSES_TIERCES_EXCLUES ci-dessus) n'entre jamais ici.
function classesUtilisees(fichiers: string[]): Set<string> {
  const classes = new Set<string>();
  for (const fichier of fichiers) {
    const contenu = readFileSync(fichier, "utf-8");
    for (const m of contenu.matchAll(/className="([^"]*)"/g)) {
      for (const classe of m[1]!.split(/\s+/).filter(Boolean)) classes.add(classe);
    }
  }
  return classes;
}

// Ne cherche que dans le texte des sélecteurs (ce qui précède une « { »),
// jamais dans le corps d'une déclaration : une valeur comme « 0.10 » dans une
// ombre ne peut donc pas se lire comme une classe « .10 ».
function classesDefinies(fichiers: string[]): Set<string> {
  const classes = new Set<string>();
  for (const fichier of fichiers) {
    const contenu = readFileSync(fichier, "utf-8");
    for (const selecteur of contenu.matchAll(/([^{}]+)\{/g)) {
      for (const c of selecteur[1]!.matchAll(/(?<![\w])\.([a-zA-Z_][\w-]*)/g)) classes.add(c[1]!);
    }
  }
  return classes;
}

describe("classes orphelines", () => {
  it("chaque classe employée dans un composant a une définition dans base.css ou globals.css", () => {
    const racine = join(import.meta.dirname, "..");
    const composants = listerFichiers(join(racine, "components"), [".tsx"]);
    const pages = listerFichiers(join(racine, "app"), [".tsx"]);
    const feuilles = listerFichiers(join(racine, "app"), [".css"]);

    const utilisees = classesUtilisees([...composants, ...pages]);
    const definies = classesDefinies(feuilles);

    const orphelines = [...utilisees]
      .filter((c) => !definies.has(c) && !CLASSES_TIERCES_EXCLUES.has(c))
      .sort();

    expect(orphelines, `classes sans définition CSS : ${orphelines.join(", ")}`).toEqual([]);
  });
});
