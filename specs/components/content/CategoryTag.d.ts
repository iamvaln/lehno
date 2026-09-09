import * as React from "react";

export interface CategoryTagProps extends React.HTMLAttributes<HTMLElement> {
  /** « À classer » se dessine en pointillé : c'est un état, pas un classement. */
  categorie?: "gout" | "idee" | "nogo" | "souvenir" | "aclasser";
  /** Dictionnaire de la page : `categories` porte les libellés, `reclasserAria` l'étiquette d'accès. */
  t?: { categories?: Record<string, string>; reclasserAria?: (libelle: string) => string };
  /**
   * Fourni, l'étiquette devient un bouton qui ouvre le reclassement : la pilule
   * reste compacte, la zone d'appui fait `--touch-min` (44 px).
   */
  onReclasser?: () => void;
}

export declare function CategoryTag(props: CategoryTagProps): React.ReactElement;
