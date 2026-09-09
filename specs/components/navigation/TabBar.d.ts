import * as React from "react";

export interface TabBarTab {
  id: string;
  /** Le libellé, depuis le dictionnaire. Aucun défaut : une liste écrite dans le
   *  composant serait intraduisible. */
  label: string;
  /** Nom Lucide. */
  icon: string;
}

export interface TabBarProps extends React.HTMLAttributes<HTMLElement> {
  /** De trois à cinq onglets. Un onglet éteint par un drapeau n'est pas passé :
   *  la barre se redistribue au lieu de garder un trou. */
  tabs: TabBarTab[];
  active?: string;
  onSelect?: (id: string) => void;
}

export declare function TabBar(props: TabBarProps): React.ReactElement;
