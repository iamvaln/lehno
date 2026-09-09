import React from "react";

export function Tag({ children, tone = "outline", style, ...rest }) {
  const tones = {
    outline: { border: "1px solid var(--border-object)", background: "transparent", color: "var(--text-body)" },
    quiet:   { border: "1px solid transparent", background: "var(--action-quiet-bg)", color: "var(--text-accent)" },
    celebrate: { border: "1px solid transparent", background: "var(--celebrate)", color: "var(--on-celebrate)" }
  };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center",
        fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: "var(--font-body-regular)",
        lineHeight: 1.3, padding: "5px 12px", borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap", ...tones[tone], ...style
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
