import type { ReactNode } from "react";

export interface PageHeaderProps {
  titre: string;
  /** Ce que la page montre, en une ligne : « 1 284 comptes actifs ». */
  sous?: string;
  /** Les commandes de la page. **Une seule action pleine**, comme dans le
   *  produit : deux boutons de même rang ne disent plus lequel fait avancer. */
  actions?: ReactNode;
}

/** L'en-tête d'une page du back-office : de quoi il s'agit, et ce qu'on peut y
 *  faire. Le fil d'Ariane se pose au-dessus, les onglets en dessous. */
export function PageHeader({ titre, sous, actions }: PageHeaderProps) {
  return (
    <header className="admin-entete">
      <div className="admin-entete-dire">
        <h1 className="admin-entete-titre">{titre}</h1>
        {sous ? <p className="admin-entete-sous">{sous}</p> : null}
      </div>
      {actions ? <div className="admin-entete-actions">{actions}</div> : null}
    </header>
  );
}
