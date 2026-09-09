import * as React from "react";

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * liste — ossature de cartes, pour un chargement bref.
   * envoi — bandeau lilas discret, l'écran reste utilisable.
   * generation — l'attente longue : elle se **quitte sans rien perdre**.
   */
  variant?: "liste" | "envoi" | "generation";
  titre?: string;
  /** generation seulement. */
  texte?: string;
  /** generation : affiche « Continuer ailleurs ». À fournir — c'est la promesse du composant. */
  onQuitter?: () => void;
  /** liste : nombre d'ossatures. Défaut 3. */
  lignes?: number;
}

export declare function LoadingState(props: LoadingStateProps): React.ReactElement;
