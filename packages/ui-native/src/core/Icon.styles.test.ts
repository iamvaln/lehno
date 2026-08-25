import { describe, expect, it } from "vitest";
import { epaisseurDuTrait, nomLucide } from "./Icon.styles.js";

describe("le trait de l'icône", () => {
  /* La charte fixe la famille, la grille et le trait. Sous 16 px, un trait de
     1,8 se referme sur lui-même et le signe devient une tache ; les chevrons
     sont si fins qu'ils demandent la même faveur à toute taille. */
  it("épaissit sous 16 px", () => {
    expect(epaisseurDuTrait("heart", 14)).toBe(2);
    expect(epaisseurDuTrait("heart", 20)).toBe(1.8);
  });

  it("épaissit les chevrons et les flèches à toute taille", () => {
    expect(epaisseurDuTrait("chevron-right", 20)).toBe(2);
    expect(epaisseurDuTrait("arrow-left", 24)).toBe(2);
  });

  it("laisse une épaisseur donnée l'emporter", () => {
    expect(epaisseurDuTrait("heart", 20, 1.2)).toBe(1.2);
  });
});

describe("le nom de l'icône", () => {
  // La charte nomme les icônes en tirets, comme le web ; lucide-react-native
  // les exporte en casse Pascal. La conversion vit ici pour que les écrans
  // continuent d'écrire `icon="chevron-right"` comme sur le web.
  it("convertit les tirets en casse Pascal", () => {
    expect(nomLucide("chevron-right")).toBe("ChevronRight");
    expect(nomLucide("heart")).toBe("Heart");
  });

  // « share-2 » est un nom réel de la bibliothèque, et un chiffre collé n'est
  // pas une frontière de mot : le convertir en « Share-2 » ou « ShareTwo » ne
  // trouverait rien.
  it("garde les chiffres collés au mot", () => {
    expect(nomLucide("share-2")).toBe("Share2");
  });
});
