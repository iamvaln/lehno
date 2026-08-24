import { describe, expect, it } from "vitest";
import { themeCss } from "../lib/theme-css.js";

// Les jetons nomment les polices par leur famille : « Fraunces, Georgia,
// serif ». C'est juste pour un système de design, qui ne sait pas comment on
// les servira. Mais next/font ne publie PAS la famille sous son nom : il
// engendre un nom haché et l'expose par une variable CSS — ici --font-titre et
// --font-texte, posées sur <html> par le layout.
//
// Sans pont entre les deux, le navigateur cherche une police nommée
// « Fraunces », n'en trouve aucune, et se rabat sur Georgia. Tous les titres du
// site rendaient ainsi, sur toutes les pages, sans que rien ne le signale : ni
// le lint, ni les tests, ni le build. Seul l'œil le voit.
describe("polices", () => {
  it("fait passer la police d'affichage par la variable de next/font", () => {
    expect(themeCss).toMatch(/--font-display:\s*var\(--font-titre\)/);
  });

  it("fait passer la police de texte par la variable de next/font", () => {
    expect(themeCss).toMatch(/--font-body:\s*var\(--font-texte\)/);
  });

  // Le pont doit venir APRÈS la déclaration des jetons, sinon c'est la valeur
  // littérale qui l'emporte et rien ne change.
  it("pose le pont après les jetons, pas avant", () => {
    const jeton = themeCss.indexOf("--font-display: Fraunces");
    const pont = themeCss.indexOf("--font-display: var(--font-titre)");
    expect(jeton, "la valeur littérale des jetons doit être présente").toBeGreaterThan(-1);
    expect(pont, "le pont doit venir après").toBeGreaterThan(jeton);
  });

  // La chaîne de repli survit au pont : si la police tarde ou échoue, on veut
  // toujours une serif pour les titres, pas la police par défaut du navigateur.
  it("garde une chaîne de repli derrière chaque police", () => {
    expect(themeCss).toMatch(/--font-display:\s*var\(--font-titre\),\s*Georgia/);
    expect(themeCss).toMatch(/--font-body:\s*var\(--font-texte\),\s*system-ui/);
  });
});
