import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { nomLucide } from "./Icon.styles.js";

/* LA TABLE SE LIT, ELLE NE S'IMPORTE PAS.
 *
 * `Icon.icons.ts` importe lucide-react-native, qui importe react-native, écrit
 * en Flow : ni esbuild ni Vitest ne le parsent, et le charger ici échouerait
 * avant le premier test. La table est donc examinée comme du texte — ce qui
 * suffit largement, parce que ce qu'on veut tenir est une FORME d'écriture. */
const SOURCE = readFileSync(fileURLToPath(new URL("./Icon.icons.ts", import.meta.url)), "utf8");

const IMPORTS = [...SOURCE.matchAll(/^\s{2}([A-Z][A-Za-z0-9]*),$/gm)].map((m) => m[1]!);
const ENTREES = [...SOURCE.matchAll(/^\s{2}"([a-z0-9-]+)":\s([A-Z][A-Za-z0-9]*),$/gm)]
  .map((m) => ({ nom: m[1]!, composant: m[2]! }));

describe("la table des icônes", () => {
  /* LE DÉFAUT QUI COÛTE DEUX MÉGAOCTETS. Un `import * as Lucide` rend le
     tableau trivial à écrire — et fait entrer les mille cinq cents icônes de la
     bibliothèque dans le paquet. Mesuré une fois : de 2,4 à 4,4 Mo.

     Metro n'élague pas, donc rien à l'exécution ne signalerait la faute : elle
     ne se voit qu'en pesant le paquet, ce que personne ne fait à chaque icône
     ajoutée. Le test la refuse à l'écriture. */
  it("n'importe que des icônes nommées, jamais un espace de noms", () => {
    expect(SOURCE).not.toMatch(/import\s+\*\s+as/);
    expect(SOURCE).not.toMatch(/require\(/);
    // Un seul import, et il vient du baril de la bibliothèque.
    expect(SOURCE.match(/from "lucide-react-native"/g)).toHaveLength(1);
  });

  /* Chaque nom de la charte pointe sur SON dessin. Un tableau écrit à la main
     glisse d'une ligne — « gift » sur `Heart` rendrait un cœur pour un cadeau,
     sans erreur ni avertissement. La conversion tirets → casse Pascal est la
     même que celle des écrans : elle décide, le test la vérifie. */
  it("apparie chaque nom de la charte au dessin qui porte ce nom", () => {
    expect(ENTREES.length).toBeGreaterThan(40);
    for (const { nom, composant } of ENTREES) {
      expect(composant, nom).toBe(nomLucide(nom));
    }
  });

  // Rien d'importé qui ne serve, rien de servi qui ne soit importé : un import
  // orphelin alourdit le paquet, une entrée orpheline ne compile pas.
  it("importe exactement ce que la table emploie", () => {
    expect([...IMPORTS].sort()).toEqual([...ENTREES.map((e) => e.composant)].sort());
  });

  // Les noms restent en tirets, comme sur le web : deux conventions de nommage
  // auraient fini par diverger.
  it("garde les noms de la charte en tirets minuscules", () => {
    for (const { nom } of ENTREES) expect(nom, nom).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("porte les icônes que la charte demande", () => {
    const noms = new Set(ENTREES.map((e) => e.nom));
    for (const attendu of [
      "arrow-up-right", "gift", "languages", "lock", "mail", "minus", "pin", "shield",
    ]) {
      expect(noms.has(attendu), attendu).toBe(true);
    }
  });
});
