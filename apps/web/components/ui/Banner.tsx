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
// Icon partagé, écrit par une tâche parallèle absente de ce chantier — voir
// le rapport de tâche 7. Traits en currentColor : la couleur vient du texte
// qu'ils accompagnent, jamais d'une propriété propre.
const GLYPHES: Record<BannerIntent, ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </>
  ),
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 3 20h18Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9.5 9.5 5 5" />
      <path d="m14.5 9.5-5 5" />
    </>
  ),
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
      <svg
        width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        style={{ flex: "none", marginTop: "1px" }}
      >
        {GLYPHES[intent]}
      </svg>
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
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
