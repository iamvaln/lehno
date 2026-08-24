import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Le fichier de verrouillage porte l'espacement que le designer a dessiné
// entre la pastille et le mot. On ne l'emploie pas tel quel — il n'en existe
// pas de version sombre, et l'en-tête masque le mot sous 920px, ce qu'une
// image unique ne sait pas faire — mais on lui emprunte sa proportion.
//
// Sans ce test, rien ne relierait le nombre écrit dans SiteHeader.tsx au
// fichier qui le justifie : j'affichais 12px là où le verrouillage en
// prescrit 7, soit près du double.
const racine = join(import.meta.dirname, "..");

function ratioDuVerrouillage(): number {
  const svg = readFileSync(join(racine, "public", "brand", "lehno-verrouillage-horizontal.svg"), "utf-8");
  const pastille = Number(/<rect[^>]*width="([\d.]+)"/.exec(svg)?.[1]);
  const debutDuMot = [...svg.matchAll(/translate\((-?[\d.]+)/g)]
    .map((m) => Number(m[1]))
    .filter((x) => x > pastille)
    .sort((a, b) => a - b)[0]!;
  return (debutDuMot - pastille) / pastille;
}

const ecartEmploye = (fichier: string): { taille: number; gap: number } => {
  const src = readFileSync(join(racine, "components", "landing", fichier), "utf-8");
  return {
    taille: Number(/<BrandMark size=\{(\d+)\}/.exec(src)?.[1]),
    gap: Number(/alignItems: "center", gap: (\d+)/.exec(src)?.[1]),
  };
};

describe("verrouillage de la marque", () => {
  it("le fichier prescrit une proportion lisible", () => {
    expect(ratioDuVerrouillage()).toBeCloseTo(0.224, 2);
  });

  it.each(["SiteHeader.tsx", "SiteFooter.tsx"])(
    "%s espace la marque comme le verrouillage",
    (fichier) => {
      const { taille, gap } = ecartEmploye(fichier);
      expect(taille, "taille de pastille introuvable").toBeGreaterThan(0);
      expect(
        gap,
        `pour une pastille de ${taille}, le verrouillage donne ${Math.round(taille * ratioDuVerrouillage())}`,
      ).toBe(Math.round(taille * ratioDuVerrouillage()));
    },
  );
});
