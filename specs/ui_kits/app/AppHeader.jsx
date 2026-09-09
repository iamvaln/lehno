import React from "react";
import { Wordmark } from "../../components/brand/Wordmark.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { NotificationBell } from "../../components/navigation/NotificationBell.jsx";

export function AppHeader({ t, dark, notifications = 0, onBack, title, base = "../../", onCloche }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "6px 16px 10px", flex: "none"
    }}>
      {onBack ? (
        <>
          <button type="button" onClick={onBack} className="lehno-focusable" aria-label={(t && t.retour) || "Retour"}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-body)",
              minWidth: "var(--touch-min)", minHeight: "var(--touch-min)",
              display: "grid", placeItems: "center", marginLeft: -11
            }}>
            <Icon name="chevron-left" size={22} />
          </button>
          <div className="lehno-display" style={{ fontSize: 17 }}>{title}</div>
        </>
      ) : (
        /* Le logotype seul : l'icône identifie l'app au lancement, pas dans l'app.
           En sombre, la coupe une encre — celle en blanc, l'encre #221F2B ne s'y voit pas. */
        <Wordmark base={base} variant={dark ? "blanc" : "couleur"} height={18} />
      )}
      {/* La cloche a la même cible de 44 px que la flèche : c'est la marge
          négative qui garde l'icône alignée sur le bord, sans pousser l'en-tête
          au-delà de l'écran. */}
      <div style={{ marginLeft: "auto", marginRight: -11, flex: "none", width: "var(--touch-min)" }}>
        <NotificationBell nonLus={notifications} />
      </div>
    </header>
  );
}
