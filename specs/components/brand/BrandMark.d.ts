import * as React from "react";

export interface BrandMarkProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * violet — la pastille par défaut, valable sur fond clair **et** sombre.
   * ronde — avatar. claire — sur lilas. encre — sur un fond clair uniquement.
   * uneEncre — monochrome. favicon — tracé épaissi, sous 40 px.
   */
  variant?: "violet" | "ronde" | "claire" | "encre" | "uneEncre" | "favicon";
  /** Jamais sous 28 px. */
  size?: number;
  base?: string;
}

export declare function BrandMark(props: BrandMarkProps): React.ReactElement;
