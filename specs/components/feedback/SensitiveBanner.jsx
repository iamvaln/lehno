import React from "react";

/** Un moment grave. Le doc de ton est net : « sobre, court, sans compassion
 *  affichée. On accompagne en se taisant. » D'où l'absence d'icône — un cœur
 *  ou des mains jointes seraient précisément la compassion affichée — et
 *  l'absence de texte par défaut : le produit n'a rien à ajouter à la date.
 *
 *  « texte » ou enfants : les deux marchent, et c'est la même convention que
 *  OfflineBanner. Sans ce prop, un appel à texte= tombait dans « ...rest » et
 *  se posait sur le div comme attribut mort — la phrase disparaissait. */
export function SensitiveBanner({ texte, children, style, ...rest }) {
  return (
    <div role="note" style={{
      background: "var(--surface-panel)", color: "var(--text-body)",
      padding: "13px 15px", border: "none", borderRadius: 0, boxShadow: "none",
      fontFamily: "var(--font-body)", fontSize: "var(--text-body-xs)", lineHeight: 1.5,
      ...style
    }} {...rest}>
      {texte || children}
    </div>
  );
}
