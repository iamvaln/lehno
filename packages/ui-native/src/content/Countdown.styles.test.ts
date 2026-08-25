import { describe, expect, it } from "vitest";
import { nativeRadius, resolve } from "@lehno/tokens";
import { styleDeDecompte, TAILLES_DE_DECOMPTE } from "./Countdown.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");

describe("le décompte", () => {
  /* Le décompte est un traitement typographique : Fraunces, violet appuyé,
     plus grand que le texte autour. Le jour même bascule en pilule abricot —
     et c'est le seul moment où cette couleur paraît. */
  it("s'écrit dans le caractère de titre tant que le jour n'est pas venu", () => {
    const s = styleDeDecompte({ couleurs: CLAIR });
    expect(s.texte.fontFamily).toBe("Fraunces-Regular");
    expect(s.texte.color).toBe(CLAIR.textAccent);
    expect(s.pilule).toBeNull();
  });

  it("bascule en pilule abricot le jour même, dans les deux thèmes", () => {
    for (const couleurs of [CLAIR, SOMBRE]) {
      const s = styleDeDecompte({ couleurs, jourMeme: true });
      expect(s.pilule?.backgroundColor).toBe(couleurs.celebrate);
      expect(s.texte.color).toBe(couleurs.onCelebrate);
      expect(s.pilule?.borderRadius).toBe(nativeRadius.pill);
    }
  });

  it("porte les trois tailles de la charte", () => {
    expect(TAILLES_DE_DECOMPTE.s).toBe(20);
    expect(TAILLES_DE_DECOMPTE.m).toBe(34);
    expect(TAILLES_DE_DECOMPTE.l).toBe(76);
  });

  // La pilule ne suit pas l'échelle du décompte : à 76, un libellé
  // proportionnel déborderait de la carte. Il se cale, avec un plancher.
  it("plafonne le libellé de la pilule et lui pose un plancher", () => {
    expect(styleDeDecompte({ couleurs: CLAIR, jourMeme: true, taille: "l" }).texte.fontSize).toBe(27);
    expect(styleDeDecompte({ couleurs: CLAIR, jourMeme: true, taille: "s" }).texte.fontSize).toBe(12);
  });
});
