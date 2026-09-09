import React from "react";

/** Le champ de saisie. Passer `options` en fait une liste : une valeur qui se
 *  choisit dans un ensemble fermé (un jour, un mois, une année) ne s'écrit pas —
 *  le champ garde son libellé, sa bordure, sa cible et son état d'erreur. */
export function TextField({
  label, hint, multiline = false, rows = 4, invalid = false, valide = false,
  platform = "web", options, id, style, ...rest
}) {
  const teinte = invalid ? "var(--feedback-error)" : valide ? "var(--feedback-success)" : null;
  const auto = React.useId ? React.useId() : "lehno-field";
  const fieldId = id || auto;
  const Tag = options ? "select" : multiline ? "textarea" : "input";

  return (
    <div style={{ display: "grid", gap: "6px", fontFamily: "var(--font-body)" }}>
      {label ? (
        <label htmlFor={fieldId} style={{ fontSize: "var(--text-body-xs)", color: "var(--text-secondary)" }}>
          {label}
        </label>
      ) : null}
      <Tag
        id={fieldId}
        rows={multiline ? rows : undefined}
        aria-invalid={invalid || undefined}
        className="lehno-focusable"
        style={{
          boxSizing: "border-box", width: "100%",
          fontFamily: "var(--font-body)", fontSize: platform === "mobile" ? "16px" : "var(--text-body-m)",
          color: "var(--text-body)", background: "var(--surface-card)",
          border: "1px solid " + (teinte || "var(--border-object)"),
          borderRadius: "var(--radius-sm)", padding: "14px 15px",
          minHeight: platform === "mobile" ? "var(--touch-min)" : undefined,
          resize: multiline ? "vertical" : undefined,
          lineHeight: multiline ? 1.5 : undefined,
          transition: "border-color var(--transition-state)",
          /* Le chevron est dessiné en fond : la flèche du système ne suit ni la
             couleur du texte ni le thème sombre. */
          /* Une liste étroite (un jour, une heure) n'a pas de place à perdre en
             gouttières : le chevron se rapproche et le retrait suit. */
          ...(options ? {
            appearance: "none", cursor: "pointer", padding: "14px 24px 14px 11px",
            backgroundImage: "linear-gradient(45deg, transparent 50%, currentColor 50%),"
              + "linear-gradient(135deg, currentColor 50%, transparent 50%)",
            backgroundPosition: "right 11px center, right 7px center",
            backgroundSize: "4.5px 4.5px, 4.5px 4.5px", backgroundRepeat: "no-repeat"
          } : null),
          ...style
        }}
        {...rest}
      >
        {options ? options.map((o) => {
          const v = typeof o === "object" ? o.value : o;
          const l = typeof o === "object" ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        }) : null}
      </Tag>
      {hint ? (
        <div style={{ fontSize: "var(--text-mention-s)", color: teinte || "var(--text-mention)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
