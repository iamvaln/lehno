import { describe, expect, it } from "vitest";
import { banner, updateSuggestion } from "../lib/update.js";

/* La suggestion de mise à jour — §4, phase 3.
 *
 * Ce qui se joue ici n'est pas « lire deux en-têtes » mais L'ABSENCE : la spec
 * dit que chacun peut manquer SÉPARÉMENT, parce que le serveur préfère ne pas
 * poser une valeur qu'il ne peut pas porter plutôt que de rendre 500 sur tout
 * le trafic. Le client qui l'oublierait planterait exactement le jour où une
 * frappe malheureuse entre au registre.
 */
const entetes = (paire: Record<string, string>) =>
  (nom: string): string | null => paire[nom] ?? null;

describe("ce que la réponse suggère", () => {
  it("rend la version et son lien quand les deux voyagent", () => {
    expect(updateSuggestion(entetes({
      "x-app-update-available": "1.4.0",
      "x-app-update-url": "https://apps.apple.com/app/id123",
    }))).toEqual({ version: "1.4.0", url: "https://apps.apple.com/app/id123" });
  });

  it("ne suggère rien quand aucun en-tête n'est là", () => {
    expect(updateSuggestion(entetes({}))).toBeNull();
  });

  /* LE CAS QUE LA SPEC NOMME : le registre ne connaît pas toujours le lien.
     Annoncer la version reste utile — c'est le bandeau qui cessera de promettre
     un geste, pas la lecture qui doit tout jeter. */
  it("garde la version quand le lien manque", () => {
    expect(updateSuggestion(entetes({ "x-app-update-available": "1.4.0" })))
      .toEqual({ version: "1.4.0", url: null });
  });

  // L'inverse n'est pas vrai : un lien sans version ne nomme rien.
  it("ne suggère rien quand seul le lien est là", () => {
    expect(updateSuggestion(entetes({ "x-app-update-url": "https://apps.apple.com/app/id123" })))
      .toBeNull();
  });

  /* Un relais qui vide un en-tête le laisse présent et vide. « Version  est
     disponible » est pire que le silence. */
  it("traite un en-tête vide comme absent", () => {
    expect(updateSuggestion(entetes({ "x-app-update-available": "   " }))).toBeNull();
    expect(updateSuggestion(entetes({ "x-app-update-available": "1.4.0", "x-app-update-url": " " })))
      .toEqual({ version: "1.4.0", url: null });
  });

  /* LA MÊME GARDE QUE `lienDuMagasin`, et pour la même raison : ce lien vient
     d'une saisie d'administration, et il finit dans `Linking.openURL`. */
  it("refuse un lien qui n'est pas en https", () => {
    for (const url of ["javascript:alert(1)", "itms-apps://x", "http://lehno.io", "lehno.io"]) {
      expect(updateSuggestion(entetes({ "x-app-update-available": "1.4.0", "x-app-update-url": url })))
        .toEqual({ version: "1.4.0", url: null });
    }
  });
});

describe("une fois par session au plus", () => {
  const suggestion = { version: "1.4.0", url: null };

  it("montre tant que personne ne l'a écartée", () => {
    expect(banner(suggestion, false)).toBe(suggestion);
  });

  /* LE DÉFAUT QUE CETTE FONCTION EXISTE POUR EMPÊCHER. L'en-tête revient sur
     CHAQUE appel : sans ce drapeau, fermer le bandeau le ferait revenir à la
     requête suivante — c'est-à-dire aussitôt, et pour toujours. Écarter doit
     vouloir dire quelque chose. */
  it("ne montre plus rien une fois écartée, l'en-tête eût-il persisté", () => {
    expect(banner(suggestion, true)).toBeNull();
  });

  it("ne montre rien quand il n'y a rien à suggérer", () => {
    expect(banner(null, false)).toBeNull();
  });
});
