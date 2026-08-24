import type { ReactNode } from "react";

// Six variantes de la pastille (images/brand/README.md). Contrairement au
// logotype, chacune porte déjà sa propre plaque de fond (sauf « uneEncre »,
// signe seul) : elle se pose telle quelle sur n'importe quel arrière-plan, et
// le choix de variante est celui de l'appelant, pas celui du thème de la
// page — d'où l'absence de bascule automatique .si-clair/.si-sombre ici,
// contrairement à Wordmark.
export type VariantePastille = "violet" | "ronde" | "claire" | "encre" | "uneEncre";

const FICHIERS: Record<VariantePastille, string> = {
  violet: "/brand/lehno-icone-512.svg",
  ronde: "/brand/lehno-icone-ronde-512.svg",
  claire: "/brand/lehno-icone-claire-512.svg",
  encre: "/brand/lehno-icone-sombre-512.svg",
  uneEncre: "/brand/lehno-icone-une-encre-512.svg",
};

// Le signe ne descend jamais sous 28 px à l'écran (charte). En deçà, il n'existe
// pas de dessin de remplacement : la marque tient sur **un seul tracé**, et seul
// le trait s'épaissit aux paliers matriciels, jamais les empattements retirés
// (images/exports/favicon/README.md). Le palier distinct de 28 px a été supprimé
// de la charte, et la bascule qui le servait avec lui.
const TAILLE_MINIMALE = 28;

export function BrandMark(
  { variant = "violet", size = 40, alt = "Lehno" }:
  { variant?: VariantePastille; size?: number; alt?: string },
): ReactNode {
  if (size < TAILLE_MINIMALE) {
    throw new Error(`BrandMark : la pastille Lehno ne descend jamais sous ${TAILLE_MINIMALE} px (reçu ${size}).`);
  }


  return (
    <img
      src={FICHIERS[variant]}
      alt={alt}
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size }}
    />
  );
}
