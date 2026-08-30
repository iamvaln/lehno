import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { cssTokens, cssVariables } from "@lehno/tokens";

/* Une variable CSS inventée ne casse rien : elle rend la déclaration INVALIDE,
 * et le navigateur la jette en silence.
 *
 * `gap: var(--space-22)` — un palier qui n'existe pas dans l'échelle — vaut donc
 * `gap: 0`. Le 30/08/2026, trois paliers inventés (18, 22, 30) ont aplati
 * l'espacement de quatre surfaces publiques : les champs d'un formulaire se
 * touchaient, un titre chevauchait l'avatar sous lui. Toutes les suites étaient
 * vertes, et le défaut ne s'est vu qu'en REGARDANT une capture.
 *
 * C'est le pendant de `classes-orphelines.test.ts` : la classe absente ne rend
 * rien, la variable absente rend n'importe quoi.
 */

function listerFichiers(dossier: string, extensions: string[]): string[] {
  const resultats: string[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) resultats.push(...listerFichiers(chemin, extensions));
    else if (extensions.includes(extname(entree.name))) resultats.push(chemin);
  }
  return resultats;
}

function nomsDeclares(source: string): string[] {
  return [...source.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]!);
}

describe("variables CSS inventées", () => {
  it("chaque var(--…) employée dans un composant a une définition", () => {
    /* Les trois sources, dans l'ordre où le navigateur les voit : les jetons du
       système de design, les couleurs des deux thèmes, et ce que la feuille de
       l'application pose elle-même. */
    const definies = new Set<string>([
      ...nomsDeclares(cssTokens()),
      ...nomsDeclares(cssVariables("light")),
      ...nomsDeclares(cssVariables("dark")),
      ...["app/base.css", "app/composants.css", "app/globals.css"]
        .flatMap((f) => nomsDeclares(readFileSync(f, "utf-8"))),
    ]);

    const employees = new Map<string, Set<string>>();
    for (const fichier of [
      ...listerFichiers("components", [".ts", ".tsx"]),
      ...listerFichiers("app", [".ts", ".tsx"]),
    ]) {
      const contenu = readFileSync(fichier, "utf-8");
      for (const m of contenu.matchAll(/var\(--([a-z0-9-]+)\)/g)) {
        if (definies.has(m[1]!)) continue;
        if (!employees.has(m[1]!)) employees.set(m[1]!, new Set());
        employees.get(m[1]!)!.add(fichier);
      }
    }

    const orphelines = [...employees].map(([nom, ou]) => `--${nom} (${[...ou].join(", ")})`);
    expect(orphelines, `variables sans définition : ${orphelines.join(" · ")}`).toEqual([]);
  });
});
