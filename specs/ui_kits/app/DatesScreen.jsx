import React from "react";
import { Countdown } from "../../components/content/Countdown.jsx";
import { Button } from "../../components/core/Button.jsx";
import { Icon } from "../../components/core/Icon.jsx";

/* Vos dates (3.14) — deux vues du même contenu, et l'action d'en ajouter une.
 *
 * La LISTE répond « qu'est-ce qui m'attend » : elle se lit du plus proche au
 * plus loin, et le décompte y est la valeur qu'on cherche.
 *
 * Le CALENDRIER répond « comment mon mois est rempli » : c'est la densité qu'on
 * y lit, pas le détail. Une même personne peut donc revenir ici pour deux
 * raisons différentes — d'où deux vues plutôt qu'un compromis qui n'en sert
 * aucune.
 *
 * L'ajout vit en bas, flottant : c'est l'action de l'écran, et elle doit rester
 * atteignable au pouce quel que soit le défilement.
 */

const MOIS = [
  { titre: "moisAout", cle: "aout", items: [
    { j: 0, jour: 22, nom: "Awa Diop", quoi: "Anniversaire · 36 ans", date: "22 août", dateEn: "22 Aug" },
    { j: 3, jour: 24, nom: "Valery Bah", quoi: "Anniversaire · 36 ans", date: "24 août", dateEn: "24 Aug" },
    { j: 9, jour: 30, nom: "Mathias & Rose", quoi: "Mariage · 5 ans", date: "30 août", dateEn: "30 Aug" }
  ]},
  { titre: "moisSept", cle: "sept", items: [
    { j: 12, jour: 2, nom: "Maman", quoi: "Départ en retraite", date: "2 sept.", dateEn: "2 Sep" },
    { j: 24, jour: 14, nom: "Nour & moi", quoi: "Six mois", date: "14 sept.", dateEn: "14 Sep" }
  ]}
];

/* Août 2026 commence un samedi ; 31 jours. Le mois affiché est celui du jour. */
const DEBUT_AOUT = 5;
const JOURS_AOUT = 31;
const AUJOURD_HUI = 22;

