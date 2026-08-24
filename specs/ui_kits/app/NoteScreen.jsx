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

export function NoteScreen({ t, etat = "nominal", qui = "Valery Bah", onEnregistrer }) {
  const [texte, setTexte] = React.useState(
    t.langue === "fr"
      ? "Valery a parlé d'un moulin à café manuel — le précédent rend l'âme."
      : "Valery mentioned a hand coffee grinder — the old one is on its last legs."
  );
  const sansProche = etat === "erreur";
  const [cats, setCats] = React.useState(["idee"]);
  const [occ, setOcc] = React.useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {etat === "horsligne" ? <OfflineBanner t={t} /> : null}

      <div style={{ padding: "8px 16px 18px", flex: 1 }}>
        <TextField multiline rows={4} platform="mobile" autoFocus
          value={texte} onChange={(e) => setTexte(e.target.value)}
          label={t.noteLabel} />

        {etat === "chargement" ? (
          <div style={{ marginTop: 16 }}><LoadingState variant="envoi" titre={t.noteRangement} /></div>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 12,
            flexWrap: "wrap", fontSize: 12.5, color: "var(--text-mention)"
          }}>
            <span>{t.noteRange}</span>
            {/* Deux catégories au plus : le dictionnaire rattache une note à ses
                catégories en N–N, et une même phrase relève souvent de deux —
                « il a parlé d'un moulin à café » est à la fois une idée cadeau
                et un goût. N'en montrer qu'une forçait à trancher pour rien. */}
            {cats.map((c) => (
              <CategoryTag key={c} categorie={c} onReclasser={() => {}} />
            ))}
            {cats.length < 2 ? (
              <button type="button" onClick={() => setCats((v) => [...v, "gout"])}
                className="lehno-focusable" style={{
                  all: "unset", cursor: "pointer", display: "inline-flex",
                  alignItems: "center", gap: 5, minHeight: 30, padding: "0 10px",
                  borderRadius: "var(--radius-pill)",
                  border: "1px dashed var(--border-object)",
                  color: "var(--text-mention)", fontFamily: "var(--font-body)", fontSize: 12.5
                }}>
                <Icon name="plus" size={13} strokeWidth={2} /> {t.noteSecondeCat}
              </button>
            ) : (
              <span style={{ fontSize: 11.5 }}>{t.noteDeuxMax}</span>
            )}
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <SectionLabel>{t.notePourQui}</SectionLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 9 }}>
            {/* Aucune puce dans l'état d'erreur : le message dit qu'aucun proche
                n'est désigné, il ne peut pas cohabiter avec un proche désigné. */}
            {sansProche ? null : (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "var(--action-quiet-bg)", color: "var(--text-accent)",
                borderRadius: "var(--radius-pill)", padding: "5px 10px 5px 5px",
                fontFamily: "var(--font-body)", fontSize: 13.5
              }}>
                <Avatar name={qui} size={24} />
                {qui}
                <Icon name="x" size={13} strokeWidth={2} />
              </span>
            )}
            <button type="button" className="lehno-focusable" style={{
              all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              minHeight: 34, padding: "0 12px", borderRadius: "var(--radius-pill)",
              border: "1px dashed var(--border-object)", color: "var(--text-mention)",
              fontFamily: "var(--font-body)", fontSize: 13
            }}>
              <Icon name="plus" size={14} strokeWidth={2} /> {t.noteAjouterProche}
            </button>
          </div>
          {sansProche ? (
            <div style={{ fontSize: 12, color: "var(--feedback-error)", marginTop: 8 }}>
              {t.noteSansProche}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 20, opacity: sansProche ? 0.45 : 1 }}>
          <SectionLabel>{t.noteOccasion}</SectionLabel>
          <div style={{ fontSize: 12.5, color: "var(--text-mention)", margin: "6px 0 9px" }}>
            {t.noteOccasionAide}
          </div>

          {sansProche ? null : (
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {/* « Aucune » est un choix, pas une absence de choix : c'est ce
                  qui fait la note durable, celle qui ressert chaque année. */}
              <button type="button" onClick={() => setOcc(null)}
                aria-pressed={occ === null} className="lehno-focusable" style={{
                  all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                  minHeight: 34, padding: "0 13px", borderRadius: "var(--radius-pill)",
                  fontFamily: "var(--font-body)", fontSize: 13,
                  border: "1px solid " + (occ === null ? "transparent" : "var(--border-object)"),
                  background: occ === null ? "var(--action)" : "transparent",
                  color: occ === null ? "var(--text-on-accent)" : "var(--text-secondary)"
                }}>{t.noteOccasionDurable}</button>

              {/* Les dates du proche désigné — c'est lui qui détermine la liste. */}
              {OCCASIONS[t.langue === "fr" ? "fr" : "en"].map((o, i) => {
                const prise = occ === i;
                return (
                  <button key={o} type="button" onClick={() => setOcc(i)}
                    aria-pressed={prise} className="lehno-focusable" style={{
                      all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                      minHeight: 34, padding: "0 13px", borderRadius: "var(--radius-pill)",
                      fontFamily: "var(--font-body)", fontSize: 13,
                      border: "1px solid " + (prise ? "transparent" : "var(--border-object)"),
                      background: prise ? "var(--action)" : "transparent",
                      color: prise ? "var(--text-on-accent)" : "var(--text-body)"
                    }}>{o}</button>
                );
              })}

              {/* Le raccourci de création : une note se prend au moment où elle
                  vient, et la date qu'elle concerne n'existe pas toujours. */}
              <button type="button" className="lehno-focusable" style={{
                all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                gap: 6, minHeight: 34, padding: "0 12px", borderRadius: "var(--radius-pill)",
                border: "1px dashed var(--border-object)", color: "var(--text-accent)",
                fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600
              }}>
                <Icon name="plus" size={14} strokeWidth={2} /> {t.noteOccasionNouvelle}
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "0 16px 16px", flex: "none" }}>
        <Button platform="mobile" full disabled={sansProche} onClick={onEnregistrer}>
          {t.enregistrer}
        </Button>
      </div>
    </div>
  );
}
