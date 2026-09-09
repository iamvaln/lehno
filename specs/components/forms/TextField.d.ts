import * as React from "react";

/**
 * Champ de saisie. **Ajout intentionnel** — la charte ne documente pas encore
 * les formulaires ; les valeurs reprennent celles observées sur la landing.
 */
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Aide sous le champ ; passe en rouge quand invalid. */
  hint?: string;
  multiline?: boolean;
  rows?: number;
  invalid?: boolean;
  /** État valide — bordure et aide en vert. Exclusif de `invalid`. */
  valide?: boolean;
  /** mobile force 16 px de texte (pas de zoom iOS) et 44 px de hauteur. */
  platform?: "web" | "mobile";
}

export declare function TextField(props: TextFieldProps): React.ReactElement;
