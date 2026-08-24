import { describe, expect, it } from "vitest";
import { analyserMarkdown } from "../lib/markdown-leger.js";

// Les documents légaux (apps/api/src/public/legal/*.md) n'emploient qu'un
// sous-ensemble fixe de Markdown : un h1, une ligne de version en italique,
// des h2 (les sections du sommaire), parfois des h3 imbriqués, des
// paragraphes qui s'enroulent sur plusieurs lignes, des listes à puce dont
// les items s'enroulent aussi, du gras et des liens. C'est ce sous-ensemble,
// et rien de plus, que ce test couvre.

const EXEMPLE = `# Titre du document

_Version 2026-08-23 · Dernière mise à jour : 23 août 2026_

Un chapeau qui introduit le document, avec un mot en
**gras** dedans.

## 1. Première section

Un paragraphe qui commence ici et se poursuit
sur une seconde ligne physique, avant la ligne vide.

Un second paragraphe, avec du **gras** et un
[lien utile](/v1/public/legal/cgu) qui pointe ailleurs.

- Premier item, qui s'étale
  sur deux lignes physiques.
- Second item avec du **gras** dedans.

## 2. Seconde section

### 2.1 Sous-section

Un paragraphe dans la sous-section.
`;

describe("analyserMarkdown", () => {
  it("extrait le titre h1", () => {
    expect(analyserMarkdown(EXEMPLE).titre).toBe("Titre du document");
  });

  it("extrait la ligne de version, sans les soulignés qui la portaient", () => {
    expect(analyserMarkdown(EXEMPLE).maj).toBe("Version 2026-08-23 · Dernière mise à jour : 23 août 2026");
  });

  it("un paragraphe entre la ligne de version et le premier h2 devient le chapeau", () => {
    expect(analyserMarkdown(EXEMPLE).chapeau).toEqual([
      { type: "texte", valeur: "Un chapeau qui introduit le document, avec un mot en " },
      { type: "gras", valeur: "gras" },
      { type: "texte", valeur: " dedans." },
    ]);
  });

  it("sans paragraphe avant le premier h2, le chapeau est vide", () => {
    const doc = analyserMarkdown("# Titre seul\n\n_Version 1_\n\n## 1. Section\n\nTexte.\n");
    expect(doc.chapeau).toEqual([]);
  });

  it("une section par h2, avec un identifiant stable pour l'ancre", () => {
    const { sections } = analyserMarkdown(EXEMPLE);
    expect(sections).toHaveLength(2);
    expect(sections[0]!.titre).toBe("1. Première section");
    expect(sections[0]!.id).toBe("1-premiere-section");
    expect(sections[1]!.titre).toBe("2. Seconde section");
  });

  it("un paragraphe enroulé sur plusieurs lignes redevient un seul bloc", () => {
    const bloc = analyserMarkdown(EXEMPLE).sections[0]!.blocs[0];
    expect(bloc).toEqual({
      type: "paragraphe",
      contenu: [
        { type: "texte", valeur: "Un paragraphe qui commence ici et se poursuit sur une seconde ligne physique, avant la ligne vide." },
      ],
    });
  });

  it("reconnaît le gras et les liens à l'intérieur d'un paragraphe", () => {
    const bloc = analyserMarkdown(EXEMPLE).sections[0]!.blocs[1];
    expect(bloc).toEqual({
      type: "paragraphe",
      contenu: [
        { type: "texte", valeur: "Un second paragraphe, avec du " },
        { type: "gras", valeur: "gras" },
        { type: "texte", valeur: " et un " },
        { type: "lien", texte: "lien utile", href: "/v1/public/legal/cgu" },
        { type: "texte", valeur: " qui pointe ailleurs." },
      ],
    });
  });

  it("une liste à puces recolle les items enroulés sur plusieurs lignes", () => {
    const bloc = analyserMarkdown(EXEMPLE).sections[0]!.blocs[2];
    expect(bloc).toEqual({
      type: "liste",
      items: [
        [{ type: "texte", valeur: "Premier item, qui s'étale sur deux lignes physiques." }],
        [
          { type: "texte", valeur: "Second item avec du " },
          { type: "gras", valeur: "gras" },
          { type: "texte", valeur: " dedans." },
        ],
      ],
    });
  });

  it("un h3 devient un sous-titre à l'intérieur des blocs de sa section h2", () => {
    const blocs = analyserMarkdown(EXEMPLE).sections[1]!.blocs;
    expect(blocs[0]).toEqual({ type: "sous-titre", texte: "2.1 Sous-section" });
    expect(blocs[1]).toEqual({
      type: "paragraphe",
      contenu: [{ type: "texte", valeur: "Un paragraphe dans la sous-section." }],
    });
  });

  it("un document sans h2 n'a aucune section", () => {
    const doc = analyserMarkdown("# Seul un titre\n\n_Version 1_\n");
    expect(doc.sections).toEqual([]);
  });
});
