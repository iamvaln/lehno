import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// La maquette v3 (specs/Landing Lehno v3.dc.html) déplace le seuil de repli
// de la navigation de l'en-tête de 760 à 920px — .site-nav bascule derrière
// le bouton burger plus tôt. Le seuil du sommaire des pages légales
// (.legal-grid, 880px) est une requête distincte, sans rapport avec ce
// changement : elle ne bouge pas.
describe("seuil de repli mobile de l'en-tête", () => {
  it("le seuil est 920px, pas 760px", () => {
    const feuille = readFileSync(join(import.meta.dirname, "..", "app", "base.css"), "utf-8");
    expect(feuille).toContain("@container page (max-width: 920px)");
    expect(feuille).not.toContain("@container page (max-width: 760px)");
  });

  it("le seuil du sommaire des pages légales reste inchangé, à 880px", () => {
    const feuille = readFileSync(join(import.meta.dirname, "..", "app", "base.css"), "utf-8");
    expect(feuille).toContain("@container page (max-width: 880px)");
  });
});
