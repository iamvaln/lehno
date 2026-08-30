import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* LA GARDE QUI MANQUAIT.
 *
 * `Illustration` prend un `name: string` — libre, parce que le jeu vit dans une
 * table et non dans un type. Le composant rend `null` sur un nom inconnu, « pour
 * ne pas faire tomber l'écran » : c'est la bonne décision au rendu, et c'est
 * exactement ce qui rend la faute de frappe invisible. L'écran s'affiche, avec
 * un trou, et personne ne le voit avant de l'ouvrir.
 *
 * J'ai écrit `compte-ferme`, qui n'existe pas. Rien ne me l'a dit.
 *
 * On lit la table À LA SOURCE plutôt que de l'importer : `@lehno/ui-native`
 * tire `react-native`, typé Flow, que ni esbuild ni Vitest ne savent lire —
 * c'est la contrainte qui gouverne tout le portage. Lire le fichier contourne
 * l'import sans rien recopier.
 */
const TABLE = "../../packages/ui-native/src/brand/Illustration.data.ts";

const disponibles = (): string[] =>
  [...readFileSync(TABLE, "utf8").matchAll(/^\s{2}"([a-z-]+)":/gm)].map((m) => m[1]!);

const fichiers = (racine: string): string[] =>
  readdirSync(racine, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(racine, e.name);
    if (e.isDirectory()) return fichiers(chemin);
    return e.name.endsWith(".tsx") ? [chemin] : [];
  });

const employes = (): { fichier: string; nom: string }[] =>
  fichiers("app").flatMap((fichier) =>
    [...readFileSync(fichier, "utf8").matchAll(/<Illustration[^>]*\bname="([a-z-]+)"/g)]
      .map((m) => ({ fichier, nom: m[1]! })));

describe("les illustrations employées existent", () => {
  // Sans ces deux-là, une expression rationnelle cassée rendrait tout vert à vide.
  it("lit bien la table", () => {
    expect(disponibles().length).toBeGreaterThan(10);
  });

  it("trouve bien des emplois", () => {
    expect(employes().length).toBeGreaterThan(2);
  });

  it("chaque nom employé est dans le jeu porté", () => {
    const jeu = disponibles();
    for (const { fichier, nom } of employes()) {
      expect(jeu, `${fichier} demande « ${nom} »`).toContain(nom);
    }
  });
});
