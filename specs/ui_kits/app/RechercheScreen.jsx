import React from "react";
import { Icon } from "../../components/core/Icon.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Countdown } from "../../components/content/Countdown.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";

const LIBELLE = {
  anniversaire: "typeAnniversaire", mariage: "typeMariage", retraite: "typeRetraite",
  naissance: "typeNaissance", etape: "typeEtape", fete: "typeFete", autre: "typeAutre"
};

export function RechercheScreen({ t, gens = [], etat = "nominal", onOpen, onRetour }) {
  const saisieDe = (e) => (e === "vide" ? "zzz" : e === "nominal" ? "va" : "");
  const [q, setQ] = React.useState(saisieDe(etat));
  /* La planche change d'état sans remonter l'écran : la saisie doit suivre,
     sinon l'état vide continue d'afficher le résultat de l'état nominal. */
  React.useEffect(() => { setQ(saisieDe(etat)); }, [etat]);

  /* Sans saisie, l'écran montre le carnet entier plutôt qu'une page blanche :
     chercher commence souvent par parcourir. */
  const resultats = (q.trim()
    ? gens.filter((p) => p.nom.toLowerCase().includes(q.trim().toLowerCase()))
    : gens)
    .slice()
    .sort((a, b) => {
      if (a.jours == null) return 1;
      if (b.jours == null) return -1;
      return a.jours - b.jours;
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 12px", flex: "none"
      }}>
        <button type="button" onClick={onRetour} aria-label={t.retour} className="lehno-focusable"
          style={{
            all: "unset", cursor: "pointer", color: "var(--text-body)",
            minWidth: "var(--touch-min)", minHeight: "var(--touch-min)",
            display: "grid", placeItems: "center", marginLeft: -8
          }}>
          <Icon name="chevron-left" size={22} />
        </button>
        <div style={{
          flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8,
          border: "1px solid var(--action)", borderRadius: "var(--radius-sm)",
          padding: "0 12px", minHeight: "var(--touch-min)", boxSizing: "border-box"
        }}>
          <Icon name="search" size={17} color="var(--text-mention)" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.rechercher}
            aria-label={t.rechercher} style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontFamily: "var(--font-body)", fontSize: 16, color: "var(--text-body)", minWidth: 0
            }} />
          {q ? (
            <button type="button" onClick={() => setQ("")} aria-label={t.effacer}
              className="lehno-focusable" style={{
                all: "unset", cursor: "pointer", padding: 4, color: "var(--text-mention)"
              }}><Icon name="x" size={15} strokeWidth={2} /></button>
          ) : null}
        </div>
      </div>

      <div style={{ padding: "0 16px 18px", flex: 1 }}>
        {resultats.length ? (
            <div style={{ display: "grid" }}>
              {resultats.map((p, i) => (
                <button key={p.id} type="button" onClick={() => onOpen && onOpen("proche", p)}
                  className="lehno-focusable" style={{
                    all: "unset", boxSizing: "border-box", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12, padding: "11px 0",
                    minHeight: "var(--touch-min)",
                    borderTop: i ? "1px solid var(--border-hairline)" : "none"
                  }}>
                  <Avatar name={p.nom} size={40} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="lehno-display" style={{ fontSize: 16, display: "block" }}>
                      {t.langue === "fr" ? p.nom : (p.nomEn || p.nom)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2 }}>
                      <Tag tone={p.type === "anniversaire" ? "outline" : "quiet"}
                        style={{ fontSize: 11, padding: "2px 8px" }}>
                        {t[LIBELLE[p.type] || "typeAutre"]}
                      </Tag>
                      <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                        {t.langue === "fr" ? p.date : p.dateEn}
                      </span>
                    </span>
                  </span>
                  {p.jours == null ? null : (
                    <Countdown size="s" today={p.jours === 0}
                      label={p.jours === 0 ? t.aujourdhui : t.decompte(p.jours)} />
                  )}
                </button>
              ))}
            </div>
        ) : (
            <EmptyState illustration="recherche-sans-resultat" titre={t.videRechercheTitre}
              texte={t.videRechercheTexte} action={t.ajouterCeProche}
              onAction={() => onOpen && onOpen("identite", { nouveau: true })} />
          )}
      </div>
    </div>
  );
}
