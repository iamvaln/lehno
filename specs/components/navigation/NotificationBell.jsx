import React from "react";
import { Icon } from "../core/Icon.jsx";

export function NotificationBell({ nonLus = 0, onOuvrir, style, ...rest }) {
  const libelle = nonLus > 0
    ? "Notifications — " + nonLus + " non " + (nonLus === 1 ? "lue" : "lues")
    : "Notifications";
  return (
    <button type="button" onClick={onOuvrir} aria-label={libelle} className="lehno-focusable"
      style={{
        position: "relative", background: "none", border: "none", padding: 6,
        margin: -6, cursor: "pointer", color: "var(--text-secondary)",
        minWidth: "var(--touch-min)", minHeight: "var(--touch-min)",
        display: "grid", placeItems: "center", ...style
      }} {...rest}>
      <Icon name="bell" size={20} />
      {nonLus > 0 ? (
        <span aria-hidden="true" style={{
          position: "absolute", top: 6, right: 6, minWidth: 16, height: 16, padding: "0 4px",
          boxSizing: "border-box", borderRadius: 999, background: "var(--action)",
          color: "var(--text-on-accent)", fontFamily: "var(--font-body)", fontSize: 10,
          fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"
        }}>{nonLus > 9 ? "9+" : nonLus}</span>
      ) : null}
    </button>
  );
}
