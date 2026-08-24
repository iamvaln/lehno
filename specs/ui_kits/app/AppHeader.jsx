import React from "react";
import { BrandMark } from "../../components/brand/BrandMark.jsx";
import { Wordmark } from "../../components/brand/Wordmark.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { NotificationBell } from "../../components/navigation/NotificationBell.jsx";

export function AppHeader({ dark, notifications = 0, onBack, title, base = "../../", onCloche }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "6px 16px 10px", flex: "none"
    }}>
      {onBack ? (
        <>
          <button type="button" onClick={onBack} className="lehno-focusable" aria-label="Retour"
            style={{ background: "none", border: "none", padding: "6px 6px 6px 0", cursor: "pointer", color: "var(--text-body)" }}>
            <Icon name="chevron-left" size={22} />
          </button>
          <div className="lehno-display" style={{ fontSize: 17 }}>{title}</div>
        </>
      ) : (
        <>
          <BrandMark base={base} size={26} />
          <Wordmark base={base} variant={dark ? "blanc" : "couleur"} height={18} />
        </>
      )}
      <div style={{ marginLeft: "auto" }}>
        <NotificationBell nonLus={notifications} />
      </div>
    </header>
  );
}
