import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** Ce qui est, ou ce qui devient possible — jamais « rien à afficher ». */
  titre: string;
  texte?: string;
  action?: ReactNode;
}

export function EmptyState({ titre, texte, action }: EmptyStateProps) {
  return (
    <div className="admin-vide">
      <div className="admin-vide-titre">{titre}</div>
      {texte ? <p className="admin-vide-texte">{texte}</p> : null}
      {action ? <div className="admin-vide-action">{action}</div> : null}
    </div>
  );
}
