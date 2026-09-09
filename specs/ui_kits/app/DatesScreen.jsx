import React from "react";
import { Countdown } from "../../components/content/Countdown.jsx";
import { Button } from "../../components/core/Button.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";

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
    { j: 0, jour: 22, nom: "Célarine", quoi: "Anniversaire · 36 ans", quoiEn: "Birthday · turning 36", date: "22 août", dateEn: "22 Aug" },
    { j: 3, jour: 24, nom: "Valery Bah", quoi: "Anniversaire · 36 ans", quoiEn: "Birthday · turning 36", date: "24 août", dateEn: "24 Aug" },
    { j: 6, jour: 28, nom: "Kader Diop", quoi: "Anniversaire · 30 ans", quoiEn: "Birthday · turning 30", date: "28 août", dateEn: "28 Aug" },
    { j: 9, jour: 30, nom: "Mathias & Rose", type: "mariage", quoi: "Mariage · 5 ans", quoiEn: "Wedding · 5 years", date: "30 août", dateEn: "30 Aug" }
  ]},
  { titre: "moisSept", cle: "sept", items: [
    { j: 12, jour: 2, nom: "Maman", nomEn: "Mum", type: "retraite", quoi: "Départ en retraite", quoiEn: "Retiring", date: "2 sept.", dateEn: "2 Sep" },
    { j: 24, jour: 14, nom: "Nour & moi", nomEn: "Nour & me", type: "etape", quoi: "Six mois", quoiEn: "Six months", date: "14 sept.", dateEn: "14 Sep" }
  ]}
];

/* Le calendrier se navigue mois par mois : la grille se calcule, elle n'est plus
   écrite pour août. Le jour de référence de l'aperçu est le 22 août 2026. */
const ANNEE = 2026;
const MOIS_INDEX = { aout: 7, sept: 8 };
const AUJOURD_HUI = { mois: 7, jour: 22 };

const debutMois = (m) => (new Date(ANNEE, m, 1).getDay() + 6) % 7;
const joursMois = (m) => new Date(ANNEE, m + 1, 0).getDate();
const nomMois = (m, langue, forme = "long") => new Intl.DateTimeFormat(
  langue === "fr" ? "fr-FR" : "en-GB", { month: forme }
).format(new Date(ANNEE, m, 1));
const titreMois = (m, langue) => {
  const d = new Date(ANNEE, m, 1);
  const meme = d.getFullYear() === new Date().getFullYear();
  return nomMois(m, langue) + (meme ? "" : " " + d.getFullYear());
};

/* Une nature éteinte n'a jamais pu être posée : au lancement, l'agenda ne
   contient que des anniversaires. Le filtre vaut pour la liste, la grille et le
   panneau du jour — une seule source, pour qu'aucune vue ne compte autrement. */
const anniversairesSeuls = (bloc) => ({
  ...bloc, items: bloc.items.filter((e) => !e.type || e.type === "anniversaire")
});
const moisVus = (flags) => flags && flags.eventsOther === false
  ? MOIS.map(anniversairesSeuls).filter((b) => b.items.length) : MOIS;

const parMois = (flags) => {
  const carte = {};
  moisVus(flags).forEach((bloc) => {
    const m = MOIS_INDEX[bloc.cle];
    carte[m] = {};
    bloc.items.forEach((e) => { carte[m][e.jour] = e; });
  });
  return carte;
};

