import * as React from "react";

export interface NotificationBellProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Au-delà de 9, la pastille affiche « 9+ ». À 0, aucune pastille. */
  nonLus?: number;
  onOuvrir?: () => void;
}

export declare function NotificationBell(props: NotificationBellProps): React.ReactElement;
