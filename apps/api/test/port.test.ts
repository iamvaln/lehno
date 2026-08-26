import { describe, expect, it } from "vitest";
import { portDecoute } from "../src/common/port.js";

// Le cas qui nous a coûté un démarrage le 26/08/2026 : `PORT=` déclaré vide
// dans le fichier d'environnement. `Number("")` vaut 0, et Node lit 0 comme
// « prends un port libre au hasard ». L'application annonce « started », et
// écoute sur 54668.
describe("le port d'écoute", () => {
  it("retombe sur 3000 quand rien n'est posé", () => {
    expect(portDecoute(undefined)).toBe(3000);
  });

  // LE cas. Vide n'est pas absent : le `??` ne le rattrape pas.
  it("retombe sur 3000 quand la valeur est VIDE, pas seulement absente", () => {
    expect(portDecoute("")).toBe(3000);
  });

  it("respecte un port explicite", () => {
    expect(portDecoute("3001")).toBe(3001);
  });

  // Refuser plutôt qu'inventer : une écoute fantôme se diagnostique mal, un
  // refus au démarrage porte son message.
  it("refuse une valeur qui n'est pas un nombre", () => {
    expect(() => portDecoute("trois-mille")).toThrow(/PORT doit être un nombre/);
  });

  it("refuse zéro, qui veut dire « au hasard »", () => {
    expect(() => portDecoute("0")).toThrow(/pas un port d'écoute/);
  });

  it("refuse un port hors de la plage", () => {
    expect(() => portDecoute("70000")).toThrow(/pas un port d'écoute/);
  });
});
