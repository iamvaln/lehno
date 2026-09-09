import React from "react";
import { Icon } from "../core/Icon.jsx";

/* Le vocabulaire du classement est celui de la fiche : « Idée », « À éviter ».
   Trois noms pour une même chose, c'en était deux de trop. Le repli est en
   français ; une page bilingue passe `t` et le composant suit sa langue. */
const CATEGORIES = {
  gout:       "Goût",
  idee:       "Idée",
  nogo:       "À éviter",
  souvenir:   "Souvenir",
  aclasser:   "À classer"
};

export function CategoryTag({ categorie = "aclasser", t, onReclasser, style, ...rest }) {
  const table = (t && t.categories) || CATEGORIES;
  const libelle = table[categorie] || table.aclasser || CATEGORIES.aclasser;
  const flou = categorie === "aclasser";

  const contenu = (
    <>
      <span>{libelle}</span>
      {onReclasser ? <Icon name="chevron-down" size={13} strokeWidth={2} /> : null}
    </>
  );

  const pilule = {
    display: "inline-flex", alignItems: "center", gap: 5,
    fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 400, lineHeight: 1.3,
    padding: onReclasser ? "6px 10px 6px 12px" : "5px 12px",
    borderRadius: "var(--radius-pill)",
    border: flou ? "1px dashed var(--border-object)" : "1px solid transparent",
    background: flou ? "transparent" : "var(--action-quiet-bg)",
    color: flou ? "var(--text-mention)" : "var(--text-accent)"
  };

  if (!onReclasser) return <span style={{ ...pilule, ...style }} {...rest}>{contenu}</span>;

  /* La pilule reste compacte ; c'est le bouton qui porte les 44 px, par une
     marge négative verticale. Une zone d'appui ne se lit pas, elle se touche. */
  return (
    <button type="button" onClick={onReclasser} className="lehno-focusable"
      aria-label={t && t.reclasserAria ? t.reclasserAria(libelle) : "Reclasser — actuellement : " + libelle}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "none", border: "none", padding: 0,
        minHeight: "var(--touch-min)", marginTop: -6, marginBottom: -6,
        cursor: "pointer", ...style
      }} {...rest}>
      <span style={pilule}>{contenu}</span>
    </button>
  );
}
