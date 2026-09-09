import React from "react";

export function Avatar({ name = "", src, size = 48, style, ...rest }) {
  const initial = String(name).trim().charAt(0).toUpperCase() || "?";
  const common = {
    width: size, height: size, borderRadius: "50%", flex: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden", boxSizing: "border-box", ...style
  };
  if (src) {
    return <img src={src} alt={name} style={{ ...common, objectFit: "cover" }} {...rest} />;
  }
  return (
    <div
      style={{
        ...common,
        background: "var(--action-quiet-bg)", color: "var(--text-accent)",
        fontFamily: "var(--font-display)", fontVariationSettings: "var(--font-display-settings)",
        fontWeight: "var(--font-display-medium)", fontSize: Math.round(size * 0.4)
      }}
      {...rest}
    >
      {initial}
    </div>
  );
}
