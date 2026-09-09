import * as React from "react";

export interface CreditIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Le solde. Omis, seul le coût s'affiche. */
  solde?: number;
  /** Le coût de l'action à venir. Omis, seul le solde s'affiche. */
  cout?: number;
  /** inline — sous une action payante. solde — le chiffre, en Fraunces. */
  variant?: "inline" | "solde";
  /** Rend la mention cliquable vers la recharge. À fournir partout où un solde
   *  s'affiche : on peut vouloir recharger avant d'être bloqué. */
  onRecharger?: () => void;
  /** Après l'action : « 1 crédit dépensé · il vous en reste 3 ». Remplace `cout`. */
  depense?: number;
}

export declare function CreditIndicator(props: CreditIndicatorProps): React.ReactElement;
