import { Icon } from "../base/Icon.js";

export interface BreadcrumbItem {
  /** Cible remontée à onNavigate. Le dernier segment n'en a pas besoin. */
  id?: string;
  label: string;
}

export interface BreadcrumbProps {
  /** **La suite du chemin seulement** : la racine est posée par le composant. */
  items: BreadcrumbItem[];
  /** Libellé et cible de la racine — tout chemin part du tableau de bord. Elle
   *  est structurelle, mais son mot vient du dictionnaire : d'où la prop. */
  racine: BreadcrumbItem;
  onNavigate?: (id?: string) => void;
  /** Nom accessible du fil : plusieurs `nav` cohabitent dans la coquille. */
  libelle?: string;
}

/** Fil d'Ariane. Le dernier élément n'est pas un lien : on y est. */
export function Breadcrumb({ items, racine, onNavigate, libelle }: BreadcrumbProps) {
  const chemin = [racine, ...items];

  return (
    <nav className="admin-fil" aria-label={libelle}>
      {chemin.map((segment, rang) => {
        const dernier = rang === chemin.length - 1;
        return (
          <span className="admin-fil-segment" key={segment.id ?? rang}>
            {rang ? <Icon name="chevron-right" size={13} className="admin-fil-separateur" /> : null}
            {dernier ? (
              <span className="admin-fil-courant" aria-current="page">{segment.label}</span>
            ) : (
              <button
                type="button"
                className="admin-fil-lien admin-focus"
                onClick={onNavigate ? () => onNavigate(segment.id) : undefined}
              >
                {segment.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
