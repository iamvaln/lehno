import { describe, expect, it } from "vitest";
import { estUnIdentifiantDAppareil, uuidDepuis } from "../lib/appareil.forme.js";

const aleatoire = () => Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
const forgeUnIdentifiant = () => uuidDepuis(aleatoire());

describe("l'identifiant d'appareil", () => {
  /* Il borne le nombre de comptes créés depuis un même téléphone. Il doit donc
     survivre à une fermeture de l'application — sinon le plafond ne borne rien —
     mais rester propre à l'installation : ce n'est pas une identité de personne,
     et le réutiliser d'un compte à l'autre serait un traçage. */
  it("a la forme d'un identifiant universel", () => {
    expect(estUnIdentifiantDAppareil(forgeUnIdentifiant())).toBe(true);
  });

  it("n'en forge jamais deux fois le même", () => {
    const lot = new Set(Array.from({ length: 200 }, () => forgeUnIdentifiant()));
    expect(lot.size).toBe(200);
  });

  // Le contrat le borne à 128 caractères, et refuse le vide.
  // Les bits de version et de variante font la différence entre une chaîne de
  // la bonne longueur et un identifiant valide.
  it("pose les bits de version et de variante", () => {
    const id = uuidDepuis(new Uint8Array(16));
    expect(id[14]).toBe("4");
    expect("89ab").toContain(id[19]);
  });

  it("exige ses seize octets", () => {
    expect(() => uuidDepuis(new Uint8Array(8))).toThrow();
  });

  it("refuse ce qui n'en est pas un", () => {
    for (const faux of ["", "   ", "abc", "x".repeat(200)]) {
      expect(estUnIdentifiantDAppareil(faux), JSON.stringify(faux.slice(0, 12))).toBe(false);
    }
  });
});
