import React from "react";

const SIZES = { s: 20, m: 34, l: 76 };

/** Le décompte. Deux formes, un seul composant : le grand chiffre en Fraunces,
 *  et la pilule abricot du jour même.
 *
 *  **Le composant ne fabrique pas le texte.** La notation du décompte n'est pas
 *  arrêtée — elle passe par un test utilisateur, et une forme cuite ici figerait
 *  une décision qui n'est pas prise. `label` arrive du dictionnaire ; `today`
 *  choisit la forme. */
export function Countdown({ label, today = false, size = "m", style, ...rest }) {
  const px = SIZES[size] || SIZES.m;

  if (today) {
    return (
      <span
        style={{
          display: "inline-flex", alignItems: "center", fontFamily: "var(--font-body)",
          fontSize: Math.max(12, Math.round(px * 0.36)), fontWeight: "var(--font-body-semibold)",
          background: "var(--celebrate)", color: "var(--on-celebrate)",
          padding: "5px 11px", borderRadius: "var(--radius-pill)", ...style
        }}
        {...rest}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      style={{
        fontFamily: "var(--font-display)", fontVariationSettings: "var(--font-display-settings)",
        fontWeight: "var(--font-display-regular)", fontSize: px, lineHeight: 0.95,
        letterSpacing: "var(--tracking-display)", color: "var(--text-accent)",
        whiteSpace: "nowrap", ...style
      }}
      {...rest}
    >
      {label}
    </span>
  );
}
