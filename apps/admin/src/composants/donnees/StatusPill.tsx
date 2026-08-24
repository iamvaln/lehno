import type { ReactNode } from "react";

/** actif = vert · attente = ambre · arrete = rouge · info = violet · neutre = gris. */
export type TonPastille = "neutre" | "actif" | "attente" | "arrete" | "info";

export interface StatusPillProps {
  children: ReactNode;
  ton?: TonPastille;
}

// Le ton descend en attribut : la teinte se décide dans la feuille, où elle
// peut différer entre le thème clair et le thème sombre sans que le composant
// ait à connaître un seul jeton de couleur.
export function StatusPill({ children, ton = "neutre" }: StatusPillProps) {
  return (
    <span className="admin-pastille" data-ton={ton}>
      <span className="admin-pastille-point" aria-hidden="true" />
      {children}
    </span>
  );
}
