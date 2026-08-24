import type { CSSProperties, ReactNode } from "react";

// Le cadre de téléphone des aperçus, calqué sur celui de la maquette : un
// iPhone récent, pas un téléphone générique. Trois traits le décident, et
// c'est leur absence qui faisait lire l'ancien cadre comme un Android :
//
//   — un rayon d'angle large (var(--radius-device)) et un écran bord à bord,
//     sans le liseré épais qui date d'avant 2017 ;
//   — une Dynamic Island posée SUR l'écran, pas une encoche creusée dans le
//     châssis ;
//   — une barre d'état, parce qu'un téléphone sans heure ni batterie ne
//     ressemble à rien.
//
// C'est aussi la seule surface du produit qui porte une ombre —
// var(--shadow-device) — parce qu'un objet posé devant la page en a besoin ;
// partout ailleurs la profondeur vient des filets d'un pixel.

const CADRE: CSSProperties = {
  width: 330,
  maxWidth: "100%",
  height: 660,
  borderRadius: "var(--radius-device)",
  overflow: "hidden",
  position: "relative",
  background: "var(--surface-page)",
  boxShadow: "var(--shadow-device)",
  flex: "none",
  boxSizing: "border-box",
};

// 126 × 37 à l'échelle d'un écran de 402 px de large ; ramené ici aux 330 px
// du cadre, soit un facteur 0,82.
const ILOT: CSSProperties = {
  position: "absolute",
  top: 9,
  left: "50%",
  transform: "translateX(-50%)",
  width: 103,
  height: 30,
  borderRadius: "var(--radius-pill)",
  background: "var(--island-device)",
  zIndex: 50,
};

const BARRE_ETAT: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 44,
  zIndex: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 var(--space-20)",
  pointerEvents: "none",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-body-xs)",
  fontWeight: "var(--font-body-semibold)",
  color: "var(--text-body)",
};

const INDICATEUR: CSSProperties = {
  position: "absolute",
  bottom: 7,
  left: "50%",
  transform: "translateX(-50%)",
  width: 114,
  height: 5,
  borderRadius: "var(--radius-pill)",
  background: "var(--text-body)",
  opacity: 0.25,
  zIndex: 60,
  pointerEvents: "none",
};

// Les trois pictogrammes de droite : réseau, wifi, batterie. Tracés en
// currentColor — ils prennent la couleur du texte, donc du thème.
function Indicateurs(): ReactNode {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }} aria-hidden="true">
      <svg width="16" height="10" viewBox="0 0 19 12" fill="currentColor">
        <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" />
        <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" />
        <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" />
        <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" />
      </svg>
      <svg width="14" height="10" viewBox="0 0 17 12" fill="currentColor">
        <path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" />
        <path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" />
        <circle cx="8.5" cy="10.5" r="1.5" />
      </svg>
      <svg width="22" height="11" viewBox="0 0 27 13" fill="currentColor">
        <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        <rect x="2" y="2" width="20" height="9" rx="2" />
        <path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fillOpacity="0.4" />
      </svg>
    </span>
  );
}

export function Telephone({ children, heure = "8:30" }: { children: ReactNode; heure?: string }): ReactNode {
  return (
    <div style={CADRE}>
      <div aria-hidden="true" style={ILOT} />
      <div aria-hidden="true" style={BARRE_ETAT}>
        <span>{heure}</span>
        <Indicateurs />
      </div>
      {/* Le contenu commence sous la barre d'état, comme sur un vrai écran. */}
      <div style={{ height: "100%", paddingTop: 44, boxSizing: "border-box", overflow: "hidden" }}>
        {children}
      </div>
      <div aria-hidden="true" style={INDICATEUR} />
    </div>
  );
}
