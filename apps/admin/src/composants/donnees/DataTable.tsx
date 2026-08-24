import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "../base/Icon.js";

/** Toute ligne d'une liste d'administration porte l'identifiant de sa ressource :
 *  c'est lui qui sert de clé de rendu, de clé de sélection et d'argument aux
 *  actions. Les listes de l'API rendent des UUID. */
export interface LigneTableau {
  id: string;
}

export interface Colonne<L extends LigneTableau> {
  cle: string;
  titre: string;
  /** Rend la cellule autrement que par `ligne[cle]`. */
  rendu?: (ligne: L) => ReactNode;
  /** Colonne triable : l'en-tête devient un bouton et remonte `onTri(cle)`. */
  triable?: boolean;
  discret?: boolean;
  aligne?: "left" | "right" | "center";
  largeur?: number | string;
}

export interface EtatTri {
  cle: string;
  sens: "asc" | "desc";
}

export interface ActionLigne {
  id: string;
  label: string;
  danger?: boolean;
}

export interface LibellesTableau {
  toutSelectionner?: string;
  /** Gabarit : le composant y remplace `{nom}` par le nom de la ligne. */
  selectionner?: string;
  actions?: string;
}

export interface DataTableProps<L extends LigneTableau> {
  colonnes: Colonne<L>[];
  lignes: L[];
  /** Ligne cliquable — la colonne chevron apparaît. */
  onOuvrir?: (ligne: L) => void;
  /** Rendu quand `lignes` est vide (un `<EmptyState>`). */
  vide?: ReactNode;
  /** Tri courant. Le tableau n'ordonne pas : il affiche l'état et remonte le clic. */
  tri?: EtatTri;
  onTri?: (cle: string) => void;
  /** Sélection multiple : passer `onSelection` fait apparaître la colonne de cases. */
  selection?: string[];
  onSelection?: (ids: string[]) => void;
  /** Comment nommer une ligne dans l'étiquette de sa case. Défaut : son identifiant. */
  nom?: (ligne: L) => string;
  /** Actions par ligne, dans un menu en bout de ligne. */
  actions?: (ligne: L) => ActionLigne[];
  onAction?: (id: string, ligne: L) => void;
  libelles?: LibellesTableau;
}

// L'index par nom de colonne n'est pas exprimable sur un type générique : la
// colonne nomme un champ que seule la page connaît. La conversion est faite
// ici, une fois, plutôt que répandue dans le rendu.
function valeurBrute<L extends LigneTableau>(ligne: L, cle: string): ReactNode {
  return (ligne as unknown as Record<string, ReactNode>)[cle];
}

interface AncrageMenu {
  top: number;
  right: number;
}

/** Menu d'actions d'une ligne. Ferme au clic dehors, à Échap et au défilement.
 *  Le panneau est en position fixe : le tableau défile horizontalement, et un
 *  panneau absolu s'y trouverait rogné dès qu'il dépasse du cadre. */
