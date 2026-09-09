import React from "react";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Countdown } from "../../components/content/Countdown.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { LoadingState } from "../../components/feedback/LoadingState.jsx";

const LIBELLE = {
  anniversaire: "typeAnniversaire", mariage: "typeMariage", retraite: "typeRetraite",
  naissance: "typeNaissance", etape: "typeEtape", fete: "typeFete", autre: "typeAutre"
};

/* Un critère de tri porte un sens : « par date » ne dit rien tant qu'on ne sait
   pas de quel bout. Chaque bouton garde donc sa direction, et un second appui
   sur le critère actif la retourne — c'est le geste attendu d'un en-tête de
   colonne, appliqué à un bouton. */
export function ProchesScreen({ t, gens = [], etat = "nominal", onOpen, onRecherche }) {
  const [tri, setTri] = React.useState({ cle: "date", sens: 1 });
  /* Un carnet se lit par pages : vingt fiches d'abord, la suite à la demande.
     Changer de tri renvoie à la première page — sans quoi on garderait
     cinquante lignes ouvertes sur un ordre qu'on vient de quitter. */
  const PAGE = 20;
  const [montres, setMontres] = React.useState(PAGE);
  React.useEffect(() => { setMontres(PAGE); }, [tri.cle, tri.sens, gens.length]);

  const basculer = (cle) => setTri((v) =>
    v.cle === cle ? { cle, sens: -v.sens } : { cle, sens: 1 });

  const liste = React.useMemo(() => {
    const c = [...gens];
    if (tri.cle === "alpha") {
      c.sort((a, b) => tri.sens * a.nom.localeCompare(b.nom, t.langue));
    } else {
      /* Une fiche sans date n'est ni proche ni lointaine : elle passe en fin de
         liste dans les deux sens, plutôt que de squatter la tête du tri. */
      c.sort((a, b) => {
        if (a.jours == null) return 1;
        if (b.jours == null) return -1;
        return tri.sens * (a.jours - b.jours);
      });
    }
    return c;
  }, [gens, tri, t.langue]);

  const criteres = [
    { cle: "date", libelle: t.triDate,
      sens: tri.sens > 0 ? t.triDateProche : t.triDateLoin },
    { cle: "alpha", libelle: tri.cle === "alpha" && tri.sens < 0 ? t.triAlphaZA : t.triAlphaAZ }
  ];

  return (
    <div style={{ padding: "var(--ry-haut) 16px 18px" }}>
      {/* Le carnet s'agrandit depuis le carnet : l'ajout se tient sur la ligne
          du titre, atteignable sans traverser cinquante fiches. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, margin: "0 0 var(--ry-titre)"
      }}>
        <h1 className="lehno-display" style={{
          fontSize: 27, letterSpacing: "-.025em", margin: 0, fontWeight: 500, flex: 1
        }}>{t.prochesTitre}</h1>
        <button type="button" aria-label={t.ajouterProche} className="lehno-focusable"
          onClick={() => onOpen && onOpen("identite", { nouveau: true })} style={{
            all: "unset", cursor: "pointer", display: "grid", placeItems: "center",
            width: "var(--touch-min)", height: "var(--touch-min)", flex: "none",
            borderRadius: "var(--radius-pill)", background: "var(--action)",
            color: "var(--text-on-accent)"
          }}>
          <Icon name="plus" size={19} strokeWidth={2} />
        </button>
      </div>

      <button type="button" onClick={onRecherche} className="lehno-focusable" style={{
        all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
        display: "flex", alignItems: "center", gap: 9, minHeight: "var(--touch-min)",
        padding: "0 14px", borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border-object)", color: "var(--text-mention)",
        fontFamily: "var(--font-body)", fontSize: 15
      }}>
        <Icon name="search" size={17} /> {t.rechercher}
      </button>

      {etat === "chargement" ? (
        <div style={{ marginTop: 16 }}><LoadingState variant="liste" lignes={4} titre={t.chargement} /></div>
      ) : etat === "vide" ? (
        <EmptyState illustration="annuaire-vide" titre={t.videAnnuaireTitre}
          texte={t.videAnnuaireTexte} action={t.ajouterProche}
          onAction={() => onOpen && onOpen("identite", { nouveau: true })} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, margin: "var(--ry-titre) 0 4px", flexWrap: "wrap" }}>
            {criteres.map((c) => {
              const actif = tri.cle === c.cle;
              return (
                <button key={c.cle} type="button" onClick={() => basculer(c.cle)}
                  aria-pressed={actif} className="lehno-focusable" style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600,
                    padding: "6px 12px", borderRadius: "var(--radius-pill)", cursor: "pointer",
                    border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
                    background: actif ? "var(--action)" : "transparent",
                    color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                  }}>
                  {c.libelle}
                  {actif ? (
                    <>
                      {c.sens ? <span style={{ fontWeight: 400, opacity: .85 }}>{c.sens}</span> : null}
                      <Icon name={tri.sens > 0 ? "arrow-up" : "arrow-down"} size={13} />
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid" }}>
            {liste.slice(0, montres).map((p, i) => (
              <button key={p.id} type="button" onClick={() => onOpen && onOpen("proche", p)}
                className="lehno-focusable" style={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 12, padding: "11px 0",
                  minHeight: "var(--touch-min)",
                  borderTop: i ? "1px solid var(--border-hairline)" : "none"
                }}>
                <Avatar name={p.nom} size={44} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="lehno-display" style={{ fontSize: 17, display: "block" }}>
                    {t.langue === "fr" ? p.nom : (p.nomEn || p.nom)}
                  </span>
                  {/* Ce qui définit un proche, c'est ce qu'on sait de lui. La
                      date vient après, en repère — sans quoi cette liste
                      redirait l'onglet Dates avec d'autres pixels. */}
                  <span style={{
                    display: "block", marginTop: 2, fontSize: 12.5, color: "var(--text-secondary)"
                  }}>
                    {p.notes ? t.procheNotes(p.notes) : t.procheAucuneNote}
                    {p.jours == null ? null : " · " + (t.langue === "fr" ? p.date : p.dateEn)}
                  </span>
                </span>
                {/* Le décompte ne s'affiche que s'il presse : la spec demande de
                    voir « qui a une date qui approche », pas de classer tout le
                    monde par échéance. */}
                {p.jours == null ? (
                  <span style={{ fontSize: 12.5, color: "var(--text-accent)", fontWeight: 600 }}>{t.completer}</span>
                ) : p.jours <= 7 ? (
                  <Countdown label={p.jours === 0 ? t.aujourdhui : t.decompte(p.jours)} today={p.jours === 0} size="s" />
                ) : null}
                <Icon name="chevron-right" size={15} color="var(--text-mention)" />
              </button>
            ))}
          </div>

          {liste.length > montres ? (
            <button type="button" onClick={() => setMontres((v) => v + PAGE)}
              className="lehno-focusable" style={{
                all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                minHeight: "var(--touch-min)", marginTop: 12,
                borderRadius: "var(--radius-sm)", border: "1px solid var(--border-object)",
                fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
                color: "var(--text-accent)"
              }}>
              {t.prochesReste(liste.length - montres)}
              <Icon name="chevron-down" size={15} />
            </button>
          ) : liste.length > PAGE ? (
            <div style={{
              textAlign: "center", marginTop: 12, fontSize: 12.5, color: "var(--text-mention)"
            }}>{t.prochesCompte(liste.length)}</div>
          ) : null}
        </>
      )}
    </div>
  );
}
