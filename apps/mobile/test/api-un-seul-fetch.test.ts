import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* UN SEUL POINT D'APPEL RÉSEAU, ET LA GARDE EXISTE POUR ÇA.
 *
 * Les six en-têtes de client — qui dit à quel build le serveur parle — se posent
 * dans `envoie()` de `lib/api.ts`. Ils n'y sont fiables que tant que ce `fetch`
 * est le seul du paquet : un second point d'appel écrit dans six mois partirait
 * sans eux, le journal serait incomplet, et **rien ne tomberait**.
 *
 * C'est le défaut que la spec met en tête de ce qu'il faut éprouver, et il ne
 * s'attrape pas par un test d'unité : il s'attrape en lisant la source.
 *
 * CE QU'ELLE NE VOIT PAS, et qu'il faut savoir : un appel réseau posé par une
 * dépendance, ou par un `XMLHttpRequest`. Elle garde le chemin que nous
 * écrivons, pas celui qu'une bibliothèque emprunte.
 */
const RACINE = new URL("../", import.meta.url);

/* CE QUI N'APPELLE PAS NOTRE API, et qui ne doit donc PAS porter nos en-têtes.
 *
 * Écrite à la main, avec sa raison — c'est le produit de cette table, pas la
 * ligne. Un `fetch` neuf qui n'y figure pas fait tomber la garde, et c'est le
 * but : il doit être DÉCIDÉ, pas glissé.
 *
 * La seconde entrée est la plus importante des deux : l'URL signée pointe sur
 * le stockage d'un TIERS. Y joindre `x-client-key` enverrait nos identifiants
 * de build à quelqu'un qui n'a rien à en faire — c'est le seul endroit du
 * paquet où ajouter un en-tête serait une fuite, pas un oubli.
 */
const DISPENSES: Readonly<Record<string, string>> = {
  "lib/photo-de-profil.ts": "lit un fichier local, puis monte sur une URL signée d'un tiers",
  "polices/cuire.ts": "script de construction — tourne sur la machine, jamais dans l'application",
};

/** Tous les `.ts`/`.tsx` du paquet, hors tests et hors dossiers engendrés. */
function sources(dossier: URL = RACINE, prefixe = ""): readonly { nom: string; texte: string }[] {
  const IGNORE = new Set(["node_modules", "test", ".expo", "android", "ios"]);
  const trouves: { nom: string; texte: string }[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (IGNORE.has(entree.name) || entree.name.startsWith(".")) continue;
    if (entree.isDirectory()) {
      trouves.push(...sources(new URL(`${entree.name}/`, dossier), `${prefixe}${entree.name}/`));
    } else if (entree.name.endsWith(".ts") || entree.name.endsWith(".tsx")) {
      trouves.push({
        nom: `${prefixe}${entree.name}`,
        texte: readFileSync(new URL(entree.name, dossier), "utf8"),
      });
    }
  }
  return trouves;
}

/* `fetch(` suivi d'une parenthèse : on cherche l'APPEL, pas le mot. Une mention
   en commentaire ou un type `typeof fetch` ne doit pas faire tomber la garde. */
const APPELLE = /(?<![.\w])fetch\s*\(/;

describe("le paquet n'a qu'un seul point d'appel réseau", () => {
  it("et c'est `envoie()` de lib/api.ts", () => {
    const coupables = sources()
      .filter((s) => APPELLE.test(s.texte))
      .map((s) => s.nom)
      .filter((nom) => !(nom in DISPENSES));
    expect(coupables).toEqual(["lib/api.ts"]);
  });

  /* ET L'INVERSE : une dispense qui désigne un fichier n'appelant plus rien ne
     fait rien tomber — le balayage va des fichiers vers la table, jamais dans
     l'autre sens — mais elle MENT, et une table à la main ne vaut que ce que
     valent ses raisons. */
  it("aucune dispense ne survit au fichier qu'elle décrit", () => {
    const vues = new Set(sources().filter((s) => APPELLE.test(s.texte)).map((s) => s.nom));
    expect(Object.keys(DISPENSES).filter((nom) => !vues.has(nom))).toEqual([]);
  });

  /* LA SONDE. Une garde qui lit la source doit prouver qu'elle mord — sur un
     appel ET pas sur une simple mention. */
  it("distingue un appel d'une mention", () => {
    expect(APPELLE.test("const r = await fetch(url);")).toBe(true);
    expect(APPELLE.test("/* on passe par `fetch` une seule fois */")).toBe(false);
    expect(APPELLE.test("type Envoyeur = typeof fetch;")).toBe(false);
  });
});
