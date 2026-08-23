import type { CSSProperties } from "react";
import { Icon } from "../base/Icon.js";
import { BrandMark } from "../base/BrandMark.js";

export interface SidebarItem {
  id: string;
  label: string;
  /** Nom Lucide. */
  icon: string;
  /** « alerte » pose un point : un délai court. Les chiffres restent au tableau de bord. */
  ton?: "alerte";
}

export interface SidebarFamille {
  /** Sans titre, la famille s'affiche sans en-tête : c'est la place du tableau de bord. */
  titre?: string | null;
  items: SidebarItem[];
}

export interface SidebarProps {
  /** Rangées par ce que l'administrateur vient faire : à traiter, finances, gestion, suivi, outils. */
  familles: SidebarFamille[];
  /** Nom de l'outil, à côté de la pastille. Il vient du dictionnaire, comme le reste. */
  marque: string;
  active?: string;
  onSelect?: (id: string) => void;
  /** Affiché en pastille — le rôle conditionne ce que l'interface expose. */
  role?: "support" | "admin";
}

// Le point d'alerte : six pixels, jamais un chiffre. Un compteur dans la
// navigation promet une exactitude qu'elle ne tient pas — les nombres sont au
// tableau de bord, où ils ont leur contexte. Ici, on dit seulement « il y a
// quelque chose ». La valeur est nommée parce que le test la vérifie.
const POINT_ALERTE = 6;

// La pastille de marque ne descend jamais sous 28 px (images/brand/README.md) :
// c'est le palier du favicon, dessiné pour cette taille.
const TAILLE_PASTILLE = 28;

const NAV: CSSProperties = { padding: "var(--space-14) var(--space-10) var(--space-24)" };

const ENTETE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-10)",
  padding: "0 var(--space-8) var(--space-16)",
};

const MARQUE: CSSProperties = {
  fontWeight: "var(--font-body-bold)",
  fontSize: "var(--text-body-m)",
  letterSpacing: "var(--tracking-title)",
};

const ROLE: CSSProperties = {
  marginLeft: "auto",
  fontSize: "var(--text-kicker)",
  fontWeight: "var(--font-body-bold)",
  letterSpacing: "var(--tracking-kicker)",
  textTransform: "uppercase",
  color: "var(--text-mention)",
  border: "var(--border-width) solid var(--border-object)",
  borderRadius: "var(--radius-pill)",
  padding: "var(--space-2) var(--space-6)",
};

const TITRE_FAMILLE: CSSProperties = {
  fontSize: "var(--text-kicker)",
  fontWeight: "var(--font-body-bold)",
  letterSpacing: "var(--tracking-kicker)",
  textTransform: "uppercase",
  color: "var(--text-mention)",
  padding: "0 var(--space-8) var(--space-6)",
};

const ETAT = "var(--duration-state) var(--ease-state)";

function styleItem(actif: boolean): CSSProperties {
  return {
    all: "unset",
    boxSizing: "border-box",
    cursor: "pointer",
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "var(--space-10)",
    padding: "var(--space-6) var(--space-8)",
    borderRadius: "var(--radius-sm)",
    marginBottom: "var(--space-2)",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-body-s)",
    fontWeight: actif ? "var(--font-body-semibold)" : "var(--font-body-regular)",
    background: actif ? "var(--action-quiet-bg)" : "transparent",
    color: actif ? "var(--text-accent)" : "var(--text-secondary)",
    transition: `background ${ETAT}, color ${ETAT}`,
  };
}

const POINT: CSSProperties = {
  flex: "0 0 auto",
  width: POINT_ALERTE,
  height: POINT_ALERTE,
  borderRadius: "var(--radius-pill)",
  background: "var(--feedback-error)",
};

// Navigation latérale. Une famille sans titre s'affiche sans en-tête : c'est
// ainsi que le tableau de bord se pose au-dessus des familles — c'est l'accueil,
// pas une tâche. L'ordre des familles est celui du tableau reçu : il porte une
// décision (à traiter d'abord, outils en dernier) qui appartient à l'appelant.
export function Sidebar({ familles, marque, active, onSelect, role }: SidebarProps) {
  return (
    <nav className="coquille-nav" style={NAV}>
      <div style={ENTETE}>
        <BrandMark size={TAILLE_PASTILLE} alt={marque} />
        <span style={MARQUE}>{marque}</span>
        {role ? <span className="coquille-role" style={ROLE}>{role}</span> : null}
      </div>

      {familles.map((famille, rang) => (
        <div
          key={famille.titre ?? `famille-${rang}`}
          className="coquille-famille"
          style={{ marginBottom: famille.titre ? "var(--space-16)" : "var(--space-10)" }}
        >
          {famille.titre ? (
            <div className="coquille-famille-titre" style={TITRE_FAMILLE}>{famille.titre}</div>
          ) : null}

          {famille.items.map((item) => {
            const actif = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                className="coquille-item"
                onClick={onSelect ? () => onSelect(item.id) : undefined}
                aria-current={actif ? "page" : undefined}
                style={styleItem(actif)}
              >
                <Icon name={item.icon} size={17} />
                <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                {item.ton === "alerte" ? (
                  <span data-ton="alerte" aria-hidden="true" style={POINT} />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
