import * as React from "react";

export interface ToastProps {
  children: React.ReactNode;
  /** success — l'action a eu lieu · info — neutre · error — elle a échoué. */
  intent?: "success" | "info" | "error";
  /** Sortie offerte par l'accusé : « Annuler », « Voir le compte ». */
  action?: string;
  onAction?: () => void;
  /** Sans onDismiss, le toast ne s'efface pas seul : à réserver aux erreurs. */
  onDismiss?: () => void;
  /** Millisecondes avant effacement. 0 le fige. */
  duree?: number;
}

export declare function Toast(props: ToastProps): React.ReactElement;
