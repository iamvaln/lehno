import { describe, expect, it } from "vitest";
import { documentCsv, ligneCsv } from "../src/admin/csv.js";

/**
 * L'échappement est tout ce que ce fichier doit garantir. Un motif
 * d'administration est du texte libre : sans guillemets, une virgule scinde la
 * ligne et les colonnes suivantes glissent d'un cran. Le fichier reste lisible
 * — il dit simplement autre chose, et personne ne s'en aperçoit.
 */
describe("le fichier de valeurs séparées", () => {
  it("cite toujours, même ce qui n'en a pas besoin", () => {
    expect(ligneCsv(["a", "b"])).toBe('"a","b"');
  });

  it("une virgule ne scinde pas la ligne", () => {
    expect(ligneCsv(["Suspendu, puis rétabli", "x"])).toBe('"Suspendu, puis rétabli","x"');
  });

  it("un guillemet est doublé", () => {
    expect(ligneCsv(['Motif dit "urgent"'])).toBe('"Motif dit ""urgent"""');
  });

  // Sans citation, un retour à la ligne ferait deux lignes d'une seule trace —
  // et la seconde n'aurait pas le bon nombre de colonnes.
  it("un retour à la ligne reste dans sa cellule", () => {
    expect(ligneCsv(["première\nseconde"])).toBe('"première\nseconde"');
  });

  it("une valeur absente donne une cellule vide, pas le mot « null »", () => {
    expect(ligneCsv([null, "x"])).toBe('"","x"');
  });

  it("l'entête n'est pas cité", () => {
    expect(documentCsv(["date", "action"], [["2026-08-26", "x"]]))
      .toBe('date,action\n"2026-08-26","x"');
  });

  it("un document sans ligne garde son entête", () => {
    expect(documentCsv(["date"], [])).toBe("date");
  });
});
