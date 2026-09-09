import React from "react";

export function Card({ children, surface = "card", padding = 22, radius = "xl", style, ...rest }) {
  const surfaces = {
    card:  { background: "var(--surface-card)", border: "1px solid var(--border-object)" },
    panel: { background: "var(--surface-panel)", border: "1px solid transparent" },
    plain: { background: "transparent", border: "1px solid var(--border-object)" }
  };
  const radii = { lg: "var(--radius-lg)", xl: "var(--radius-xl)", "2xl": "var(--radius-2xl)" };
  return (
    <div
      style={{
        boxSizing: "border-box", padding, borderRadius: radii[radius] || radii.xl,
        color: "var(--text-body)", fontFamily: "var(--font-body)",
        ...surfaces[surface], ...style
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
