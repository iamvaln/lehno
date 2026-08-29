import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* Sur le web, l'enveloppe Lucide cherchait l'icône par son nom dans un objet
 * global chargé depuis un CDN : le coût ne touchait pas le produit. En natif,
 * la même recherche dynamique force l'empaqueteur à embarquer la bibliothèque
 * entière — deux mégaoctets d'icônes que personne n'affiche.
 *
 * Le tableau est donc statique, et ce test le tient à jour : il relit le code
 * porté, y relève chaque icône demandée, et échoue si l'une manque au tableau.
 * Sans lui, une icône absente ne rendrait rien — Icon rend `null` plutôt que de
 * faire tomber l'écran — et le trou ne se verrait qu'à l'usage.
 */

/* `composants` et non « components » : le dossier est en français, et la faute
   passait inaperçue parce que le `try/catch` plus bas avale un dossier
   introuvable. Une source qu'on croit balayer et qui ne l'est pas est pire
   qu'une source oubliée — on la croit couverte.

   `lib` en est : les écrans ne nomment pas toutes leurs icônes en JSX, certains
   les portent en DONNÉES — la table des rangs des réglages, par exemple. */
const SOURCES = ["app", "composants", "lib", "../../packages/ui-native/src"];

function fichiers(racine: string): string[] {
  let trouves: string[] = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    const chemin = join(racine, entree.name);
    if (entree.isDirectory()) trouves = trouves.concat(fichiers(chemin));
    else if (/\.tsx?$/.test(entree.name) && !entree.name.includes(".test.")) trouves.push(chemin);
  }
  return trouves;
}

function nomsDemandes(): Set<string> {
  const noms = new Set<string>();
  for (const racine of SOURCES) {
    let liste: string[];
    try { liste = fichiers(racine); } catch { continue; }
    for (const chemin of liste) {
      const source = readFileSync(chemin, "utf-8");
      for (const [, nom] of source.matchAll(/\b(?:icon|iconAfter)="([a-z0-9-]+)"/g)) noms.add(nom!);
      for (const [, nom] of source.matchAll(/<Icon\s+name="([a-z0-9-]+)"/g)) noms.add(nom!);
      /* Les icônes portées en données — `{ cle: "profil", icone: "user", … }` —
         n'apparaissent dans aucune balise. Sans cette forme, une table entière
         de rangs échappait au contrôle, et chaque nom faux y rendait un blanc. */
      for (const [, nom] of source.matchAll(/\bicone:\s*"([a-z0-9-]+)"/g)) noms.add(nom!);
    }
  }
  return noms;
}

function nomsDuTableau(): Set<string> {
  const source = readFileSync("../../packages/ui-native/src/core/Icon.icons.ts", "utf-8");
  const bloc = source.slice(source.indexOf("export const ICONES"));
  return new Set([...bloc.matchAll(/"([a-z0-9-]+)":/g)].map(([, nom]) => nom!));
}

describe("les icônes embarquées", () => {
  // Sans ça, un chemin de source cassé rendrait le contrôle vert à vide.
  it("trouve bien des icônes à vérifier", () => {
    expect(nomsDemandes().size).toBeGreaterThan(15);
  });

  it("le tableau couvre chaque icône que le code demande", () => {
    const tableau = nomsDuTableau();
    const manquantes = [...nomsDemandes()].filter((nom) => !tableau.has(nom)).sort();
    expect(manquantes).toEqual([]);
  });

  // Un import nommé par icône, jamais un espace de noms : c'est ce qui laisse
  // l'empaqueteur écarter les mille cinq cents autres.
  it("importe les icônes nommément, sans espace de noms", () => {
    const source = readFileSync("../../packages/ui-native/src/core/Icon.icons.ts", "utf-8");
    expect(source).not.toMatch(/import \* as \w+ from "lucide-react-native"/);
    expect(source).toMatch(/import \{[^}]+\} from "lucide-react-native"/);
  });

  // Le rendu ne doit plus atteindre la bibliothèque autrement que par ce
  // tableau : un seul détour dynamique suffirait à tout réembarquer.
  it("le composant ne cherche plus dans la bibliothèque entière", () => {
    const source = readFileSync("../../packages/ui-native/src/core/Icon.tsx", "utf-8");
    expect(source).not.toMatch(/import \* as/);
  });
});
