import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nativeFont } from "@lehno/tokens";

// React Native ne résout pas une famille par graisse : il charge une police par
// nom. Un nom qui ne correspond à aucun fichier ne lève rien — le système rend
// sa police par défaut, et l'identité tombe sans qu'aucune erreur ne le dise.
// C'est le seul défaut du port qui soit à la fois invisible et total.

const NOMS = Object.values(nativeFont);

describe("les polices embarquées", () => {
  it.each(NOMS)("%s a son fichier", (nom) => {
    expect(existsSync(`polices/${nom}.ttf`)).toBe(true);
  });

  // Une variable embarquée telle quelle rendrait sa forme neutre sur Android :
  // les réglages de marque — SOFT 40, WONK 1 — doivent être cuits dans le
  // fichier, et c'est l'absence de table fvar qui le prouve.
  it.each(NOMS)("%s est une instance statique, sans table fvar", (nom) => {
    const octets = readFileSync(`polices/${nom}.ttf`);
    expect(octets.includes(Buffer.from("fvar", "ascii"))).toBe(false);
  });

  // Un fichier qui traîne sans être demandé finit par être chargé, et alourdit
  // le paquet sans rien rendre. Le dossier dit exactement ce que les styles
  // demandent — ni plus, ni moins.
  it("ne porte aucun fichier que les styles ne demandent pas", () => {
    const surDisque = readdirSync("polices")
      .filter((f) => f.endsWith(".ttf"))
      .map((f) => f.replace(/\.ttf$/, ""));
    expect(surDisque.sort()).toEqual([...NOMS].sort());
  });
});
