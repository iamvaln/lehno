"use client";

import type { ReactNode } from "react";
import type { Messages } from "../messages";

// Le thème vit sur <html data-theme>, posé avant la première peinture par le script
// de lib/theme-script.ts. Ce bouton ne fait que le retourner et le retenir sous la
// même clé — aucun état React ne le double, sinon les deux divergeraient.
export function BasculeTheme({ t }: { t: Messages }): ReactNode {
  const basculer = (): void => {
    const racine = document.documentElement;
    const suivant = racine.dataset["theme"] === "dark" ? "light" : "dark";
    racine.dataset["theme"] = suivant;
    try {
      localStorage.setItem("lehno.theme", suivant);
    } catch {
      // Stockage refusé : le thème tient pour la visite, et c'est tout ce qu'on promet.
    }
  };

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={t.themeBascule}
      title={t.themeBascule}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 34, height: 34, color: "var(--muted)", background: "transparent",
        border: "1px solid var(--edge)", borderRadius: 9, padding: 0, cursor: "pointer",
      }}
    >
      <span className="si-clair">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
        <span className="lecture-seule">{t.themeVersSombre}</span>
      </span>
      <span className="si-sombre">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" /><path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" /><path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
        </svg>
        <span className="lecture-seule">{t.themeVersClair}</span>
      </span>
    </button>
  );
}
