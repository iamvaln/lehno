"use client";

import type { CSSProperties, ReactNode } from "react";
import type { Messages } from "../messages/index.js";
import { Icon } from "./ui/index.js";

const BOUTON: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "var(--space-32)",
  height: "var(--space-32)",
  // Sans bordure, comme la bascule de langue à côté : la maquette v3 pose ces
  // deux commandes en aplat, elles s'habillent au survol (voir composants.css).
  color: "var(--text-mention)",
  background: "transparent",
  border: "none",
  borderRadius: "var(--radius-xs)",
  padding: 0,
  cursor: "pointer",
};

// Le thème vit sur la classe lehno-nuit, posée avant la première peinture par
// lib/theme-script.ts. Ce bouton ne fait que la retourner et la retenir sous la
// même clé — aucun état React ne le double, sinon les deux divergeraient.
export function BasculeTheme({ t }: { t: Messages }): ReactNode {
  const basculer = (): void => {
    // Le script de tête pose la classe sur <html> — <body> n'existe pas encore
    // à ce moment. On la lit donc sur les deux, et on l'écrit sur les deux :
    // un thème posé une seule fois sur <html> ne doit pas y rester coincé une
    // fois qu'on l'a retiré du corps.
    const etaitSombre =
      document.documentElement.classList.contains("lehno-nuit") ||
      document.body.classList.contains("lehno-nuit");
    const sombre = !etaitSombre;
    document.documentElement.classList.toggle("lehno-nuit", sombre);
    document.body.classList.toggle("lehno-nuit", sombre);
    try {
      localStorage.setItem("lehno.theme", sombre ? "dark" : "light");
    } catch {
      // Stockage refusé : le thème tient pour la visite, et c'est tout ce qu'on promet.
    }
  };

  return (
    <button type="button" className="lehno-bascule" onClick={basculer} aria-label={t.themeBascule} title={t.themeBascule} style={BOUTON}>
      <span className="si-clair">
        <Icon name="moon" size={17} strokeWidth={1.9} />
        <span className="lecture-seule">{t.themeVersSombre}</span>
      </span>
      <span className="si-sombre">
        <Icon name="sun" size={17} strokeWidth={1.9} />
        <span className="lecture-seule">{t.themeVersClair}</span>
      </span>
    </button>
  );
}
