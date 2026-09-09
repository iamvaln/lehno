import React from "react";
import { Button } from "../core/Button.jsx";

/** L'attente. Trois familles, et une seule règle commune : on ne fait jamais
 *  patienter sans dire sur quoi. */
export function LoadingState({ variant = "liste", titre, texte, onQuitter, lignes = 3, style, ...rest }) {
  if (variant === "liste") {
    return (
      <div aria-busy="true" aria-live="polite" style={{ display: "grid", gap: 10, ...style }} {...rest}>
        <span className="lehno-sr">{titre || "Chargement"}</span>
        {Array.from({ length: lignes }).map((_, i) => (
          <div key={i} style={{
            border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-lg)",
            padding: 15, display: "grid", gap: 8
          }}>
            <div className="lehno-pouls" style={{ height: 15, width: "42%", borderRadius: 4 }} />
            <div className="lehno-pouls" style={{ height: 12, width: "64%", borderRadius: 4 }} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "envoi") {
    return (
      <div aria-busy="true" aria-live="polite" style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
        background: "var(--surface-panel)", color: "var(--text-accent)",
        fontFamily: "var(--font-body)", fontSize: "var(--text-body-xs)", ...style
      }} {...rest}>
        <span className="lehno-tourne" style={{
          width: 15, height: 15, borderRadius: "50%",
          border: "2px solid currentColor", borderTopColor: "transparent", flex: "none"
        }} />
        <span>{titre || "Envoi en cours"}</span>
      </div>
    );
  }

  // variant === "generation" — l'attente longue, que l'on peut quitter
  return (
    <div aria-busy="true" aria-live="polite" style={{
      display: "grid", justifyItems: "center", textAlign: "center", padding: "40px 24px",
      fontFamily: "var(--font-body)", ...style
    }} {...rest}>
      <span className="lehno-tourne" style={{
        width: 26, height: 26, borderRadius: "50%", color: "var(--text-accent)",
        border: "2.5px solid currentColor", borderTopColor: "transparent", marginBottom: 18
      }} />
      <h2 className="lehno-display" style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>
        {titre || "Lehno écrit"}
      </h2>
      <p style={{
        margin: "8px 0 0", fontSize: 14.5, color: "var(--text-secondary)",
        maxWidth: "32ch", lineHeight: 1.5, textWrap: "pretty"
      }}>
        {texte || "Une trentaine de secondes. Vous pouvez fermer cet écran — vous retrouverez le résultat dans vos reprises."}
      </p>
      {onQuitter ? (
        <Button platform="mobile" variant="text" onClick={onQuitter} style={{ marginTop: 18 }}>
          Continuer ailleurs
        </Button>
      ) : null}
    </div>
  );
}
