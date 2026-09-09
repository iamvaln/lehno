import * as React from "react";

/**
 * Un moment grave — anniversaire de décès, date qui fait mal.
 * Sans icône et sans texte par défaut, par décision de ton : le produit
 * constate la date et se taît. Sa présence retire l'abricot, les idées de
 * cadeau et toute génération enjouée de l'écran.
 */
export interface SensitiveBannerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** La date qui approche, et rien de plus. « Le 14 mars approche. » */
  children: React.ReactNode;
}

export declare function SensitiveBanner(props: SensitiveBannerProps): React.ReactElement;
