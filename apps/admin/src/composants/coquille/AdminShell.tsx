import type { CSSProperties, ReactNode } from "react";

export interface AdminShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  /** Sous 900 px, la barre latérale sort de la grille et glisse par-dessus le contenu. */
  navOuverte?: boolean;
  onFermerNav?: () => void;
  children: ReactNode;
}

// La coquille du back-office : barre latérale, barre haute, contenu. Un outil a
// des barres — c'est ce qui le distingue d'une application, et c'est pour ça que
// --surface-chrome n'existe que sous .lehno-admin.
//
// Les trois classes posées ici (coquille, coquille-rail, coquille-burger) sont
// la prise du CSS : sous 900 px, styles/coquille.css retire la barre latérale de
// la grille et la fait glisser. Ce que le style en ligne ne peut pas exprimer —
// une requête média, un survol, un focus — vit là-bas, et seulement là-bas.
const GRILLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "var(--sidebar-width) 1fr",
  minHeight: "100vh",
  background: "var(--surface-page)",
  color: "var(--text-body)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-body-m)",
};

const RAIL: CSSProperties = {
  position: "sticky",
  top: 0,
  height: "100vh",
  width: "var(--sidebar-width)",
  overflowY: "auto",
  background: "var(--surface-chrome)",
  borderRight: "var(--border-width) solid var(--border-hairline)",
  // Sous 900 px, le rail devient un panneau fixe : la transition est portée ici
  // pour valoir quelle que soit la cause du changement, et coquille.css n'a plus
  // qu'à basculer la transformation.
  transition: "transform var(--duration-screen) var(--ease-traverse)",
};

// Le voile n'a pas de jeton de couleur à lui : c'est la bande sombre du système,
// posée à plat et rendue translucide. Aucune quatrième encre n'est inventée.
const VOILE: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 19,
  background: "var(--surface-band)",
  opacity: 0.42,
};

const CORPS: CSSProperties = { minWidth: 0, display: "flex", flexDirection: "column" };

const CONTENU: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "var(--space-20) var(--space-24) var(--space-40)",
};

export function AdminShell({ sidebar, topbar, navOuverte, onFermerNav, children }: AdminShellProps) {
  return (
    <div className="coquille" style={GRILLE}>
      <div className="coquille-rail" data-ouvert={navOuverte ? "1" : undefined} style={RAIL}>
        {sidebar}
      </div>

      {/* Le voile referme la navigation au doigt : sous 900 px, le rail couvre le
          contenu, et toucher à côté est le geste attendu. Il double le bouton de
          la barre haute — il n'est donc pas la seule sortie, et reste masqué aux
          lecteurs d'écran. */}
      {navOuverte ? (
        <div className="coquille-voile" onClick={onFermerNav} aria-hidden="true" style={VOILE} />
      ) : null}

      <div className="coquille-corps" style={CORPS}>
        {topbar}
        <main className="coquille-contenu" style={CONTENU}>{children}</main>
      </div>
    </div>
  );
}
