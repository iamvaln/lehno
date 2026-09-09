import React from "react";
import { Icon } from "../core/Icon.jsx";

/* « texte » tombait dans « ...rest » et se posait sur le div comme attribut
   mort : la chaîne bilingue du dictionnaire était perdue. Et aucun repli
   français : sans lui, un appel qui oublie « t » ne peut plus afficher la
   mauvaise langue en silence. */
export function OfflineBanner({ texte, t, enAttente = 0, style, ...rest }) {
  const phrase = texte
    || (t ? (enAttente ? t.horsConnexionFile(enAttente) : t.horsConnexion) : "");
  return (
    <div role="status" style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "var(--surface-panel)", color: "var(--text-body)",
      padding: "10px 14px", border: "none", borderRadius: 0,
      fontFamily: "var(--font-body)", fontSize: "var(--text-mention-s)", lineHeight: 1.45,
      ...style
    }} {...rest}>
      <Icon name="cloud-off" size={15} color="var(--text-secondary)" />
      <span style={{ flex: 1 }}>{phrase}</span>
    </div>
  );
}
