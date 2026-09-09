import * as React from "react";

/**
 * Bandeau de message — quatre intentions, angles droits, sans bordure ni ombre.
 * @startingPoint section="Feedback" subtitle="Information, succès, avertissement, erreur — clair et sombre" viewport="700x280"
 */
export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** info porte le violet de la marque : c'est le produit qui s'adresse à vous. */
  intent?: "info" | "success" | "warning" | "error";
  /** À ne fournir que si le message survit au changement d'écran. */
  onDismiss?: () => void;
}

export declare function Banner(props: BannerProps): React.ReactElement;