function Liste({ t, onOpen }) {
  return (
    <>
      {MOIS.map((m) => (
        <section key={m.cle} style={{ marginBottom: 18 }}>
          <div className="lehno-kicker" style={{ marginBottom: 8 }}>{t[m.titre]}</div>
          <div style={{
            border: "1px solid var(--border-object)",
            borderRadius: "var(--radius-lg)", overflow: "hidden"
          }}>
            {m.items.map((e, i) => (
              <button key={e.nom} type="button" onClick={() => onOpen && onOpen("occasion")}
                className="lehno-focusable" style={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                  display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
                  minHeight: "var(--touch-min)",
                  borderTop: i ? "1px solid var(--border-hairline)" : "none"
                }}>
                <span className="lehno-display" style={{
                  fontSize: 14, color: "var(--text-accent)", minWidth: 58, fontWeight: 500
                }}>{t.langue === "fr" ? e.date : e.dateEn}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="lehno-display" style={{ fontSize: 16, display: "block" }}>{e.nom}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{e.quoi}</span>
                </span>
                <Countdown days={e.j} size="s" locale={t.langue} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Calendrier({ t, onOpen }) {
  const [choisi, setChoisi] = React.useState(AUJOURD_HUI);
  const parJour = {};
  MOIS[0].items.forEach((e) => { parJour[e.jour] = e; });

  const cases = [];
  for (let i = 0; i < DEBUT_AOUT; i++) cases.push(null);
  for (let j = 1; j <= JOURS_AOUT; j++) cases.push(j);

  const retenu = parJour[choisi];

  return (
    <>
      <div className="lehno-kicker" style={{ marginBottom: 10 }}>{t.calendrierAout}</div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6
      }}>
        {t.joursCourts.map((d, i) => (
          <div key={i} style={{
            textAlign: "center", fontFamily: "var(--font-body)", fontSize: 10.5,
            fontWeight: 600, color: "var(--text-mention)", paddingBottom: 4
          }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cases.map((j, i) => {
          if (j === null) return <div key={"v" + i} />;
          const evt = parJour[j];
          const jour = j === AUJOURD_HUI;
          const actif = j === choisi;
          return (
            <button key={j} type="button" onClick={() => setChoisi(j)}
              aria-current={jour ? "date" : undefined} className="lehno-focusable"
              style={{
                all: "unset", boxSizing: "border-box", cursor: "pointer",
                aspectRatio: "1", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                borderRadius: "var(--radius-xs)",
                background: actif ? "var(--action)" : jour ? "var(--celebrate)" : "transparent",
                color: actif ? "var(--text-on-accent)"
                  : jour ? "var(--on-celebrate)" : "var(--text-body)"
              }}>
              <span style={{
                fontFamily: "var(--font-body)", fontSize: 13,
                fontWeight: evt ? 700 : 400
              }}>{j}</span>
              {/* Un point, pas un aperçu : à cette taille c'est la densité du
                  mois qu'on lit, et un libellé y serait illisible. */}
              <span style={{
                width: 4, height: 4, borderRadius: "50%",
                background: evt
                  ? (actif ? "var(--text-on-accent)" : "var(--action)")
                  : "transparent"
              }} />
            </button>
          );
        })}
      </div>

      {/* Le détail du jour touché, sous la grille : la grille dit combien, le
          panneau dit qui. */}
      <div style={{ marginTop: 16, minHeight: 74 }}>
        {retenu ? (
          <button type="button" onClick={() => onOpen && onOpen("occasion")}
            className="lehno-focusable" style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
              display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
              minHeight: "var(--touch-min)", borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-object)", overflow: "hidden"
            }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="lehno-display" style={{ fontSize: 16, display: "block" }}>{retenu.nom}</span>
              <span style={{
                display: "block", fontSize: 12.5, color: "var(--text-secondary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>{retenu.quoi}</span>
            </span>
            <Countdown days={retenu.j} size="s" locale={t.langue} />
            <Icon name="chevron-right" size={15} color="var(--text-mention)" style={{ flex: "none" }} />
          </button>
        ) : (
          <p style={{
            margin: 0, fontSize: 13, color: "var(--text-mention)", padding: "13px 2px"
          }}>{t.calendrierRien}</p>
        )}
      </div>
    </>
  );
}

export function DatesScreen({ t, etat = "nominal", onOpen }) {
  /* Le calendrier par défaut : on vient d'abord voir comment le mois est
     rempli. La liste répond à la question suivante — dans quel ordre. */
  const [vue, setVue] = React.useState(etat === "liste" ? "liste" : "calendrier");

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <div style={{ padding: "0 16px 78px" }}>
        <div style={{
          display: "flex", alignItems: "baseline", gap: 12, margin: "6px 0 14px"
        }}>
          <h1 className="lehno-display" style={{
            fontSize: 25, letterSpacing: "-.025em", margin: 0, fontWeight: 500
          }}>{t.datesTitre}</h1>
        </div>

        {/* Deux vues, pas un compromis : la liste répond « qu'est-ce qui
            m'attend », le calendrier « comment mon mois est rempli ». */}
        <div style={{
          display: "inline-flex", border: "1px solid var(--border-object)",
          borderRadius: "var(--radius-pill)", overflow: "hidden", marginBottom: 16
        }}>
          {[["liste", t.vueListe, "list"], ["calendrier", t.vueCalendrier, "calendar-days"]].map(([k, l, ic]) => (
            <button key={k} type="button" onClick={() => setVue(k)} aria-pressed={vue === k}
              className="lehno-focusable" style={{
                all: "unset", cursor: "pointer", display: "inline-flex",
                alignItems: "center", gap: 6, padding: "8px 15px", minHeight: 38,
                fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                background: vue === k ? "var(--action)" : "transparent",
                color: vue === k ? "var(--text-on-accent)" : "var(--text-secondary)"
              }}>
              <Icon name={ic} size={15} />{l}
            </button>
          ))}
        </div>

        {vue === "liste" ? <Liste t={t} onOpen={onOpen} /> : <Calendrier t={t} onOpen={onOpen} />}
      </div>

      {/* L'action de l'écran, flottante : atteignable au pouce quel que soit le
          défilement — une date s'ajoute au moment où on y pense. */}
      <div style={{
        position: "absolute", left: 16, right: 16, bottom: 12
      }}>
        <Button platform="mobile" full icon="plus"
          onClick={() => onOpen && onOpen("evenement")}>{t.ajouterDate}</Button>
      </div>
    </div>
  );
}
