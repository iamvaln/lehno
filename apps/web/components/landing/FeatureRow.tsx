import type { ReactNode } from "react";

/** Une station de contenu : titre + texte d'un côté, illustration de l'autre.
 *  Les stations alternent blanc / lilas — c'est cette alternance qui rythme
 *  la page, pas des filets. */
export function FeatureRow(
  { id, titre, texte, panel = false, inverse = false, children, extra }: {
    id?: string;
    titre: ReactNode;
    texte: ReactNode;
    panel?: boolean;
    inverse?: boolean;
    children: ReactNode;
    extra?: ReactNode;
  },
): ReactNode {
  return (
    <section id={id} style={{ background: panel ? "var(--surface-panel)" : "var(--surface-page)" }}>
      <div style={{ maxWidth: "var(--page-max)", margin: "0 auto", padding: "var(--section-pad-y) var(--page-gutter)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "center" }}>
          <div style={{ minWidth: 0, order: inverse ? 2 : 1 }}>
            <h2
              className="titre"
              style={{
                fontWeight: "var(--font-display-medium)", fontSize: "clamp(28px,4vw,38px)",
                letterSpacing: "var(--tracking-title)", lineHeight: "var(--leading-title)",
                margin: "0 0 var(--space-14)", textWrap: "balance",
              }}
            >
              {titre}
            </h2>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-body-l)", maxWidth: "var(--measure-tight)" }}>{texte}</p>
            {extra}
          </div>
          <div style={{ minWidth: 0, order: inverse ? 1 : 2, display: "flex", justifyContent: "center" }}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
