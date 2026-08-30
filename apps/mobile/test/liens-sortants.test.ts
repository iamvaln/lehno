import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* AUCUN LIEN SORTANT NE PART D'UN PARAMÈTRE DE ROUTE.
 *
 * Les routes d'expo-router s'atteignent par LIEN PROFOND. Un paramètre de
 * navigation est donc une entrée non fiable, au même titre qu'un corps de
 * requête : `…/apercu?url=<ce qu'on veut>` ferait ouvrir cette adresse par
 * l'application, hameçonnage compris.
 *
 * J'ai écrit exactement cette faille, et une revue l'a trouvée — pas moi. Ce
 * test la refuse désormais : une adresse ouverte vers l'extérieur vient du
 * SERVEUR ou de la configuration déclarée, jamais de la navigation.
 */
const fichiers = (racine: string): string[] =>
  readdirSync(racine, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(racine, e.name);
    if (e.isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(e.name) ? [chemin] : [];
  });

/* Ce qu'un fichier tire de `useLocalSearchParams` — les noms déstructurés. On
   lit la SOURCE plutôt qu'une liste tenue à la main : une liste finirait par ne
   plus décrire le code. */
function parametresDeRoute(source: string): string[] {
  const noms: string[] = [];
  for (const m of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*useLocalSearchParams/g)) {
    for (const brut of m[1]!.split(",")) {
      const nom = brut.split(":")[0]!.trim();
      if (nom) noms.push(nom);
    }
  }
  return noms;
}

function ouvertures(source: string): string[] {
  return [...source.matchAll(/Linking\.openURL\(\s*([A-Za-z_$][\w$]*)\s*\)/g)]
    .map((m) => m[1]!);
}

describe("les liens sortants", () => {
  const sources = fichiers("app").map((chemin) => ({
    chemin, texte: readFileSync(chemin, "utf8"),
  }));

  // Sans ça, une expression rationnelle cassée rendrait le test vert à vide.
  it("trouve bien des ouvertures à vérifier", () => {
    expect(sources.flatMap((s) => ouvertures(s.texte)).length).toBeGreaterThan(2);
  });

  it("n'ouvre jamais une adresse venue d'un paramètre de route", () => {
    for (const { chemin, texte } of sources) {
      const params = new Set(parametresDeRoute(texte));
      for (const nom of ouvertures(texte)) {
        expect(params, `${chemin} ouvre « ${nom} », qui vient de la navigation`)
          .not.toContain(nom);
      }
    }
  });
});
