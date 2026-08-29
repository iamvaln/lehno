import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { BOITE_LOGOTYPE, LETTRES, couleursDuLogotype } from "./Wordmark.data.js";

const CLAIR = resolve("light");

describe("le logotype", () => {
  // Cinq lettres — L, e, h, n, o — dans l'ordre d'écriture. C'est cet ordre
  // que l'animation d'ouverture suit, une lettre après l'autre.
  it("porte les cinq lettres, dans l'ordre d'écriture", () => {
    expect(LETTRES).toHaveLength(5);
    expect(LETTRES.map((l) => l.d).every((d) => d.startsWith("M"))).toBe(true);
  });

  /* Le h est la lettre qui prend l'accent — en couleur sur le logotype, et
     c'est elle qui vire à l'abricot en dernier à l'ouverture. Une seule lettre
     le porte : deux feraient un motif, une fait une signature. */
  it("une seule lettre porte l'accent, et c'est le h", () => {
    const accentuees = LETTRES.filter((l) => l.accent);
    expect(accentuees).toHaveLength(1);
    expect(LETTRES.indexOf(accentuees[0]!)).toBe(2);
  });

  it("chaque lettre porte les bornes de son volet d'écriture", () => {
    for (const lettre of LETTRES) {
      expect(lettre.volet.x, lettre.d.slice(0, 8)).toBeTypeOf("number");
      expect(lettre.volet.largeur).toBeGreaterThan(0);
    }
  });

  it("garde le rapport du logotype", () => {
    expect(BOITE_LOGOTYPE.largeur / BOITE_LOGOTYPE.hauteur).toBeCloseTo(703.98 / 226.2, 3);
  });
});

describe("les variantes du logotype", () => {
  // Sur l'aplat violet de l'ouverture, les lettres sont blanches et le h prend
  // l'abricot : c'est la variante « inverse », et elle ne dépend pas du thème —
  // un écran d'ouverture précède l'application.
  it("l'inverse écrit en blanc, accent abricot", () => {
    const c = couleursDuLogotype("inverse", CLAIR);
    expect(c.lettre).toBe("#FFFFFF");
    expect(c.accent).toBe(CLAIR.celebrate);
  });

  it("la couleur prend l'encre et l'accent de la charte", () => {
    const c = couleursDuLogotype("couleur", CLAIR);
    expect(c.lettre).toBe(CLAIR.textBody);
    expect(c.accent).toBe(CLAIR.action);
  });
});
