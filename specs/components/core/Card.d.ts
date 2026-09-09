import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** card — fond de carte + bordure. panel — aplat lilas, sans bordure. plain — bordure seule. */
  surface?: "card" | "panel" | "plain";
  padding?: number | string;
  radius?: "lg" | "xl" | "2xl";
}

export declare function Card(props: CardProps): React.ReactElement;
