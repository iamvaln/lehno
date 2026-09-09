import React from "react";
import { Icon } from "./Icon.jsx";

const RANKS = {
  primary: {
    background: "var(--action)", color: "var(--text-on-accent)", border: "1px solid transparent",
    hover: { background: "var(--action-hover)" }, press: { background: "var(--action-press)" }
  },
  outline: {
    background: "transparent", color: "var(--text-accent)", border: "1px solid var(--action-edge)",
    hover: { background: "var(--action-quiet-bg)" }, press: { background: "var(--action-quiet-bg)" }
  },
  text: {
    background: "transparent", color: "var(--text-accent)", border: "1px solid transparent",
    hover: { background: "var(--action-quiet-bg)" }, press: { background: "var(--action-quiet-bg)" }
  },
  destructive: {
    background: "var(--feedback-error)", color: "var(--surface-page)", border: "1px solid transparent",
    hover: { filter: "brightness(0.9)" }, press: { filter: "brightness(0.82)" }
  },
  "destructive-outline": {
    background: "transparent", color: "var(--feedback-error)", border: "1px solid var(--feedback-error)",
    hover: { background: "var(--feedback-error-bg)" }, press: { background: "var(--feedback-error-bg)" }
  },
  neutral: {
    background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-object)",
    hover: { background: "var(--action-quiet-bg)" }, press: { background: "var(--action-quiet-bg)" }
  }
};

export function Button({
  children, variant = "primary", platform = "web", full = false,
  icon, iconAfter, disabled = false, type = "button", style, onClick, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const rank = RANKS[variant] || RANKS.primary;
  const mobile = platform === "mobile";

  const base = {
    display: full ? "flex" : "inline-flex",
    width: full ? "100%" : "auto",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxSizing: "border-box",
    fontFamily: "var(--font-body)",
    fontWeight: "var(--font-body-semibold)",
    fontSize: mobile ? "var(--text-body-m)" : "var(--text-body-s)",
    lineHeight: 1.2,
    minHeight: mobile ? "var(--touch-min)" : "var(--control-height, 40px)",
    padding: mobile
      ? (variant === "text" ? "13px 14px" : "13px 18px")
      : (variant === "text" ? "9px 12px" : "9px var(--control-pad-x, 18px)"),
    borderRadius: mobile ? "var(--radius-md)" : "var(--radius-sm)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.45 : 1,
    textDecoration: "none",
    transition: "background var(--transition-state), color var(--transition-state), filter var(--transition-state)",
    ...rank,
    ...(!disabled && hover ? rank.hover : null),
    ...(!disabled && press ? rank.press : null),
    ...style
  };
  delete base.hover; delete base.press;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      className="lehno-focusable"
      style={base}
      {...rest}
    >
      {icon ? <Icon name={icon} size={mobile ? 18 : 17} /> : null}
      <span>{children}</span>
      {iconAfter ? <Icon name={iconAfter} size={mobile ? 18 : 17} /> : null}
    </button>
  );
}
