import * as React from "react";

/**
 * Le logotype vectorisé.
 * @startingPoint section="Brand" subtitle="Logotype et pastille, clair et sombre" viewport="700x220"
 */
export interface WordmarkProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * couleur — usage courant, fond clair.
   * blanc — thème sombre, fond transparent, **même boîte que couleur**.
   * inverse — sur un aplat encre ; embarque sa plaque de fond.
   * uneEncre — monochrome, gravure, tampon.
   */
  variant?: "couleur" | "blanc" | "inverse" | "uneEncre";
  /** Hauteur en px. Minimum 96 px de large, soit ~31 px de haut. */
  height?: number;
  /** Préfixe de chemin si la page n'est pas à la racine, ex. "../../". */
  base?: string;
}

export declare function Wordmark(props: WordmarkProps): React.ReactElement;
