import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon.js";

export type BoutonRang = "primary" | "outline" | "text" | "destructive" | "destructive-outline" | "neutral";
export type BoutonPlateforme = "web" | "mobile";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  children: ReactNode;
  /**
   * primary — l'action qui fait avancer. Un seul par vue.
   * outline — l'alternative. text — les actions de service.
   * destructive / destructive-outline — supprimer, révoquer. neutral — reporter, annuler.
   */
  variant?: BoutonRang;
  /** web : hauteur 40 px, texte 15 px, rayon --radius-sm. mobile : --touch-min mini, 16 px, --radius-md. */
  platform?: BoutonPlateforme;
  /** Pleine largeur — usage mobile courant. */
  full?: boolean;
  /** Nom Lucide, avant le libellé. */
  icon?: string;
  /** Nom Lucide, après le libellé. */
  iconAfter?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

// Pas de jeton "transition-state" tout fait : on recompose la durée et la
// courbe d'état sur chaque propriété qui bascule au survol ou à l'appui. Les
// valeurs de ces propriétés au survol, à l'appui et à l'arrêt sont posées en
// CSS (app/composants.css, classe .lehno-bouton) — un style en ligne ne peut
// pas porter :hover ni :active ; seule la transition, elle, le peut.
const ETAT = "var(--duration-state) var(--ease-state)";
const TRANSITION_ETAT = [
  `background ${ETAT}`,
  `color ${ETAT}`,
  `border-color ${ETAT}`,
  `border-width ${ETAT}`,
  `opacity ${ETAT}`,
].join(", ");

const RANGS: Record<BoutonRang, CSSProperties> = {
  primary: {
    background: "var(--action)",
    color: "var(--text-on-accent)",
    border: "var(--border-width) solid transparent",
  },
  outline: {
    background: "transparent",
    color: "var(--text-accent)",
    border: "var(--border-width) solid var(--action-edge)",
  },
  text: {
    background: "transparent",
    color: "var(--text-accent)",
    border: "var(--border-width) solid transparent",
  },
  destructive: {
    background: "var(--feedback-error)",
    color: "var(--surface-page)",
    border: "var(--border-width) solid transparent",
  },
  "destructive-outline": {
    background: "transparent",
    color: "var(--feedback-error)",
    border: "var(--border-width) solid var(--feedback-error)",
  },
  neutral: {
    background: "var(--action-quiet-bg)",
    color: "var(--text-accent)",
    border: "var(--border-width) solid transparent",
  },
};

export function Button({
  children,
  variant = "primary",
  platform = "web",
  full = false,
  icon,
  iconAfter,
  disabled = false,
  type = "button",
  style,
  ...rest
}: ButtonProps) {
  const mobile = platform === "mobile";
  const rang = RANGS[variant] ?? RANGS.primary;

  const base: CSSProperties = {
    display: full ? "flex" : "inline-flex",
    width: full ? "100%" : "auto",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-8)",
    boxSizing: "border-box",
    fontFamily: "var(--font-body)",
    fontWeight: "var(--font-body-semibold)",
    fontSize: mobile ? "var(--text-body-m)" : "var(--text-body-s)",
    lineHeight: "var(--leading-title)",
    minHeight: mobile ? "var(--touch-min)" : "var(--control-height)",
    padding: `0 var(--control-pad-x)`,
    borderRadius: mobile ? "var(--radius-md)" : "var(--radius-sm)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.45 : 1,
    transition: TRANSITION_ETAT,
    ...rang,
    ...style,
  };

  return (
    // data-rang porte le rang jusqu'au CSS (app/composants.css) : le survol
    // et l'appui s'y déclinent par rang, ce qu'un style en ligne ne peut pas
    // exprimer. className vient après {...rest} : un consommateur ne peut
    // pas l'écraser et priver le bouton de sa réaction au geste.
    <button type={type} disabled={disabled} data-rang={variant} style={base} {...rest} className="lehno-bouton">
      {icon ? <Icon name={icon} size={mobile ? 18 : 17} /> : null}
      <span>{children}</span>
      {iconAfter ? <Icon name={iconAfter} size={mobile ? 18 : 17} /> : null}
    </button>
  );
}
