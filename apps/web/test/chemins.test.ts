import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CHEMINS_LEGAUX, cheminLegal } from "../lib/chemins.js";

// Un chemin qui n'a pas de dossier de route derrière lui est un lien mort.
// C'est exactement le défaut qu'on vient de corriger sur le pied de page :
// trois liens en 404 sur chaque visite, que rien ne signalait.
const routes = (): string[] =>
  readdirSync(join(import.meta.dirname, "..", "app", "[locale]"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

describe("chemins des pages légales", () => {
  it("donne un chemin dans la langue de la page", () => {
    expect(cheminLegal("cgu", "fr")).toBe("/fr/conditions");
    expect(cheminLegal("cgu", "en")).toBe("/en/terms");
    expect(cheminLegal("confidentialite", "en")).toBe("/en/privacy");
    expect(cheminLegal("mentions", "en")).toBe("/en/legal-notice");
  });

  it.each(Object.entries(CHEMINS_LEGAUX))(
    "le document %s a un dossier de route pour chaque langue",
    (_document, parLangue) => {
      const existants = routes();
      for (const segment of Object.values(parLangue)) {
        expect(existants, `route manquante : app/[locale]/${segment}`).toContain(segment);
      }
    },
  );
});
