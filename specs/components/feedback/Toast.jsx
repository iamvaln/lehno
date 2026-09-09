import React from "react";
import { Icon } from "../core/Icon.jsx";

const INTENTS = {
  success: { fg: "var(--feedback-success)", icon: "circle-check" },
  info:    { fg: "var(--feedback-info)",    icon: "info" },
  error:   { fg: "var(--feedback-error)",   icon: "circle-x" }
};

/** Accusé d'une action faite ailleurs que sur la page : le geste part d'une liste
 *  ou d'un dialogue, l'accusé apparaît en bas, s'efface seul, et laisse une sortie.
 *  `Banner` reste pour l'état d'une page — un toast ne se lit pas deux fois. */
export function Toast({ children, intent = "success", action, onAction, onDismiss, duree = 6000 }) {
  React.useEffect(() => {
    if (!onDismiss || !duree) return;
    const h = setTimeout(onDismiss, duree);
    return () => clearTimeout(h);
  }, [onDismiss, duree, children]);

  const t = INTENTS[intent] || INTENTS.success;
  return (
    <div role={intent === "error" ? "alert" : "status"} aria-live="polite"
      style={{
        position: "fixed", left: 20, bottom: 20, zIndex: 60,
        display: "flex", alignItems: "flex-start", gap: 10,
        maxWidth: 420, padding: "12px 14px",
        background: "var(--surface-inverse)", color: "var(--text-on-inverse)",
        border: "1px solid var(--border-inverse)",
        borderRadius: "var(--radius-md)", boxShadow: "none",
        fontFamily: "var(--font-body)", fontSize: "var(--text-body-xs)", lineHeight: 1.45
      }}>
      <Icon name={t.icon} size={17} style={{ marginTop: 1, color: t.fg, flex: "none" }} />
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {action ? (
        <button type="button" onClick={onAction} className="lehno-focusable"
          style={{
            all: "unset", cursor: "pointer", flex: "none", fontWeight: 600,
            color: "inherit", textDecoration: "underline", textUnderlineOffset: 2
          }}>{action}</button>
      ) : null}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Fermer" className="lehno-focusable"
          style={{ all: "unset", cursor: "pointer", flex: "none", color: "inherit", opacity: .7 }}>
          <Icon name="x" size={15} />
        </button>
      ) : null}
    </div>
  );
}
