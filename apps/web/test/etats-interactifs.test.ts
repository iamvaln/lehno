import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Un style en ligne ne peut pas porter :hover ni :active : les rôles
// d'interaction du système (--action-hover, --action-press) ne peuvent
// donc s'exprimer que depuis une feuille CSS. Ce test vérifie qu'ils y
// figurent réellement, pas seulement qu'ils existent dans les jetons.
describe("jetons d'interaction du bouton", () => {
  it("--action-hover et --action-press apparaissent dans le CSS livré", () => {
    const feuille = readFileSync(
      join(import.meta.dirname, "..", "app", "composants.css"),
      "utf-8",
    );
    expect(feuille).toContain("var(--action-hover)");
    expect(feuille).toContain("var(--action-press)");
  });
});