function Liste({ t, onOpen, flags }) {
  return (
    <>
      {moisVus(flags).map((m) => (
        <section key={m.cle} style={{ marginBottom: 18 }}>
          <div className="lehno-kicker" style={{ marginBottom: 8 }}>{t[m.titre]}</div>
          <div style={{
            border: "1px solid var(--border-object)",
            borderRadius: "var(--radius-lg)", overflow: "hidden"
          }}>
            {m.items.map((e, i) => (
              <button key={e.nom} type="button" onClick={() => onOpen && onOpen("occasion", e)}
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
                  <span className="lehno-display" style={{
                    fontSize: 16, display: "block", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis"
                  }}>{t.langue === "fr" ? e.nom : (e.nomEn || e.nom)}</span>
                  <span style={{
                    display: "block", fontSize: 12.5, color: "var(--text-secondary)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                  }}>{t.langue === "fr" ? e.quoi : (e.quoiEn || e.quoi)}</span>
                </span>
                <Countdown label={e.j === 0 ? t.aujourdhui : t.decompte(e.j)} today={e.j === 0}
                  size="s" style={{ flex: "none" }} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Calendrier({ t, onOpen, mois, choisi, setChoisi, revenir, flags }) {
  const parJour = parMois(flags)[mois] || {};

  const cases = [];
  for (let i = 0; i < debutMois(mois); i++) cases.push(null);
  for (let j = 1; j <= joursMois(mois); j++) cases.push(j);

  const retenu = choisi ? parJour[choisi] : null;

  return (
    <>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 3
      }}>
        {t.joursCourts.map((d, i) => (
          <div key={i} style={{
            textAlign: "center", fontFamily: "var(--font-body)", fontSize: 10.5,
            fontWeight: 600, color: "var(--text-mention)", paddingBottom: 1
          }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cases.map((j, i) => {
          if (j === null) return <div key={"v" + i} />;
          const evt = parJour[j];
          const jour = mois === AUJOURD_HUI.mois && j === AUJOURD_HUI.jour;
          const actif = j === choisi;
          return (
            <button key={j} type="button" onClick={() => setChoisi(j)}
              aria-current={jour ? "date" : undefined} className="lehno-focusable"
              style={{
                all: "unset", boxSizing: "border-box", cursor: "pointer",
                aspectRatio: "1 / 0.8", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                borderRadius: "var(--radius-xs)",
                background: jour ? "var(--celebrate)"
                  : actif ? "var(--action-quiet-bg)" : "transparent",
                boxShadow: actif ? "inset 0 0 0 2px var(--action)" : "none",
                color: jour ? "var(--on-celebrate)"
                  : actif ? "var(--text-accent)" : "var(--text-body)"
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
                  ? (jour ? "var(--on-celebrate)" : "var(--action)")
                  : "transparent"
              }} />
            </button>
          );
        })}
      </div>

      {mois === AUJOURD_HUI.mois ? null : (
        <button type="button" onClick={revenir} className="lehno-focusable" style={{
          all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
          gap: 6, minHeight: "var(--touch-min)", marginTop: 2,
          fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
          color: "var(--text-accent)"
        }}>
          <Icon name="corner-up-left" size={14} strokeWidth={2} /> {t.moisCourant}
        </button>
      )}

      {/* Le détail du jour touché, sous la grille : la grille dit combien, le
          panneau dit qui. */}
      <div style={{ marginTop: 8, minHeight: "var(--touch-min)" }}>
        {retenu ? (
          <button type="button" onClick={() => onOpen && onOpen("occasion", retenu)}
            className="lehno-focusable" style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
              display: "flex", alignItems: "center", gap: 12, padding: "13px 14px",
              minHeight: "var(--touch-min)", borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-object)", overflow: "hidden"
            }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="lehno-display" style={{ fontSize: 16, display: "block" }}>{t.langue === "fr" ? retenu.nom : (retenu.nomEn || retenu.nom)}</span>
              <span style={{
                display: "block", fontSize: 12.5, color: "var(--text-secondary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
              }}>{t.langue === "fr" ? retenu.quoi : (retenu.quoiEn || retenu.quoi)}</span>
            </span>
            <Countdown label={retenu.j === 0 ? t.aujourdhui : t.decompte(retenu.j)} today={retenu.j === 0} size="s" />
            <Icon name="chevron-right" size={15} color="var(--text-mention)" style={{ flex: "none" }} />
          </button>
        ) : choisi ? (
          <p style={{
            margin: 0, fontSize: 13, color: "var(--text-mention)", padding: "11px 2px"
          }}>{t.calendrierRien}</p>
        ) : null}
      </div>
    </>
  );
}

export function DatesScreen({ t, etat = "nominal", flags = {}, onOpen }) {
  /* Le calendrier par défaut : on vient d'abord voir comment le mois est
     rempli. La liste répond à la question suivante — dans quel ordre. */
  const [vue, setVue] = React.useState(etat === "liste" ? "liste" : "calendrier");
  React.useEffect(() => { setVue(etat === "liste" ? "liste" : "calendrier"); }, [etat]);
  /* La case retenue vit ici, pas dans la grille : l'action d'ajout en a besoin. */
  const [mois, setMois] = React.useState(AUJOURD_HUI.mois);
  const [choisi, setChoisi] = React.useState(AUJOURD_HUI.jour);

  return (
    /* L'écran occupe la hauteur, la liste défile dedans : l'action reste au
       pied du téléphone. Posée en absolu sur un contenu qui grandit, elle
       s'échouait au milieu des dates. */
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "var(--ry-haut) 16px 12px", flex: 1, minHeight: 0, overflowY: "auto" }}>
        {/* Deux vues, pas un compromis : la liste répond « qu'est-ce qui
            m'attend », le calendrier « comment mon mois est rempli ». La bascule
            tient sur la ligne du titre — une rangée de plus se paie cher sur un
            petit écran, et les deux icônes se lisent sans légende. */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6, margin: "0 0 var(--ry-titre)"
        }}>
          {/* Sur le calendrier, le mois EST le titre de la vue : le nom de
              l'écran est déjà dans la barre d'onglets, et la plage se change ici
              plutôt que de rester muette. */}
          {vue === "calendrier" && etat !== "vide" ? (
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 0, marginLeft: -10 }}>
              <button type="button" aria-label={t.moisPrecedent} className="lehno-focusable"
                onClick={() => { setMois((m) => m - 1); setChoisi(null); }}
                style={{
                  all: "unset", cursor: "pointer", display: "grid", placeItems: "center",
                  width: 38, minHeight: "var(--touch-min)", flex: "none",
                  color: "var(--text-secondary)"
                }}><Icon name="chevron-left" size={19} /></button>
              <h1 className="lehno-display" style={{
                fontSize: 20, letterSpacing: "-.02em", margin: 0, fontWeight: 500,
                textTransform: "capitalize", whiteSpace: "nowrap", minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis"
              }}>{titreMois(mois, t.langue)}</h1>
              <button type="button" aria-label={t.moisSuivant} className="lehno-focusable"
                onClick={() => { setMois((m) => m + 1); setChoisi(null); }}
                style={{
                  all: "unset", cursor: "pointer", display: "grid", placeItems: "center",
                  width: 38, minHeight: "var(--touch-min)", flex: "none",
                  color: "var(--text-secondary)"
                }}><Icon name="chevron-right" size={19} /></button>
            </div>
          ) : (
            <h1 className="lehno-display" style={{
              fontSize: 25, letterSpacing: "-.025em", margin: 0, fontWeight: 500, flex: 1
            }}>{t.datesTitre}</h1>
          )}
          {etat === "vide" ? null : (
          <button type="button" onClick={() => setVue(vue === "liste" ? "calendrier" : "liste")}
            aria-label={vue === "liste" ? t.vueCalendrier : t.vueListe}
            className="lehno-focusable" style={{
              all: "unset", cursor: "pointer", flex: "none", display: "grid",
              placeItems: "center", width: "var(--touch-min)", minHeight: "var(--touch-min)",
              borderRadius: "var(--radius-pill)", border: "1px solid var(--border-object)",
              boxSizing: "border-box", color: "var(--text-secondary)"
            }}>
            <Icon name={vue === "liste" ? "calendar-days" : "list"} size={18} />
          </button>
          )}
        </div>

        {etat === "vide" ? (
          <EmptyState illustration="calendrier-sans-date" titre={t.videDatesTitre}
            texte={t.videDatesTexte} />
        ) : vue === "liste" ? <Liste t={t} onOpen={onOpen} flags={flags} />
          : <Calendrier t={t} onOpen={onOpen} mois={mois} choisi={choisi} setChoisi={setChoisi}
              flags={flags}
              revenir={() => { setMois(AUJOURD_HUI.mois); setChoisi(AUJOURD_HUI.jour); }} />}
      </div>

      {/* L'action de l'écran, au pied : atteignable au pouce quel que soit le
          défilement — une date s'ajoute au moment où on y pense. */}
      <div style={{ flex: "none", padding: "8px 16px 12px" }}>
        {/* Depuis le calendrier, la date touchée est déjà choisie : le formulaire
            s'ouvre dessus plutôt que de la redemander. */}
        <Button platform="mobile" full icon="plus"
          onClick={() => onOpen && onOpen("evenement", vue === "calendrier" && choisi
            ? { jour: choisi, moisFr: nomMois(mois, "fr"), moisEn: nomMois(mois, "en") }
            : undefined)}>{t.ajouterDate}</Button>
      </div>
    </div>
  );
}
