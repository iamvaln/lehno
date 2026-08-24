import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark.js";

// Le verrouillage horizontal : la pastille et le mot dans un seul fichier,
// à l'espacement que le designer a dessiné. On assemblait auparavant deux
// images côte à côte avec un écart choisi à la main — c'est exactement ce
// qu'un verrouillage sert à empêcher, et l'écart était faux.
//
// Deux fichiers, un par thème, échangés par CSS (.si-clair / .si-sombre) et
// non par un effet React : le serveur ne connaît pas le thème, et un effet
// ferait scintiller à l'hydratation.
//
// Le fichier sombre est la version TRANSPARENTE, comme sa notice l'impose
// (images/verrouillages-sombres/LISEZ-MOI.md) : les variantes à plaque
// existent pour les supports où le fond est figé, et posées sur une surface
// qui n'est pas exactement la leur, elles dessinent un rectangle.
const BOITE = { largeur: 519.75, hauteur: 168 };

const FICHIERS = {
  clair: "/brand/lehno-verrouillage-horizontal.svg",
  sombre: "/brand/lehno-verrouillage-horizontal-blanc.svg",
} as const;

export interface LockupProps {
  /** Hauteur du verrouillage en pixels ; la largeur suit la boîte du fichier. */
  height?: number;
  /** Taille de la pastille seule, sous le seuil de repli. */
  markSize?: number;
  alt?: string;
}

export function Lockup({ height = 34, markSize = 30, alt = "Lehno" }: LockupProps): ReactNode {
  const largeur = Math.round((height * BOITE.largeur) / BOITE.hauteur);

  return (
    <>
      {/* Sous 920px, la place manque pour le mot : la pastille reste seule.
          Un verrouillage est une image unique, on ne peut pas en masquer la
          moitié — d'où l'échange, et non un simple display:none. */}
      <span className="marque-verrouillage" style={{ lineHeight: 0 }}>
        <img
          className="si-clair"
          src={FICHIERS.clair}
          alt={alt}
          width={largeur}
          height={height}
          // Pas de « display » ici : .si-clair / .si-sombre le pilotent, et un
          // style en ligne l'emporterait sur elles — les deux thèmes se seraient
          // alors affichés l'un sous l'autre.
          style={{ width: largeur, height }}
        />
        <img
          className="si-sombre"
          src={FICHIERS.sombre}
          alt={alt}
          width={largeur}
          height={height}
          // Pas de « display » ici : .si-clair / .si-sombre le pilotent, et un
          // style en ligne l'emporterait sur elles — les deux thèmes se seraient
          // alors affichés l'un sous l'autre.
          style={{ width: largeur, height }}
        />
      </span>
      <span className="marque-pastille" style={{ lineHeight: 0 }}>
        <BrandMark size={markSize} alt={alt} />
      </span>
    </>
  );
}
