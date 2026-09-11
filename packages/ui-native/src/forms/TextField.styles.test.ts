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

/* L'ÉTAT VALIDE — il manquait, et son absence s'est vue deux fois : une prop
   `valide` passée par l'écran du pseudo était silencieusement ignorée (les
   objets répandus échappent au contrôle des propriétés en trop), et le code de
   parrainage vérifié ne se distinguait pas d'un champ jamais touché. */
describe("un champ qui a été vérifié le montre", () => {
  it("teinte le contour et l'aide en succès", () => {
    const s = styleDeChamp({ couleurs: CLAIR, valide: true });
    expect(s.champ.borderColor).toBe(CLAIR.feedbackSuccess);
    expect(s.aide.color).toBe(CLAIR.feedbackSuccess);
  });

  /* L'ERREUR L'EMPORTE. Un champ ne peut pas être juste et faux ; montrer le
     vert d'abord ferait passer le refus pour une décoration. */
  it("laisse l'erreur l'emporter sur le succès", () => {
    const s = styleDeChamp({ couleurs: CLAIR, valide: true, invalide: true });
    expect(s.champ.borderColor).toBe(CLAIR.feedbackError);
    expect(s.aide.color).toBe(CLAIR.feedbackError);
  });

  it("ne teinte rien quand on n'a rien vérifié", () => {
    const s = styleDeChamp({ couleurs: CLAIR });
    expect(s.champ.borderColor).toBe(CLAIR.borderObject);
    expect(s.aide.color).toBe(CLAIR.textMention);
  });
});

