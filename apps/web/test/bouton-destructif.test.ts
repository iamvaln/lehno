import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { contrastRatio, resolve } from "@lehno/tokens";

// Le rang destructeur plein n'a pas de jeton de survol dédié — le système de
// design n'en définit pas pour le rouge. Il se rabat donc sur l'opacité, qui
// fond le bouton *entier* vers la page : le texte pâlit en même temps que le
// fond. Le contraste s'en trouve réduit, et rien ne le signalerait.
const feuille = fileURLToPath(new URL("../app/composants.css", import.meta.url));

const compose = (avant: string, fond: string, alpha: number): string => {
  const canal = (h: string, i: number): number => Number.parseInt(h.slice(1).slice(i * 2, i * 2 + 2), 16);
  const melange = (i: number): number => Math.round(canal(avant, i) * alpha + canal(fond, i) * (1 - alpha));
  return `#${[0, 1, 2].map((i) => melange(i).toString(16).padStart(2, "0").toUpperCase()).join("")}`;
};

describe("bouton destructeur", () => {
  // Lues dans la feuille, pas recopiées : le jour où quelqu'un les change,
  // c'est la nouvelle valeur qui se fait mesurer.
  const opacites = [...readFileSync(feuille, "utf-8").matchAll(/opacity:\s*([\d.]+)/g)]
    .map((m) => Number.parseFloat(m[1]!));

  it("la feuille déclare bien des paliers d'opacité à mesurer", () => {
    expect(opacites.length).toBeGreaterThan(0);
  });

  it.each(["light", "dark"] as const)(
    "garde 4,5:1 entre son libellé et son fond à chaque palier, en thème %s",
    (theme) => {
      const c = resolve(theme);
      for (const alpha of opacites) {
        const texte = compose(c.surfacePage, c.surfacePage, alpha);
        const fond = compose(c.feedbackError, c.surfacePage, alpha);
        expect(
          contrastRatio(texte, fond),
          `${theme} : opacité ${alpha}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
