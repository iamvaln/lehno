import React from "react";

export function Quote({ children, guillemets, size = 16, tone = "body", style, ...rest }) {
  const text = typeof children === "string" ? children : "";
  const long = guillemets != null ? guillemets : text.length > 90;
  return (
    <p
      style={{
        margin: 0,
        fontFamily: "var(--font-display)", fontVariationSettings: "var(--font-display-settings)",
        fontStyle: "italic", fontWeight: "var(--font-display-regular)",
        fontSize: size, lineHeight: 1.45,
        color: tone === "muted" ? "var(--text-secondary)" : "var(--text-body)",
        textWrap: "pretty", ...style
      }}
      {...rest}
    >
      {long ? "\u00AB\u00A0" : ""}{children}{long ? "\u00A0\u00BB" : ""}
    </p>
  );
}
