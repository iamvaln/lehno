import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// La marque s'affiche par le fichier de verrouillage, pas par deux images
// assemblées à la main. Ce test gardait auparavant l'écart que j'avais choisi
// entre la pastille et le mot — j'en affichais 12 là où le fichier en
// prescrit 7. Le verrouillage rend la question sans objet : l'espacement est
// dans le dessin, plus dans le code.
//
// Reste à garder ce dont ce choix dépend : les deux fichiers, leur boîte
// commune, et le fait que le sombre soit la version transparente.
const racine = join(import.meta.dirname, "..");
const marque = (nom: string): string => join(racine, "public", "brand", nom);

const CLAIR = "lehno-verrouillage-horizontal.svg";
const SOMBRE = "lehno-verrouillage-horizontal-blanc.svg";

describe("verrouillage de la marque", () => {
  it.each([CLAIR, SOMBRE])("%s est servi par le site", (nom) => {
    expect(existsSync(marque(nom)), `manquant : public/brand/${nom}`).toBe(true);
  });

  // Les deux fichiers doivent partager leur boîte : sinon la bascule de thème
  // ferait sauter la marque d'un pixel à l'autre.
  it("les deux thèmes partagent la même boîte", () => {
    const boite = (nom: string): string => {
      const svg = readFileSync(marque(nom), "utf-8");
      return /viewBox="([^"]+)"/.exec(svg)?.[1] ?? "";
    };
    expect(boite(CLAIR)).toBe("0 0 519.75 168");
    expect(boite(SOMBRE)).toBe(boite(CLAIR));
  });

  // La notice du designer (images/verrouillages-sombres/LISEZ-MOI.md) impose
  // la version transparente en code : les variantes à plaque dessinent un
  // rectangle dès que le fond n'est pas exactement le leur.
  it("le fichier sombre est transparent, sans plaque de fond", () => {
    const svg = readFileSync(marque(SOMBRE), "utf-8");
    const plaques = [...svg.matchAll(/<rect[^>]*width="519\.75"/g)];
    expect(plaques, "une plaque pleine largeur trahit une variante à fond figé").toHaveLength(0);
  });

  // La pastille du thème sombre porte son propre violet : du blanc sur le
  // violet clair ne mesure que 2,96:1, d'où le h à l'encre.
  it("le fichier sombre emploie le violet du thème nuit", () => {
    const svg = readFileSync(marque(SOMBRE), "utf-8");
    expect(svg).toContain("#9C8BD8");
    expect(svg).toContain("#15131D");
  });

  it.each(["SiteHeader.tsx", "SiteFooter.tsx"])("%s emploie le verrouillage", (fichier) => {
    const src = readFileSync(join(racine, "components", "landing", fichier), "utf-8");
    expect(src).toContain("<Lockup");
    expect(src, "plus d'assemblage à la main").not.toMatch(/<BrandMark[\s\S]{0,120}<Wordmark/);
  });
});
