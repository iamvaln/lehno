import * as React from "react";

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  /** Nom Lucide en kebab-case : "calendar", "chevron-right", "corner-up-left". */
  name: string;
  /** Paliers de la charte : 28 / 20 / 17 / 15. Défaut 20. */
  size?: number;
  /** Défaut : 2 sous 16 px et pour les chevrons, 1,8 sinon. Ne pas forcer sans raison. */
  strokeWidth?: number;
  /** Défaut currentColor — une icône prend la couleur du texte qu'elle accompagne. */
  color?: string;
}

export declare function Icon(props: IconProps): React.ReactElement;
