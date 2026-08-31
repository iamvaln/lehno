import { describe, expect, it } from "vitest";
import { nativeTouchMin, resolve } from "@lehno/tokens";
import { styleDeCategorie } from "./CategoryTag.styles.js";

const CLAIR = resolve("light");

describe("l'étiquette de catégorie", () => {
  // Une note non classée se signale par un trait interrompu : elle attend une
  // décision, elle n'affirme rien.
  it("marque le non-classé d'un trait interrompu et sans fond", () => {
    const s = styleDeCategorie({ couleurs: CLAIR, aClasser: true });
    expect(s.pilule.borderStyle).toBe("dashed");
    expect(s.pilule.backgroundColor).toBe("transparent");
    expect(s.pilule.borderColor).toBe(CLAIR.borderObject);
  });

  it("pose le classé sur le fond discret de l'action", () => {
    const s = styleDeCategorie({ couleurs: CLAIR });
    expect(s.pilule.backgroundColor).toBe(CLAIR.actionQuietBg);
    expect(s.libelle.color).toBe(CLAIR.textAccent);
  });

  /* La pilule reste compacte ; c'est la zone d'appui qui porte les 44 points,
     par une marge négative. Une zone d'appui ne se lit pas, elle se touche —
     et une pilule à 44 de haut serait un pavé au milieu d'une note. */
  it("porte la cible tactile sans grossir la pilule", () => {
    const s = styleDeCategorie({ couleurs: CLAIR, reclassable: true });
    expect(s.zoneDAppui?.minHeight).toBe(nativeTouchMin);
    expect(s.zoneDAppui?.marginVertical).toBeLessThan(0);
    expect(s.pilule.minHeight).toBeUndefined();
  });

  it("n'ouvre aucune zone d'appui quand rien n'est reclassable", () => {
    expect(styleDeCategorie({ couleurs: CLAIR }).zoneDAppui).toBeNull();
  });
});
