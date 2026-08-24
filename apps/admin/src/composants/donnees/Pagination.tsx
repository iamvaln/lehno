import { Icon } from "../base/Icon.js";

export interface LibellesPagination {
  precedent: string;
  suivant: string;
  /** Étiquette du sélecteur de taille ; requis dès que `onParPage` est fourni. */
  parPage?: string;
  /** Nom accessible du groupe de navigation. */
  pagination?: string;
}

export interface PaginationProps {
  /** Curseur de la page suivante rendu par l'API. Absent ou nul : on a tout lu. */
  curseurSuivant?: string | null;
  /** Vrai dès qu'une page a déjà été quittée — la page tient cet historique. */
  aPrecedent?: boolean;
  onPrecedent: () => void;
  onSuivant: () => void;
  parPage?: number;
  /** Passer `onParPage` fait apparaître le sélecteur de taille. */
  onParPage?: (parPage: number) => void;
  tailles?: number[];
  libelles: LibellesPagination;
}

/** Sous un tableau de liste, jamais ailleurs.
 *
 *  Parcours **au curseur** : deux sens, aucun total, aucun numéro de page. Les
 *  listes de l'API se lisent par `limit` + `cursor`, et la réponse rend les
 *  éléments avec le curseur suivant — jamais un décompte. Afficher « 1–25 sur
 *  312 » exigerait un comptage que le serveur ne fait pas, et qui serait faux
 *  dès que les données bougent entre deux pages. */
export function Pagination({
  curseurSuivant,
  aPrecedent = false,
  onPrecedent,
  onSuivant,
  parPage,
  onParPage,
  tailles = [10, 25, 50],
  libelles,
}: PaginationProps) {
  return (
    <nav className="admin-pagination" aria-label={libelles.pagination}>
      {onParPage ? (
        <label className="admin-pagination-taille">
          {libelles.parPage}
          <select
            className="admin-champ admin-focus"
            value={parPage}
            onChange={(e) => onParPage(Number(e.target.value))}
          >
            {tailles.map((taille) => (
              <option key={taille} value={taille}>
                {taille}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="admin-pagination-sens">
        <button
          type="button"
          className="admin-pagination-bouton admin-focus"
          onClick={onPrecedent}
          disabled={!aPrecedent}
        >
          <Icon name="chevron-left" size={15} />
          {libelles.precedent}
        </button>
        <button
          type="button"
          className="admin-pagination-bouton admin-focus"
          onClick={onSuivant}
          disabled={!curseurSuivant}
        >
          {libelles.suivant}
          <Icon name="chevron-right" size={15} />
        </button>
      </div>
    </nav>
  );
}
