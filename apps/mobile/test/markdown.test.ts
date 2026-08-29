import { describe, expect, it } from "vitest";
import { blocsDeMarkdown } from "../lib/markdown.js";

describe("les blocs d'un document", () => {
  it("reconnaît les trois rangs de titre", () => {
    expect(blocsDeMarkdown("# Un\n## Deux\n### Trois").map((b) => [b.sorte, "rang" in b ? b.rang : null]))
      .toEqual([["titre", 1], ["titre", 2], ["titre", 3]]);
  });

  it("reconnaît les points de liste, quel que soit le tiret", () => {
    const blocs = blocsDeMarkdown("- un\n* deux\n+ trois");
    expect(blocs.map((b) => b.sorte)).toEqual(["point", "point", "point"]);
    expect(blocs.map((b) => b.texte)).toEqual(["un", "deux", "trois"]);
  });

  /* L'espacement vient des marges, pas de paragraphes vides qui trouent la
     page — et un document légal est long. */
  it("ne rend pas les lignes vides", () => {
    expect(blocsDeMarkdown("un\n\n\ndeux")).toHaveLength(2);
  });

  /* Le gras est RETIRÉ, pas rendu : les marques au milieu d'une phrase
     demanderaient de la couper en fragments stylés, et une phrase juridique
     coupée se relit mal. */
  it("retire l'emphase sans manger le texte", () => {
    expect(blocsDeMarkdown("Le **prestataire** s'engage.")[0]?.texte)
      .toBe("Le prestataire s'engage.");
    expect(blocsDeMarkdown("Un _délai_ de 30 jours.")[0]?.texte).toBe("Un délai de 30 jours.");
  });

  /* CE QU'ON NE SAIT PAS RENDRE RESTE LISIBLE. Un lien ou un tableau garde sa
     syntaxe plutôt que de disparaître : un document légal amputé serait pire
     qu'un document un peu brut. */
  it("garde ce qu'il ne sait pas rendre", () => {
    const bloc = blocsDeMarkdown("Voir [les conditions](https://lehno.cm/cgu).")[0];
    expect(bloc?.texte).toBe("Voir [les conditions](https://lehno.cm/cgu).");
  });

  // Un astérisque isolé — une multiplication, une note — n'est pas de l'emphase.
  it("ne confond pas un astérisque isolé avec de l'emphase", () => {
    expect(blocsDeMarkdown("2 * 3 = 6")[0]?.texte).toBe("2 * 3 = 6");
  });

  it("rend un document vide sans rien inventer", () => {
    expect(blocsDeMarkdown("")).toEqual([]);
  });
});
