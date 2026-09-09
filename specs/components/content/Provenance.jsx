import React from "react";
import { Icon } from "../core/Icon.jsx";

export function Provenance({ origin, date, style, ...rest }) {
  const parts = [origin, date].filter(Boolean);
  if (!parts.length) return null;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "6px",
        marginTop: "10px", paddingTop: "8px", borderTop: "1px solid var(--border-hairline)",
        fontFamily: "var(--font-body)", fontSize: "var(--text-mention-s)",
        color: "var(--text-mention)", ...style
      }}
      {...rest}
    >
      <Icon name="corner-up-left" size={13} strokeWidth={2} />
      <span>{parts.join(" · ")}</span>
    </div>
  );
}
