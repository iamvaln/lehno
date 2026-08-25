// Preuve d'intégration : les tests unitaires de adherence.test.js vérifient la
// règle isolée, avec le Linter nu et du code inventé. Ils ne prouvent pas que
// la chaîne complète — la vraie configuration racine, le parseur TypeScript,
// le périmètre de fichiers, la liste d'exclusion — se comporte comme prévu
// sur du vrai code. Ici, on lance le vrai ESLint (classe ESLint, pas Linter)
// avec la vraie configuration du dépôt (eslint.config.js à la racine).
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ICI, "..", "..");
const DOSSIER_UI = join(RACINE, "apps/web/components/ui");
const FICHIER_PREUVE = join(DOSSIER_UI, "_preuve-integration-adherence.tsx");

// Les quatre angles morts d'origine, réunis dans un seul composant : rayon
// numérique (B), variable non émise (A), couleur en dur dans un attribut JSX
// (C), couleur en dur sous forme rgb()/nommée (D).
const CODE_AVEC_LES_QUATRE_INFRACTIONS = `
import type { ReactNode } from "react";

export function PreuveIntegration(): ReactNode {
  return (
    <div style={{ borderRadius: 14, color: "rgb(122, 74, 34)" }}>
      <span style={{ background: "var(--violet)" }}>x</span>
      <svg><path fill="#012169" /></svg>
    </div>
  );
}
`;

describe("preuve d'intégration : ESLint réel sur apps/web/components/ui/", () => {
  const dossierExistaitDeja = existsSync(DOSSIER_UI);

  beforeAll(() => {
    mkdirSync(DOSSIER_UI, { recursive: true });
    writeFileSync(FICHIER_PREUVE, CODE_AVEC_LES_QUATRE_INFRACTIONS, "utf8");
  });

  afterAll(() => {
    rmSync(FICHIER_PREUVE, { force: true });
    if (!dossierExistaitDeja) rmSync(DOSSIER_UI, { recursive: true, force: true });
  });

  it("attrape les quatre infractions dans un fichier temporaire sous components/ui/", async () => {
    const eslint = new ESLint({ cwd: RACINE });
    const [resultat] = await eslint.lintFiles([FICHIER_PREUVE]);
    const messages = resultat.messages.filter((m) => m.ruleId === "lehno/jetons-seulement");

    expect(messages.length).toBeGreaterThanOrEqual(4);
    expect(messages.some((m) => /rayon/i.test(m.message))).toBe(true);
    expect(messages.some((m) => /--violet\b/.test(m.message) && /pas émise/i.test(m.message))).toBe(true);
    expect(messages.some((m) => /couleur écrite en dur/i.test(m.message))).toBe(true);
    // Deux infractions distinctes de couleur en dur : le rgb() du style et le
    // fill hexadécimal du SVG. Au moins deux messages « couleur » attendus.
    expect(messages.filter((m) => /couleur écrite en dur/i.test(m.message)).length).toBeGreaterThanOrEqual(2);
    // 30 s, pas les 5 s par défaut : ce cas lance le VRAI ESLint sur le dépôt,
    // et sous la charge de la suite complète du monorepo il dépassait le délai.
    // Un échec par délai dépassé sur une règle d'adhérence finit toujours de la
    // même façon — quelqu'un marque le test instable et le neutralise, et la
    // règle cesse de garder quoi que ce soit sans que rien ne rougisse.
  }, 30_000);

  it("couvre bien apps/web/components/ui/ (les nouveaux composants dès le premier jour)", async () => {
    const eslint = new ESLint({ cwd: RACINE });
    const resultats = await eslint.lintFiles([DOSSIER_UI]);
    const fichierPreuve = resultats.find((r) => r.filePath === FICHIER_PREUVE);

    expect(fichierPreuve).toBeDefined();
    expect(fichierPreuve.messages.some((m) => m.ruleId === "lehno/jetons-seulement")).toBe(true);
    // Même raison qu'au-dessus : vrai ESLint, vrai dossier.
  }, 30_000);
});

describe("périmètre de la règle d'adhérence", () => {
  // Ce test exigeait autrefois une liste d'exclusion non vide : les quinze
  // composants d'avant le socle de design y figuraient, le temps qu'ils soient
  // réécrits. Ils l'ont été, la liste a disparu, et le test est devenu faux.
  //
  // Il garde maintenant l'invariant inverse, celui qui compte désormais :
  // AUCUNE exclusion. Une exclusion rajoutée en douce est le moyen le plus
  // simple de faire taire cette règle sans qu'aucune chaîne ne rougisse.
  it("couvre apps/web sans aucune exclusion", async () => {
    const configRacine = (await import("../../eslint.config.js")).default;
    const blocAdherence = configRacine.find(
      (bloc) => bloc.rules && Object.prototype.hasOwnProperty.call(bloc.rules, "lehno/jetons-seulement"),
    );

    expect(blocAdherence).toBeDefined();
    expect(blocAdherence.files, "la règle doit viser apps/web").toBeDefined();

    const exclusions = blocAdherence.ignores ?? [];
    expect(
      exclusions,
      `exclusions trouvées : ${exclusions.join(", ")} — si elles sont voulues, dites ici pourquoi et ce qui les lèvera`,
    ).toEqual([]);
  });
});
