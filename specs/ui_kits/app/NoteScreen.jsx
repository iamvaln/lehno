import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { CategoryTag } from "../../components/content/CategoryTag.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { OfflineBanner } from "../../components/feedback/OfflineBanner.jsx";
import { LoadingState } from "../../components/feedback/LoadingState.jsx";

/* Spec 3.5 : « l'écran s'ouvre curseur dans la zone de texte, les champs de
   rattachement dessous ». Le champ occasion reste vide par défaut — une note
   prise à la volée décrit plus souvent le proche qu'une célébration. */
/* Les dates du proche désigné. Dans le produit elles viennent de ses Event ;
   ici deux suffisent à montrer qu'il y a un choix à faire. */
const OCCASIONS = {
  fr: ["Anniversaire · 24 août", "Retraite · 2 sept."],
  en: ["Birthday · 24 Aug", "Retirement · 2 Sep"]
};

export function NoteScreen({ t, etat = "nominal", qui = "Valery Bah", gens = [], note, onEnregistrer, onSupprimer }) {
  /* Ouverte depuis une note existante, la page montre CETTE note — son texte et
     sa nature. Sans note, c'est une saisie neuve. */
  const [texte, setTexte] = React.useState(
    note ? note.texte
      : t.langue === "fr"
        ? "Valery a parlé d'un moulin à café manuel — le précédent rend l'âme."
        : "Valery mentioned a hand coffee grinder — the old one is on its last legs."
  );
  const sansProche = etat === "erreur";
  const [cats, setCats] = React.useState([note && note.nature === "eviter" ? "nogo" : "idee"]);
  const [occ, setOcc] = React.useState(null);
  /* Une date créée depuis la note reste dans la note : partir sur l'écran des
     dates abandonnerait le texte en cours. Deux champs suffisent, et la date
     posée est aussitôt celle de la note. */
  const [ajouts, setAjouts] = React.useState([]);
  const [nouvelle, setNouvelle] = React.useState(null);
  const occasions = [...OCCASIONS[t.langue === "fr" ? "fr" : "en"], ...ajouts];
  /* Une note peut concerner deux personnes — un couple, deux frères. On les
     désigne sans quitter le texte en cours : la liste des proches s'ouvre ici,
     et un nom touché devient une puce. */
  const [pour, setPour] = React.useState([qui]);
  const [choix, setChoix] = React.useState(false);
  const [filtre, setFiltre] = React.useState("");
  const candidats = (gens.length ? gens.map((g) => (t.langue === "fr" ? g.nom : (g.nomEn || g.nom)))
    : ["Célarine Ndiaye", "Awa Sow", "Malick Diop"]).filter((n) => pour.indexOf(n) < 0);
  const trouves = candidats.filter(
    (n) => n.toLowerCase().indexOf(filtre.trim().toLowerCase()) >= 0
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {etat === "horsligne" ? <OfflineBanner t={t} /> : null}

      <div style={{ padding: "4px 16px 6px", flex: 1 }}>
        <TextField multiline rows={3} platform="mobile" autoFocus
          value={texte} onChange={(e) => setTexte(e.target.value)}
          label={t.noteLabel} />

        {etat === "chargement" ? (
          <div style={{ marginTop: 16 }}><LoadingState variant="envoi" titre={t.noteRangement} /></div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 10,
            flexWrap: "wrap", fontSize: 12.5, color: "var(--text-mention)"
          }}>
            <span>{t.noteRange}</span>
            {/* Deux catégories au plus : le dictionnaire rattache une note à ses
                catégories en N–N, et une même phrase relève souvent de deux —
                « il a parlé d'un moulin à café » est à la fois une idée cadeau
                et un goût. N'en montrer qu'une forçait à trancher pour rien. */}
            {cats.map((c) => (
              <CategoryTag key={c} categorie={c} t={t} onReclasser={() => {}} />
            ))}
            {cats.length < 2 ? (
              <button type="button" onClick={() => setCats((v) => [...v, "gout"])}
                className="lehno-focusable" style={{
                  all: "unset", cursor: "pointer", display: "inline-flex",
                  alignItems: "center", gap: 5, minHeight: "var(--touch-min)", padding: "0 12px",
                  borderRadius: "var(--radius-pill)",
                  border: "1px dashed var(--border-object)",
                  color: "var(--text-mention)", fontFamily: "var(--font-body)", fontSize: 12.5
                }}>
                <Icon name="plus" size={13} strokeWidth={2} /> {t.noteSecondeCat}
              </button>
            ) : null}
          </div>
        )}

        <div style={{ marginTop: 6 }}>
          <SectionLabel>{t.notePourQui}</SectionLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 5 }}>
            {/* Aucune puce dans l'état d'erreur : le message dit qu'aucun proche
                n'est désigné, il ne peut pas cohabiter avec un proche désigné. */}
            {sansProche ? null : (
              pour.map((n) => (
              <span key={n} style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "var(--action-quiet-bg)", color: "var(--text-accent)",
                borderRadius: "var(--radius-pill)", padding: "0 12px 0 6px",
                minHeight: "var(--touch-min)", boxSizing: "border-box",
                fontFamily: "var(--font-body)", fontSize: 13.5
              }}>
                <Avatar name={n} size={24} />
                {n}
                <button type="button" aria-label={n} className="lehno-focusable"
                  onClick={() => setPour((v) => v.filter((x) => x !== n))}
                  style={{
                    all: "unset", cursor: "pointer", display: "grid", placeItems: "center",
                    width: 22, height: 22, color: "var(--text-accent)"
                  }}><Icon name="x" size={13} strokeWidth={2} /></button>
              </span>
              ))
            )}
            {choix ? null : (
            <button type="button" onClick={() => { setFiltre(""); setChoix(true); }}
              className="lehno-focusable" style={{
              all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              minHeight: "var(--touch-min)", padding: "0 14px", borderRadius: "var(--radius-pill)",
              border: "1px dashed var(--border-object)", color: "var(--text-mention)",
              fontFamily: "var(--font-body)", fontSize: 13
            }}>
              <Icon name="plus" size={14} strokeWidth={2} /> {t.noteAjouterProche}
            </button>
            )}
          </div>
          {choix ? (
            /* Un carnet se cherche : cinquante noms ne se parcourent pas à l'œil. */
            <div style={{
              marginTop: 8, borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-object)", background: "var(--surface-card)",
              overflow: "hidden"
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 9, padding: "0 12px",
                minHeight: "var(--touch-min)", borderBottom: "1px solid var(--border-hairline)"
              }}>
                <Icon name="search" size={15} color="var(--text-mention)" />
                <input autoFocus value={filtre} onChange={(ev) => setFiltre(ev.target.value)}
                  placeholder={t.rechercher} style={{
                    all: "unset", flex: 1, minWidth: 0, fontFamily: "var(--font-body)",
                    fontSize: 14.5, color: "var(--text-body)", padding: "10px 0"
                  }} />
                <button type="button" aria-label={t.rechercher} className="lehno-focusable"
                  onClick={() => setChoix(false)} style={{
                    all: "unset", cursor: "pointer", display: "grid", placeItems: "center",
                    width: 26, height: 26, color: "var(--text-mention)"
                  }}><Icon name="x" size={15} strokeWidth={2} /></button>
              </div>
              <div style={{ maxHeight: 168, overflowY: "auto" }}>
                {trouves.length ? trouves.map((n) => (
                  <button key={n} type="button" className="lehno-focusable"
                    onClick={() => { setPour((v) => [...v, n]); setChoix(false); }}
                    style={{
                      all: "unset", cursor: "pointer", boxSizing: "border-box", width: "100%",
                      display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
                      minHeight: "var(--touch-min)", fontFamily: "var(--font-body)",
                      fontSize: 14.5, color: "var(--text-body)"
                    }}>
                    <Avatar name={n} size={26} />{n}
                  </button>
                )) : (
                  <div style={{
                    padding: "14px 12px", fontSize: 13.5, color: "var(--text-mention)"
                  }}>{t.videRechercheTitre}</div>
                )}
              </div>
            </div>
          ) : null}
          {sansProche ? (
            <div style={{ fontSize: 12, color: "var(--feedback-error)", marginTop: 8 }}>
              {t.noteSansProche}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 6, opacity: sansProche ? 0.45 : 1 }}>
          <SectionLabel>{t.noteOccasion}</SectionLabel>
          <div style={{ height: 3 }} />
          {sansProche ? null : (
            <div style={{ display: "grid", gap: 4 }}>
              {/* Les occasions du proche tiennent dans une liste déroulante :
                  en pastilles elles occupaient quatre rangs et repoussaient le
                  reste de l'écran. « Aucune » reste un choix, pas une absence
                  de choix — c'est ce qui fait la note durable. */}
              <div style={{ position: "relative" }}>
                <select value={occ === null ? "" : String(occ)}
                  onChange={(e) => {
                    /* Choisir une occasion existante r\u00e9pond \u00e0 la question que la
                       cr\u00e9ation posait : les deux champs se referment. */
                    setNouvelle(null);
                    setOcc(e.target.value === "" ? null : Number(e.target.value));
                  }}
                  aria-label={t.noteOccasion} className="lehno-focusable" style={{
                    appearance: "none", width: "100%", boxSizing: "border-box",
                    minHeight: "var(--touch-min)", padding: "0 38px 0 13px",
                    borderRadius: "var(--radius-sm)", border: "1px solid var(--border-object)",
                    background: "var(--surface-card)", color: "var(--text-body)",
                    fontFamily: "var(--font-body)", fontSize: 14.5, cursor: "pointer"
                  }}>
                  <option value="">{t.noteOccasionDurable}</option>
                  {occasions.map((o, i) => (
                    <option key={o} value={String(i)}>{o}</option>
                  ))}
                </select>
                <span style={{
                  position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                  pointerEvents: "none", color: "var(--text-mention)", display: "grid"
                }}><Icon name="chevron-down" size={16} /></span>
              </div>

              {/* Le raccourci de création : une note se prend au moment où elle
                  vient, et la date qu'elle concerne n'existe pas toujours. */}
              {nouvelle ? (
                <div style={{
                  display: "grid", gap: 8, marginTop: 6, padding: 12,
                  borderRadius: "var(--radius-sm)", border: "1px solid var(--border-object)",
                  background: "var(--surface-card)"
                }}>
                  <TextField platform="mobile" label={t.noteDateQuoi} value={nouvelle.quoi}
                    onChange={(e) => setNouvelle((v) => ({ ...v, quoi: e.target.value }))} />
                  <TextField platform="mobile" type="date" label={t.noteDateQuand} value={nouvelle.quand}
                    onChange={(e) => setNouvelle((v) => ({ ...v, quand: e.target.value }))} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button platform="mobile" variant="outline" style={{ flex: 1 }}
                      onClick={() => setNouvelle(null)}>{t.noteDateGarder}</Button>
                    <Button platform="mobile" style={{ flex: 1 }}
                      disabled={!nouvelle.quoi.trim()}
                      onClick={() => {
                        const libelle = nouvelle.quand
                          ? nouvelle.quoi.trim() + " · " + nouvelle.quand
                          : nouvelle.quoi.trim();
                        setAjouts((v) => [...v, libelle]);
                        setOcc(occasions.length);
                        setNouvelle(null);
                      }}>{t.noteDatePoser}</Button>
                  </div>
                </div>
              ) : (
              <button type="button" onClick={() => setNouvelle({ quoi: "", quand: "" })}
                className="lehno-focusable" style={{
                all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                gap: 6, minHeight: "var(--touch-min)", marginTop: -4,
                color: "var(--text-accent)", fontFamily: "var(--font-body)",
                fontSize: 13, fontWeight: 600
              }}>
                <Icon name="plus" size={14} strokeWidth={2} /> {t.noteOccasionNouvelle}
              </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{
        padding: "0 16px 10px", flex: "none", display: "flex", alignItems: "center", gap: 10
      }}>
        {note ? (
          <button type="button" onClick={onSupprimer} aria-label={t.noteSupprimer}
            className="lehno-focusable" style={{
              all: "unset", cursor: "pointer", flex: "none",
              minWidth: "var(--touch-min)", minHeight: "var(--touch-min)",
              display: "grid", placeItems: "center", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-object)", color: "var(--feedback-error)"
            }}><Icon name="trash-2" size={18} /></button>
        ) : null}
        <div style={{ flex: 1 }}>
          <Button platform="mobile" full disabled={sansProche} onClick={onEnregistrer}>
            {t.enregistrer}
          </Button>
        </div>
      </div>
    </div>
  );
}
