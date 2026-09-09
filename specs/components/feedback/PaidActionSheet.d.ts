import * as React from "react";

/**
 * Le passage obligé de toute génération : coût, solde, résultat attendu.
 * @startingPoint section="Feedback" subtitle="Le coût annoncé avant toute génération" viewport="380x420"
 */
export interface PaidActionSheetProps extends React.HTMLAttributes<HTMLDivElement> {
  titre: string;
  /** Ce que l'utilisateur obtient — en une phrase, au concret. */
  resultat: string;
  cout?: number;
  solde?: number;
  /** Appelé quand le solde suffit. */
  onConfirmer?: () => void;
  /** Appelé quand il ne suffit pas — l'action principale devient « Recharger ». */
  onRecharger?: () => void;
  onAnnuler?: () => void;
}

export declare function PaidActionSheet(props: PaidActionSheetProps): React.ReactElement;
