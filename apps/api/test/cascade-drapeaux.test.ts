import { describe, expect, it } from "vitest";
import { emporteDans } from "../src/admin/feature-flags.controller.js";

/**
 * La cascade se teste ici plutôt que contre le registre réel : celui-ci n'a
 * aujourd'hui qu'un seul niveau de dépendance, et une cascade qui s'arrêterait
 * au premier rang y passerait inaperçue. Elle mentirait le jour où une chaîne
 * de trois apparaît — c'est-à-dire au premier drapeau qui dépend d'un drapeau
 * qui dépend d'un autre.
 */
describe("ce que l'extinction d'un drapeau emporte", () => {
  const CHAINE = {
    a: [],
    b: ["a"],
    c: ["b"],
    isole: [],
  } as Record<string, readonly string[]>;

  it("emporte ce qui dépend directement", () => {
    expect(emporteDans(CHAINE, "b")).toEqual(["c"]);
  });

  it("remonte la chaîne entière, pas seulement le premier rang", () => {
    expect(emporteDans(CHAINE, "a").sort()).toEqual(["b", "c"]);
  });

  it("un drapeau que personne ne requiert n'emporte rien", () => {
    expect(emporteDans(CHAINE, "isole")).toEqual([]);
  });

  it("ne s'emporte pas lui-même", () => {
    expect(emporteDans(CHAINE, "a")).not.toContain("a");
  });

  // Deux drapeaux qui se requièrent mutuellement seraient une erreur de
  // registre, mais la fonction ne doit pas tourner en boucle pour autant : un
  // serveur qui ne répond plus est pire qu'un registre mal écrit.
  it("ne boucle pas sur un cycle", () => {
    const cycle = { x: ["y"], y: ["x"] } as Record<string, readonly string[]>;
    expect(emporteDans(cycle, "x")).toEqual(["y"]);
  });

  it("emporte les deux branches d'une dépendance partagée", () => {
    const fourche = { socle: [], gauche: ["socle"], droite: ["socle"] } as Record<string, readonly string[]>;
    expect(emporteDans(fourche, "socle").sort()).toEqual(["droite", "gauche"]);
  });
});
