import type { ReactNode } from "react";

// Six variantes de la pastille (images/brand/README.md). Contrairement au
// logotype, chacune porte déjà sa propre plaque de fond (sauf « uneEncre »,
// signe seul) : elle se pose telle quelle sur n'importe quel arrière-plan, et
// le choix de variante est celui de l'appelant, pas celui du thème de la
// page — d'où l'absence de bascule automatique .si-clair/.si-sombre ici,
// contrairement à Wordmark.
export type VariantePastille = "violet" | "ronde" | "claire" | "encre" | "uneEncre" | "favicon";

const FICHIERS: Record<VariantePastille, string> = {
  violet: "/brand/lehno-icone-512.svg",
  ronde: "/brand/lehno-icone-ronde-512.svg",
  claire: "/brand/lehno-icone-claire-512.svg",
  encre: "/brand/lehno-icone-sombre-512.svg",
  uneEncre: "/brand/lehno-icone-une-encre-512.svg",
  favicon: "/brand/lehno-favicon-28.svg",
};

// Le signe ne descend jamais sous 28 px à l'écran (charte, images/brand/README.md).
const TAILLE_MINIMALE = 28;

// Sous ce seuil, c'est le tracé épaissi du favicon qui sert — empattements
// retirés, contrepoinçons ouverts. Chaque palier est un dessin distinct : on
// ne le produit jamais en réduisant le grand tracé (images/brand/README.md).
const SEUIL_FAVICON = 40;

export function BrandMark(
  { variant = "violet", size = 40, alt = "Lehno" }:
  { variant?: VariantePastille; size?: number; alt?: string },
): ReactNode {
  if (size < TAILLE_MINIMALE) {
    throw new Error(`BrandMark : la pastille Lehno ne descend jamais sous ${TAILLE_MINIMALE} px (reçu ${size}).`);
  }

  const varianteResolue = size < SEUIL_FAVICON ? "favicon" : variant;

  return (
    <img
      src={FICHIERS[varianteResolue]}
      alt={alt}
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size }}
    />
  );
}
