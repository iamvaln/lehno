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

  /* Deux outils, deux ports, et le second manquait.
   *
   * La landing tient le 3000 — c'est le défaut de Next. Le back-office est
   * servi par Vite, dont le défaut est 5173, et son `package.json` ne fixe
   * aucun port. Sans cette origine, l'outil se charge mais chaque appel est
   * refusé par le navigateur AVANT de partir : « No Access-Control-Allow-Origin
   * header ». Il n'était donc pas utilisable dans un navigateur, en local.
   *
   * Trouvé le 28/08 en pilotant Chrome. C'est le même défaut que celui qui a
   * valu ce fichier, et pour la même raison : les essais se faisaient en curl,
   * qui n'envoie pas de requête préalable. */
  it("accepte l'origine du back-office, servi sur un autre port que la landing", () => {
    const o = originsAutorisees("lehno.app", "development");
    expect(o).toContain("http://localhost:5173");
    expect(o).toContain("http://127.0.0.1:5173");
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
