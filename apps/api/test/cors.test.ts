import { describe, expect, it } from "vitest";
import { originsAutorisees } from "../src/common/cors.js";

// Le navigateur poste depuis lehno.app vers api.lehno.app : deux origines
// distinctes, donc une requête préalable. Sans CORS configuré, elle répond 404
// et AUCUN formulaire ne part — ni la liste d'attente, ni le contact.
//
// Un essai en curl ne le voit pas : curl n'envoie pas de requête préalable.
// C'est exactement ce qui a laissé passer le défaut jusqu'en production.
describe("origines autorisées", () => {
  it("accepte le site public et son www", () => {
    const o = originsAutorisees("lehno.app");
    expect(o).toContain("https://lehno.app");
    expect(o).toContain("https://www.lehno.app");
  });

  // Le développement local poste depuis 3000 vers 3001.
  it("accepte les origines locales en développement", () => {
    const o = originsAutorisees("lehno.app", "development");
    expect(o).toContain("http://localhost:3000");
  });

  it("n'ouvre pas les origines locales en production", () => {
    const o = originsAutorisees("lehno.app", "production");
    expect(o.some((v) => v.includes("localhost"))).toBe(false);
  });

  // Une liste fermée, jamais un joker : « * » avec des identifiants revient à
  // n'avoir aucune protection d'origine.
  it("ne rend jamais de joker", () => {
    expect(originsAutorisees("lehno.app")).not.toContain("*");
  });

  // Sans domaine configuré, rien n'est autorisé : fermé par défaut.
  it("n'autorise rien sans domaine configuré", () => {
    expect(originsAutorisees(undefined, "production")).toEqual([]);
  });
});
