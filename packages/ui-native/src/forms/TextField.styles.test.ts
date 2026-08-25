import { describe, expect, it } from "vitest";
import { nativeSize, nativeTouchMin, resolve } from "@lehno/tokens";
import { styleDeChamp } from "./TextField.styles.js";

const CLAIR = resolve("light");

describe("le champ de saisie", () => {
  // Un champ se touche : il ne descend pas sous la cible tactile, même vide.
  it("ne descend pas sous la cible tactile", () => {
    expect(styleDeChamp({ couleurs: CLAIR }).champ.minHeight).toBe(nativeTouchMin);
  });

  /* 16 points, pas la taille de texte du web. C'est la taille de corps mobile
     de la charte, et c'est aussi celle en dessous de laquelle un champ devient
     pénible à relire au pouce. */
  it("écrit à la taille de corps mobile", () => {
    expect(styleDeChamp({ couleurs: CLAIR }).champ.fontSize).toBe(nativeSize.bodyM);
  });

  // L'erreur se voit sur le contour ET sur l'aide : le contour seul ne dit pas
  // ce qui ne va pas, l'aide seule se lit trop tard.
  it("marque l'erreur sur le contour et sur l'aide", () => {
    const s = styleDeChamp({ couleurs: CLAIR, invalide: true });
    expect(s.champ.borderColor).toBe(CLAIR.feedbackError);
    expect(s.aide.color).toBe(CLAIR.feedbackError);
  });

  it("reste neutre tant que rien n'est en faute", () => {
    const s = styleDeChamp({ couleurs: CLAIR });
    expect(s.champ.borderColor).toBe(CLAIR.borderObject);
    expect(s.aide.color).toBe(CLAIR.textMention);
  });

  /* En multiligne, le texte part du haut. Sans cela, Android centre
     verticalement : on tape une note de six lignes dans un champ où la première
     phrase flotte au milieu. */
  it("fait partir le texte du haut quand le champ est multiligne", () => {
    expect(styleDeChamp({ couleurs: CLAIR, multiligne: true }).champ.textAlignVertical).toBe("top");
    expect(styleDeChamp({ couleurs: CLAIR }).champ.textAlignVertical).toBeUndefined();
  });
});
