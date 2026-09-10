import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TOUTE ROUTE CLIENTE FIGURE AU CONTRAT PUBLIÉ.
 *
 * Le test « le fichier versionné n'est pas périmé » compare l'engendré au
 * versionné. Il attrape un oubli de RÉGÉNÉRATION — jamais un oubli de
 * DÉCLARATION : une route absente de `openapi.ts` est absente des deux côtés,
 * donc les deux concordent, donc il est vert.
 *
 * Dix-huit routes en ont profité, dont toute la surface des médias et les deux
 * gestes des idées. Le mobile lit ce contrat : ce qui n'y figure pas n'existe
 * pas pour lui.
 *
 * L'ADMINISTRATION EST HORS PÉRIMÈTRE, à dessein. Le contrat sert les clients —
 * mobile et pages publiques ; le back-office se développe contre le code, dans
 * le même dépôt. Zéro chemin `/admin` y figure, et ce cas ne les réclame pas.
 */
describe("le contrat publié", () => {
  const RACINE = join(import.meta.dirname, "..", "src");

  const fichiers = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((e) => {
      const chemin = join(dossier, e);
      if (statSync(chemin).isDirectory()) return fichiers(chemin);
      return chemin.endsWith(".controller.ts") ? [chemin] : [];
    });

  /* Les routes lues DANS LES CONTRÔLEURS, pas dans une liste tenue à la main :
     une liste se met à jour par discipline, et c'est la discipline qui a
     manqué. */
  const routesReelles = (): string[] => {
    const trouvees: string[] = [];
    for (const f of fichiers(RACINE)) {
      const source = readFileSync(f, "utf8");
      for (const bloc of source.matchAll(/@Controller\("([^"]*)"\)(.*?)(?=@Controller\("|$)/gs)) {
        const base = bloc[1]!;
        for (const v of bloc[2]!.matchAll(/@(Get|Post|Patch|Put|Delete)\((?:"([^"]*)")?\)/g)) {
          const chemin = "/" + [base, v[2] ?? ""].filter(Boolean).join("/");
          trouvees.push(`${v[1]!.toUpperCase()} ${chemin.replace(/:(\w+)/g, "{$1}")}`);
        }
      }
    }
    return trouvees;
  };

  it("déclare toutes les routes clientes", () => {
    const spec = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "..", "..", "docs", "api", "openapi.json"), "utf8"),
    ) as { paths: Record<string, Record<string, unknown>> };

    const publiees = new Set(
      Object.entries(spec.paths).flatMap(([c, ops]) =>
        Object.keys(ops).map((m) => `${m.toUpperCase()} ${c}`)),
    );

    const absentes = routesReelles()
      .filter((r) => !r.includes("/admin"))
      .filter((r) => !publiees.has(r))
      .sort();

    /* Le message porte la LISTE, pas un compte. Un « 3 routes manquent » ferait
       relancer la comparaison à la main ; ici l'échec dit lesquelles. */
    expect(absentes, `routes clientes absentes du contrat :\n  ${absentes.join("\n  ")}`)
      .toEqual([]);
  });
});
