import { describe, expect, it } from "vitest";
import { nativeRadius, resolve } from "@lehno/tokens";
import { styleDEtiquette, TONS_D_ETIQUETTE } from "./Tag.styles.js";

const CLAIR = resolve("light");
const SOMBRE = resolve("dark");

describe("l'étiquette", () => {
  it("reste une pilule, quel que soit son ton", () => {
    for (const ton of TONS_D_ETIQUETTE) {
      expect(styleDEtiquette({ couleurs: CLAIR, ton }).conteneur.borderRadius, ton).toBe(nativeRadius.pill);
    }
  });

  /* L'abricot est la seule couleur chaude du système et ne paraît qu'au jour
     même. Le texte qui s'y pose est un jeton à part — du blanc n'y tiendrait
     pas le contraste. */
  it("le ton de fête prend l'encre que la charte pose sur l'abricot", () => {
    for (const couleurs of [CLAIR, SOMBRE]) {
      const style = styleDEtiquette({ couleurs, ton: "celebrate" });
      expect(style.conteneur.backgroundColor).toBe(couleurs.celebrate);
      expect(style.libelle.color).toBe(couleurs.onCelebrate);
    }
  });

  // Le ton discret n'a pas de trait : il se pose par son fond seul.
  it("le ton discret ne pose pas de trait", () => {
    expect(styleDEtiquette({ couleurs: CLAIR, ton: "quiet" }).conteneur.borderColor).toBe("transparent");
  });
});
