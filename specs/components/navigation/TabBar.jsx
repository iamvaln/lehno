import React from "react";
import { Icon } from "../core/Icon.jsx";

/** La barre d'onglets. Elle tient à trois comme à cinq : aucune largeur figée,
 *  les colonnes se partagent l'espace, et le libellé se resserre plutôt que de
 *  déborder. Un onglet éteint par un drapeau disparaît — la barre ne le remplace
 *  pas, elle se redistribue.
 *
 *  **Aucun libellé par défaut.** Une liste écrite ici serait intraduisible :
 *  `tabs` porte le texte, qui vient du dictionnaire de l'application.
 *
 *  L'onglet ouvert se signale deux fois : la couleur, et un aplat sous son
 *  icône. La couleur seule est un signal faible à 11 px — et invisible pour
 *  qui ne la distingue pas. */
export function TabBar({ tabs = [], active, onSelect, style, ...rest }) {
  if (!tabs.length) return null;
  /* À cinq onglets, l'appareil le plus étroit donne 64 px par colonne : le
     libellé descend d'un demi-point pour tenir sans être tronqué. */
  const serre = tabs.length > 4;

  return (
    <nav
      style={{
        display: "grid", gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
        borderTop: "1px solid var(--border-hairline)", background: "var(--surface-page)",
        fontFamily: "var(--font-body)", ...style
      }}
      {...rest}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={onSelect ? () => onSelect(t.id) : undefined}
            aria-current={on ? "page" : undefined}
            className="lehno-focusable"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
              minWidth: 0, background: "none", border: "none", cursor: "pointer",
              minHeight: "var(--touch-min)", padding: serre ? "9px 2px 10px" : "9px 4px 10px",
              color: on ? "var(--text-accent)" : "var(--text-mention)",
              fontFamily: "var(--font-body)",
              fontSize: serre ? "var(--text-tab-serre)" : "var(--text-tab)",
              fontWeight: on ? "var(--font-body-semibold)" : "var(--font-body-regular)",
              transition: "color var(--transition-state)"
            }}
          >
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: serre ? 38 : 44, height: 24, borderRadius: "var(--radius-pill)",
              background: on ? "color-mix(in oklab, var(--action) 12%, transparent)" : "transparent",
              transition: "background var(--transition-state)"
            }}>
              <Icon name={t.icon} size={20} />
            </span>
            <span style={{
              maxWidth: "100%", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap"
            }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
