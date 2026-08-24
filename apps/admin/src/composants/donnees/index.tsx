// Les composants des pages de liste du back-office. La feuille est importée
// ici, à l'entrée du dossier : ces cinq composants ne posent en ligne que ce
// qui varie par instance, tout le reste — couleurs, états, requêtes de média —
// vit dans donnees.css, chargée par la feuille globale avec les autres.

export {
  DataTable,
  type DataTableProps,
  type Colonne,
  type LigneTableau,
  type EtatTri,
  type ActionLigne,
  type LibellesTableau,
} from "./DataTable.js";
export { Pagination, type PaginationProps, type LibellesPagination } from "./Pagination.js";
export { FilterBar, type FilterBarProps, type FiltreSelect } from "./FilterBar.js";
export { EmptyState, type EmptyStateProps } from "./EmptyState.js";
export { StatusPill, type StatusPillProps, type TonPastille } from "./StatusPill.js";
