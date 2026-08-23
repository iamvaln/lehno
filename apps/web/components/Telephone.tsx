import type { CSSProperties, ReactNode } from "react";

const CADRE: CSSProperties = {
  width: 330,
  maxWidth: "100%",
  height: 684,
  borderRadius: "var(--radius-2xl)",
  padding: "var(--space-10)",
  background: "var(--surface-band)",
  boxShadow: "var(--shadow-device)",
  flex: "none",
  position: "relative",
  boxSizing: "border-box",
};

const ECRAN: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  borderRadius: "var(--radius-xl)",
  overflow: "hidden",
  background: "var(--surface-page)",
};

const ENCOCHE: CSSProperties = {
  position: "absolute",
  top: "var(--space-10)",
  left: "50%",
  transform: "translateX(-50%)",
  width: 104,
  height: 26,
  borderRadius: "var(--radius-pill)",
  background: "var(--surface-band)",
  zIndex: 2,
};

const BARRE: CSSProperties = {
  position: "absolute",
  bottom: "var(--space-6)",
  left: "50%",
  transform: "translateX(-50%)",
  width: 116,
  height: 4,
  borderRadius: "var(--radius-pill)",
  background: "var(--border-object)",
  zIndex: 2,
};

// Le cadre de téléphone des aperçus. C'est la seule surface du produit qui
// porte une ombre — var(--shadow-device) — parce qu'un objet posé devant la
// page en a besoin ; partout ailleurs la profondeur vient des filets.
export function Telephone({ children }: { children: ReactNode }): ReactNode {
  return (
    <div style={CADRE}>
      <div style={ECRAN}>
        <div aria-hidden="true" style={ENCOCHE} />
        {children}
        <div aria-hidden="true" style={BARRE} />
      </div>
    </div>
  );
}
