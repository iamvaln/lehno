import * as React from "react";

/**
 * Un écran sans contenu — traité comme du contenu, pas comme un accident.
 * @startingPoint section="Feedback" subtitle="Les textes annoncent ce qui est possible, jamais ce qui manque" viewport="380x340"
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Le nom d'une illustration — c'est la voie normale : ces écrans sont
   * précisément ceux que le brief d'illustrations couvre.
   */
  illustration?: string;
  /** Nom Lucide, en violet. Repli quand aucune illustration n'existe encore. */
  icone?: string;
  /** Une phrase qui dit ce qui est possible. Jamais « aucun », « vide », « rien ». */
  titre: string;
  texte?: string;
  /** Le libellé de la seule action offerte. */
  action?: string;
  onAction?: () => void;
}

export declare function EmptyState(props: EmptyStateProps): React.ReactElement;
