export interface PageTab {
  id: string;
  label: string;
  /** Nombre d'éléments derrière l'onglet, quand il aide à choisir. */
  compte?: number;
}

export interface PageTabsProps {
  onglets: PageTab[];
  actif: string;
  onSelect: (id: string) => void;
}

/** Les faces d'une même section : les Configurations portent l'économie et les
 *  types d'événements, un compte porte ses murs, ses crédits, sa sécurité.
 *
 *  Ce n'est pas de la navigation — la section ne change pas, le fil d'Ariane ne
 *  bouge pas. Au-delà de trois ou quatre, ce sont des sections, et elles vont
 *  dans la barre latérale. */
export function PageTabs({ onglets, actif, onSelect }: PageTabsProps) {
  return (
    <div className="admin-onglets" role="tablist">
      {onglets.map((onglet) => {
        const courant = onglet.id === actif;
        return (
          <button
            key={onglet.id}
            type="button"
            role="tab"
            aria-selected={courant}
            data-actif={courant ? "true" : "false"}
            className="admin-onglet admin-focus"
            onClick={() => onSelect(onglet.id)}
          >
            <span>{onglet.label}</span>
            {onglet.compte != null ? (
              <span className="admin-onglet-compte">{onglet.compte}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
