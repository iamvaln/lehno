import * as React from "react";

/**
 * Bouton Lehno — trois rangs, jamais plus sur un même écran.
 * @startingPoint section="Core" subtitle="Les trois rangs, web et mobile, sur les deux thèmes" viewport="700x300"
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  children: React.ReactNode;
  /**
   * primary — l'action qui fait avancer. **Un seul par vue.**
   * outline — l'alternative. text — les actions de service.
   * destructive / destructive-outline — supprimer, révoquer. neutral — reporter, annuler.
   */
  variant?: "primary" | "outline" | "text" | "destructive" | "destructive-outline" | "neutral";
  /** web : hauteur 40 px, texte 15 px, rayon 10. mobile : 48 px mini, 16 px, rayon 12. */
  platform?: "web" | "mobile";
  /** Pleine largeur — usage mobile courant. */
  full?: boolean;
  /** Nom Lucide, avant le libellé. */
  icon?: string;
  /** Nom Lucide, après le libellé. */
  iconAfter?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): React.ReactElement;
