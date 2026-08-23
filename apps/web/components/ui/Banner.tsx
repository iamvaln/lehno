import { Icon } from "./Icon.js";
import type { CSSProperties, HTMLAttributes, ReactElement, ReactNode } from "react";

export type BannerIntent = "info" | "success" | "warning" | "error";

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  /** info porte le violet de la marque : c'est le produit qui s'adresse à vous. */
  intent?: BannerIntent;
  /** À ne fournir que si le message survit au changement d'écran. */
  onDismiss?: () => void;
}

// Une paire de jetons par intention : le texte, puis le fond teinté.
// L'abricot n'apparaît jamais ici — il célèbre, il n'avertit pas — et parmi
// ces quatre bandeaux, seul celui d'erreur porte le rouge.
const INTENTIONS: Record<BannerIntent, { fg: string; bg: string }> = {
  info: { fg: "var(--feedback-info)", bg: "var(--feedback-info-bg)" },
  success: { fg: "var(--feedback-success)", bg: "var(--feedback-success-bg)" },
  warning: { fg: "var(--feedback-warning)", bg: "var(--feedback-warning-bg)" },
  error: { fg: "var(--feedback-error)", bg: "var(--feedback-error-bg)" },
};

// Les glyphes du bandeau : un remplacement autonome en attendant le composant
// Chaque intention porte son glyphe Lucide, servi par Icon : les tracés ne se
// recopient pas, sinon ils divergent de la bibliothèque à la première retouche.
const GLYPHES: Record<BannerIntent, string> = {
  info: "info",
  success: "circle-check",
  warning: "triangle-alert",
  error: "circle-x",
};

// Le bandeau : une bande, pas une carte. Angles droits, sans bordure ni
// ombre, quatre intentions. L'erreur s'annonce en `alert` — un message qui ne
// se signale pas n'existe pas pour qui n'y regarde pas ; les trois autres
// restent en `status`, moins pressants.
export function Banner(
  { children, intent = "info", onDismiss, style, ...rest }: BannerProps,
): ReactElement {
  const { fg, bg } = INTENTIONS[intent];

  const styleBandeau: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "var(--space-10)",
    background: bg,
    color: fg,
    padding: "var(--space-12) var(--space-14)",
    borderRadius: 0,
    border: "none",
    boxShadow: "none",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-body-xs)",
    lineHeight: "var(--leading-body)",
    ...style,
  };

  return (
    <div role={intent === "error" ? "alert" : "status"} style={styleBandeau} {...rest}>
      <Icon name={GLYPHES[intent]} size={17} style={{ flex: "none", marginTop: "1px" }} aria-hidden="true" />
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer"
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            color: "inherit", flex: "none",
          }}
        >
          <Icon name="x" size={15} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
