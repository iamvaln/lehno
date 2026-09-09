import React from "react";

export function SectionLabel({ children, style, ...rest }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-body)", fontSize: "var(--text-kicker)",
        fontWeight: "var(--font-body-semibold)", letterSpacing: "var(--tracking-kicker)",
        textTransform: "uppercase", color: "var(--text-mention)", ...style
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
