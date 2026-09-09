import * as React from "react";

export interface CountdownProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Le texte du décompte, écrit par le dictionnaire. Le composant ne le fabrique
   *  pas : la notation n'est pas arrêtée, elle passe par un test utilisateur. */
  label: string;
  /** Bascule sur la pilule abricot du jour même. */
  today?: boolean;
  /** s 20px (ligne de liste) · m 34px (carte) · l 76px (vue d'échéance). */
  size?: "s" | "m" | "l";
}

export declare function Countdown(props: CountdownProps): React.ReactElement;
