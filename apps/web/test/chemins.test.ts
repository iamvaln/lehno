import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CHEMINS_LEGAUX, cheminLegal, cheminDansLautreLangue } from "../lib/chemins.js";

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

/* LA BASCULE GARDE LA PAGE.
 *
 * Elle renvoyait à l'accueil quelle que soit la page — signalé à l'écran depuis
 * la FAQ. Aucun test ne pouvait le voir : le composant n'avait pas de logique,
 * il pointait sur une constante. */
describe("le chemin dans l'autre langue", () => {
  it("garde la page quand le chemin s'écrit pareil", () => {
    expect(cheminDansLautreLangue("/fr/faq", "fr")).toBe("/en/faq");
    expect(cheminDansLautreLangue("/en/contact", "en")).toBe("/fr/contact");
  });

  /* Les pages légales portent un chemin traduit : l'échange naïf du préfixe
     donnerait « /en/confidentialite », qui n'existe pas. */
  it("traduit le chemin des pages légales", () => {
    expect(cheminDansLautreLangue("/fr/confidentialite", "fr")).toBe("/en/privacy");
    expect(cheminDansLautreLangue("/en/privacy", "en")).toBe("/fr/confidentialite");
    expect(cheminDansLautreLangue("/fr/conditions", "fr")).toBe("/en/terms");
    expect(cheminDansLautreLangue("/en/terms", "en")).toBe("/fr/conditions");
    expect(cheminDansLautreLangue("/fr/mentions-legales", "fr")).toBe("/en/legal-notice");
    expect(cheminDansLautreLangue("/en/legal-notice", "en")).toBe("/fr/mentions-legales");
  });

  it("rend la racine de l'autre langue depuis l'accueil", () => {
    expect(cheminDansLautreLangue("/fr", "fr")).toBe("/en");
    expect(cheminDansLautreLangue("/en/", "en")).toBe("/fr");
  });

  /* Les surfaces à jeton s'écrivent pareil dans les deux langues. Les
     énumérer ici les ferait diverger de leurs dossiers de route. */
  it("laisse passer les surfaces à jeton avec leur jeton", () => {
    expect(cheminDansLautreLangue("/fr/c/8Kd2p", "fr")).toBe("/en/c/8Kd2p");
    expect(cheminDansLautreLangue("/en/m/valentine", "en")).toBe("/fr/m/valentine");
    expect(cheminDansLautreLangue("/fr/i/ABC123", "fr")).toBe("/en/i/ABC123");
  });

  // Un chemin qui ne commence pas par la langue attendue ne se devine pas.
  it("rejoint la racine quand le chemin n'est pas localisé", () => {
    expect(cheminDansLautreLangue("/", "fr")).toBe("/en");
    expect(cheminDansLautreLangue("/robots.txt", "fr")).toBe("/en");
  });
});
