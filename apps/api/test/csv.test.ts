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

  // Excel et Sheets lisent « = », « + », « - » et « @ » en tête de cellule
  // comme le début d'un calcul, et l'exécutent à l'ouverture. Les guillemets
  // n'y changent rien : ils protègent le découpage du fichier, pas son
  // interprétation.
  it("une formule ne s'exécute pas à l'ouverture du fichier", () => {
    expect(ligneCsv(['=HYPERLINK("http://exemple","clic")']))
      .toBe(`"'=HYPERLINK(""http://exemple"",""clic"")"`);
  });

  it("les quatre débuts dangereux sont neutralisés", () => {
    for (const debut of ["=", "+", "-", "@"]) {
      expect(ligneCsv([`${debut}x`]), debut).toBe(`"'${debut}x"`);
    }
  });

  // La tabulation et le retour chariot déclenchent la même lecture chez
  // certains tableurs.
  it("la tabulation et le retour chariot le sont aussi", () => {
    expect(ligneCsv(["\tx"])).toBe(`"'\tx"`);
    expect(ligneCsv(["\rx"])).toBe(`"'\rx"`);
  });

  // La neutralisation ne doit pas défigurer ce qui n'a rien de dangereux : un
  // motif qui commence par une lettre reste tel quel.
  it("un texte ordinaire n'est pas préfixé", () => {
    expect(ligneCsv(["Suspendu pour abus"])).toBe('"Suspendu pour abus"');
  });

  // Un signe moins en tête est le cas qui prête à discussion : « -5 » est un
  // nombre légitime. Il est neutralisé quand même — un tableur qui lit « -5 »
  // comme un nombre le lit aussi comme le début d'une soustraction, et on ne
  // peut pas distinguer les deux à l'écriture.
  it("un nombre négatif est neutralisé lui aussi, faute de pouvoir trancher", () => {
    expect(ligneCsv(["-5"])).toBe(`"'-5"`);
  });

  it("l'entête n'est pas cité", () => {
    expect(documentCsv(["date", "action"], [["2026-08-26", "x"]]))
      .toBe('date,action\n"2026-08-26","x"');
  });

  it("un document sans ligne garde son entête", () => {
    expect(documentCsv(["date"], [])).toBe("date");
  });
});
