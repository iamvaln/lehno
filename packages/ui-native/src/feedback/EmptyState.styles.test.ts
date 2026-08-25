import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { ornementDeVide, styleDEtatVide } from "./EmptyState.styles.js";

const CLAIR = resolve("light");

describe("l'état vide", () => {
  /* « Les textes annoncent ce qui est possible plutôt que ce qui manque. » Le
     composant ne peut pas garantir la formulation, mais il garantit la forme :
     centré, un seul ornement, une seule action. */
  it("se centre, texte compris", () => {
    const s = styleDEtatVide(CLAIR);
    expect(s.conteneur.alignItems).toBe("center");
    expect(s.titre.textAlign).toBe("center");
    expect(s.texte.textAlign).toBe("center");
  });

  // Une illustration et une icône ensemble feraient deux ornements pour un
  // écran qui n'a rien à montrer. L'illustration l'emporte : elle réchauffe,
  // l'icône ne fait que signaler.
  it("ne garde qu'un ornement, l'illustration l'emportant", () => {
    expect(ornementDeVide({ illustration: "carnet-neuf", icone: "plus" }))
      .toEqual({ sorte: "illustration", nom: "carnet-neuf" });
    expect(ornementDeVide({ icone: "plus" })).toEqual({ sorte: "icone", nom: "plus" });
    expect(ornementDeVide({})).toBeNull();
  });
});
