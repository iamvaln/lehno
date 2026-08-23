import type { ReactNode } from "react";

// Quatre variantes du logotype (images/brand/README.md). Le mot s'écrit en
// entier et le « h » porte le violet — Le·h·no.
export type VarianteLogotype = "couleur" | "blanc" | "inverse" | "uneEncre";

type Boite = { largeur: number; hauteur: number };

// Chaque fichier est recadré au tracé. Couleur, blanc et uneEncre partagent
// la même boîte 703,98 × 226,2 : c'est ce qui permet de les permuter — la
// mise en page ne décale jamais. Inverse porte sa propre plaque encre (60
// unités de marge symétrique), sa boîte est donc différente : 823,98 × 346,2.
const BOITES: Record<VarianteLogotype, Boite> = {
  couleur: { largeur: 703.98, hauteur: 226.2 },
  blanc: { largeur: 703.98, hauteur: 226.2 },
  uneEncre: { largeur: 703.98, hauteur: 226.2 },
  inverse: { largeur: 823.98, hauteur: 346.2 },
};

const FICHIERS: Record<VarianteLogotype, string> = {
  couleur: "/brand/lehno-logotype-couleur.svg",
  blanc: "/brand/lehno-logotype-blanc.svg",
  inverse: "/brand/lehno-logotype-inverse.svg",
  uneEncre: "/brand/lehno-logotype-une-encre.svg",
};

function largeur(variant: VarianteLogotype, hauteur: number): number {
  const boite = BOITES[variant];
  return Math.round((hauteur / boite.hauteur) * boite.largeur);
}

export function Wordmark(
  { variant, height = 32, alt = "Lehno" }:
  { variant?: VarianteLogotype; height?: number; alt?: string },
): ReactNode {
  // Une variante explicite fige un seul fichier — usages hors thème de page :
  // impression, export, plaque figée sur un fond qu'on ne maîtrise pas.
  if (variant) {
    return (
      <img
        src={FICHIERS[variant]}
        alt={alt}
        width={largeur(variant, height)}
        height={height}
        style={{ display: "block", width: largeur(variant, height), height }}
      />
    );
  }

  // Sans variante, le mot bascule seul entre couleur et blanc selon le thème
  // — la classe lehno-nuit posée sur <body> (base.css .si-clair/.si-sombre) —
  // et non par un effet React : le serveur ne connaît pas le thème, un effet
  // ferait scintiller à l'hydratation. Couleur et blanc partagent la même
  // boîte : la permutation ne décale jamais la mise en page.
  return (
    <>
      <img
        className="si-clair"
        src={FICHIERS.couleur}
        alt={alt}
        width={largeur("couleur", height)}
        height={height}
        style={{ width: largeur("couleur", height), height }}
      />
      <img
        className="si-sombre"
        src={FICHIERS.blanc}
        alt={alt}
        width={largeur("blanc", height)}
        height={height}
        style={{ width: largeur("blanc", height), height }}
      />
    </>
  );
}
