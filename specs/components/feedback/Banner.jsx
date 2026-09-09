import React from "react";
import { Icon } from "../core/Icon.jsx";

const INTENTS = {
  info:    { fg: "var(--feedback-info)",    bg: "var(--feedback-info-bg)",    icon: "info" },
  success: { fg: "var(--feedback-success)", bg: "var(--feedback-success-bg)", icon: "circle-check" },
  warning: { fg: "var(--feedback-warning)", bg: "var(--feedback-warning-bg)", icon: "triangle-alert" },
  error:   { fg: "var(--feedback-error)",   bg: "var(--feedback-error-bg)",   icon: "circle-x" }
};

export function Banner({ children, intent = "info", onDismiss, style, ...rest }) {
  const t = INTENTS[intent] || INTENTS.info;
  return (
    <div
      role={intent === "error" ? "alert" : "status"}
      style={{
        display: "flex", alignItems: "flex-start", gap: "10px",
        background: t.bg, color: t.fg,
        padding: "12px 14px", borderRadius: 0, border: "none", boxShadow: "none",
        fontFamily: "var(--font-body)", fontSize: "var(--text-body-xs)", lineHeight: 1.45,
        ...style
      }}
      {...rest}
    >
      <Icon name={t.icon} size={17} style={{ marginTop: "1px" }} />
      <span style={{ flex: 1 }}>{children}</span>
      {onDismiss ? (
        <button
          type="button" onClick={onDismiss} aria-label="Fermer" className="lehno-focusable"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", flex: "none" }}
        >
          <Icon name="x" size={15} />
        </button>
      ) : null}
    </div>
  );
}
