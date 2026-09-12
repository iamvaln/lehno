import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { icons } from "lucide-react";
import { describe, expect, it } from "vitest";

/* GARDE CONTRE UNE ICÔNE QUI N'EXISTE PAS.
 *
 * `Icon` retombe sur un CADRE VIDE quand le nom ne résout pas — un choix
 * délibéré : un composant qui casse le rendu emporterait tout l'écran pour un
 * dessin manquant. Le prix, c'est que la faute est parfaitement silencieuse.
 *
 * Elle a coûté cher une fois. `more-horizontal` a été renommé `ellipsis` par
 * Lucide ; le bouton du menu d'actions gardait sa taille, son étiquette et son
 * clic, et ne dessinait plus rien. Le menu de TOUS les tableaux de l'outil est
 * ainsi devenu invisible — onze écrans —, et l'outil paraissait en lecture
 * seule à qui avait tous les droits. Ni les suites (qui interrogent le DOM par
 * son étiquette, laquelle n'a pas bougé), ni `tsc` (`name` est une chaîne), ni
 * le lint ne pouvaient le voir.
 *
 * Cette épreuve lit les noms écrits dans les sources et les compare au
 * catalogue réellement embarqué. Elle tombera au prochain renommage de la
 * bibliothèque, à la mise à jour — c'est-à-dire au moment où quelqu'un peut
 * encore faire le lien entre la cause et l'effet.
 */

/* `fileURLToPath`, et pas `.pathname` : sous jsdom, `import.meta.url` n'est
   pas toujours une URL `file:`, et `.pathname` rendait « /src ». */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return chemin.endsWith(".tsx") || chemin.endsWith(".ts") ? [chemin] : [];
  });
}

/** Le même passage en PascalCase que fait `Icon` — recopié, donc, et à dessein :
 *  l'importer d'`Icon.tsx` ferait passer l'épreuve avec une conversion fausse. */
function versPascal(nom: string): string {
  return nom.replace(/(^|-)([a-z0-9])/g, (_, __, lettre: string) => lettre.toUpperCase());
}

/* On ne lit que ce qui est écrit EN CLAIR. Un nom calculé (`name={x}`) échappe
   à cette lecture, et c'est assumé : la garde vise le cas courant, pas
   l'exhaustivité qu'aucune analyse statique simple ne donnerait. */
const ECRITS = /<Icon\b[^>]*?\bname="([a-z0-9-]+)"/g;

describe("les icônes employées existent vraiment", () => {
  const employes = new Map<string, string[]>();
  for (const fichier of sources(RACINE)) {
    const contenu = readFileSync(fichier, "utf8");
    for (const trouve of contenu.matchAll(ECRITS)) {
      /* Le groupe capturant est garanti par l'expression, mais TypeScript ne
         le sait pas : `matchAll` rend `string | undefined`. On saute plutôt
         que d'affirmer — une assertion ici masquerait un jour un changement
         d'expression. */
      const nom = trouve[1];
      if (nom === undefined) continue;
      employes.set(nom, [...(employes.get(nom) ?? []), fichier.slice(RACINE.length + 1)]);
    }
  }

  it("en trouve dans les sources — sinon l'épreuve ne prouverait rien", () => {
    expect(employes.size).toBeGreaterThan(5);
  });

  it("résout chaque nom dans le catalogue embarqué", () => {
    const introuvables = [...employes.entries()]
      .filter(([nom]) => !Object.prototype.hasOwnProperty.call(icons, versPascal(nom)))
      .map(([nom, fichiers]) => `${nom} (${[...new Set(fichiers)].join(", ")})`);

    expect(
      introuvables,
      "ces noms ne dessinent rien : Icon rend un cadre vide, sans erreur",
    ).toEqual([]);
  });
});