function MenuLigne({
  items,
  onChoix,
  libelle,
}: {
  items: ActionLigne[];
  onChoix: (id: string) => void;
  // `exactOptionalPropertyTypes` distingue « absent » de « valant undefined » :
  // le libellé traverse le tableau depuis un dictionnaire partiel, il peut
  // donc bel et bien valoir undefined.
  libelle: string | undefined;
}) {
  const [ancrage, setAncrage] = useState<AncrageMenu | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ancrage) return;
    const fermer = () => setAncrage(null);
    const dehors = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (bouton.current?.contains(cible) || panneau.current?.contains(cible)) return;
      fermer();
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", echap);
    // En capture : le défilement qui compte est celui du cadre du tableau, pas
    // celui de la fenêtre, et il ne remonte pas jusqu'à elle.
    window.addEventListener("scroll", fermer, true);
    window.addEventListener("resize", fermer);
    return () => {
      document.removeEventListener("pointerdown", dehors);
      document.removeEventListener("keydown", echap);
      window.removeEventListener("scroll", fermer, true);
      window.removeEventListener("resize", fermer);
    };
  }, [ancrage]);

  const basculer = () => {
    if (ancrage) return setAncrage(null);
    const cadre = bouton.current?.getBoundingClientRect();
    if (!cadre) return;
    setAncrage({ top: cadre.bottom + 4, right: window.innerWidth - cadre.right });
  };

  return (
    <div className="admin-menu-ancre" onClick={(e) => e.stopPropagation()}>
      <button
        ref={bouton}
        type="button"
        className="admin-menu-bouton admin-focus"
        aria-label={libelle}
        aria-haspopup="menu"
        aria-expanded={ancrage !== null}
        onClick={basculer}
      >
        <Icon name="more-horizontal" size={17} />
      </button>
      {ancrage ? (
        <div ref={panneau} role="menu" className="admin-menu" style={ancrage}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="admin-menu-item admin-focus"
              data-danger={item.danger === true}
              onClick={() => {
                setAncrage(null);
                onChoix(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Le tableau des pages de liste.
 *
 *  Il **n'ordonne ni ne pagine** : il affiche les lignes qu'on lui donne, dans
 *  l'ordre où on les lui donne, montre l'état du tri courant et remonte
 *  `onTri(cle)`. C'est la page qui retrie, réinterroge et rend de nouvelles
 *  lignes. La pagination se pose dessous, avec `<Pagination>`. */
export function DataTable<L extends LigneTableau>({
  colonnes,
  lignes,
  onOuvrir,
  vide,
  tri,
  onTri,
  selection,
  onSelection,
  nom,
  actions,
  onAction,
  libelles = {},
}: DataTableProps<L>) {
  if (lignes.length === 0 && vide) return <>{vide}</>;

  const selectionnable = onSelection !== undefined;
  const ids = lignes.map((ligne) => ligne.id);
  const coches = selection ?? [];
  const toutCoche = ids.length > 0 && ids.every((id) => coches.includes(id));
  const partiel = !toutCoche && ids.some((id) => coches.includes(id));

  const basculerTout = () =>
    onSelection?.(
      toutCoche
        ? coches.filter((id) => !ids.includes(id))
        : [...new Set([...coches, ...ids])],
    );

  const basculer = (id: string) =>
    onSelection?.(coches.includes(id) ? coches.filter((x) => x !== id) : [...coches, id]);

  const etiquetteCase = (ligne: L) =>
    (libelles.selectionner ?? "").replace("{nom}", nom ? nom(ligne) : ligne.id);

  const ouvrirAuClavier = (e: React.KeyboardEvent<HTMLTableRowElement>, ligne: L) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onOuvrir?.(ligne);
  };

  return (
    <div className="admin-tableau-cadre">
      <div className="admin-tableau-defilement">
        <table className="admin-tableau">
          <thead>
            <tr className="admin-tableau-entete">
              {selectionnable ? (
                <th scope="col" className="admin-colonne-case">
                  <input
                    type="checkbox"
                    className="admin-case admin-focus"
                    checked={toutCoche}
                    ref={(el) => {
                      if (el) el.indeterminate = partiel;
                    }}
                    onChange={basculerTout}
                    aria-label={libelles.toutSelectionner}
                  />
                </th>
              ) : null}

              {colonnes.map((colonne) => {
                const actif = tri?.cle === colonne.cle;
                const style: CSSProperties = {
                  textAlign: colonne.aligne ?? "left",
                  width: colonne.largeur,
                };
                return (
                  <th
                    key={colonne.cle}
                    scope="col"
                    style={style}
                    aria-sort={
                      onTri ? (actif ? (tri.sens === "asc" ? "ascending" : "descending") : "none") : undefined
                    }
                  >
                    {colonne.triable && onTri ? (
                      <button
                        type="button"
                        className="admin-tri admin-focus"
                        data-actif={actif}
                        onClick={() => onTri(colonne.cle)}
                      >
                        {colonne.titre}
                        <Icon
                          name={actif && tri.sens === "desc" ? "chevron-down" : "chevron-up"}
                          size={13}
                        />
                      </button>
                    ) : (
                      colonne.titre
                    )}
                  </th>
                );
              })}

              {actions ? <th className="admin-colonne-actions" /> : null}
              {onOuvrir ? <th className="admin-colonne-chevron" /> : null}
            </tr>
          </thead>

          <tbody>
            {lignes.map((ligne) => {
              const coche = coches.includes(ligne.id);
              return (
                <tr
                  key={ligne.id}
                  className={onOuvrir ? "admin-ligne admin-focus" : "admin-ligne"}
                  data-cochee={coche}
                  data-ouvrable={onOuvrir !== undefined}
                  tabIndex={onOuvrir ? 0 : undefined}
                  onClick={onOuvrir ? () => onOuvrir(ligne) : undefined}
                  onKeyDown={onOuvrir ? (e) => ouvrirAuClavier(e, ligne) : undefined}
                >
                  {selectionnable ? (
                    <td className="admin-colonne-case" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="admin-case admin-focus"
                        checked={coche}
                        onChange={() => basculer(ligne.id)}
                        aria-label={etiquetteCase(ligne)}
                      />
                    </td>
                  ) : null}

                  {colonnes.map((colonne) => (
                    <td
                      key={colonne.cle}
                      className="admin-cellule"
                      data-discret={colonne.discret === true}
                      data-aligne={colonne.aligne ?? "left"}
                      style={{ textAlign: colonne.aligne ?? "left" }}
                    >
                      {colonne.rendu ? colonne.rendu(ligne) : valeurBrute(ligne, colonne.cle)}
                    </td>
                  ))}

                  {actions ? (
                    <td className="admin-cellule-actions">
                      <MenuLigne
                        items={actions(ligne)}
                        libelle={libelles.actions}
                        onChoix={(id) => onAction?.(id, ligne)}
                      />
                    </td>
                  ) : null}

                  {onOuvrir ? (
                    <td className="admin-cellule-chevron">
                      <Icon name="chevron-right" size={15} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
