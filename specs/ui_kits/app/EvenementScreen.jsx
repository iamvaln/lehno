import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { SensitiveBanner } from "../../components/feedback/SensitiveBanner.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";

export function EvenementScreen({ t, etat = "nominal", qui = "Valery Bah", onEnregistrer }) {
  const [type, setType] = React.useState("anniversaire");
  const [details, setDetails] = React.useState(false);
  const [sansAnnee, setSansAnnee] = React.useState(false);
  const [nature, setNature] = React.useState(etat === "sensible" ? "sensitive" : "happy");
  const sensible = etat === "sensible" || nature === "sensitive";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {sensible ? <SensitiveBanner texte={t.sensibleForm} /> : null}
      {etat === "erreur" ? <Banner intent="warning">{t.evtDejaAnniv}</Banner> : null}

      <div style={{ padding: "8px 16px 18px", flex: 1 }}>
        <SectionLabel>{t.evtType}</SectionLabel>
        <div style={{ display: "grid", gap: 8, marginTop: 9 }}>
          {/* L'anniversaire est mis en avant, le reste est un chemin secondaire */}
          <button type="button" onClick={() => setType("anniversaire")}
            aria-pressed={type === "anniversaire"} className="lehno-focusable" style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
              display: "flex", alignItems: "center", gap: 10, minHeight: "var(--touch-min)",
              padding: "12px 14px", borderRadius: "var(--radius-lg)",
              border: "1px solid " + (type === "anniversaire" ? "var(--action)" : "var(--border-object)"),
              background: type === "anniversaire" ? "var(--action-quiet-bg)" : "transparent",
              fontFamily: "var(--font-body)", fontSize: 15.5, fontWeight: 600,
              color: type === "anniversaire" ? "var(--text-accent)" : "var(--text-body)"
            }}>
            <Icon name="cake" size={19} /> {t.typeAnniversaire}
          </button>
          <button type="button" onClick={() => setType("autre")}
            aria-pressed={type === "autre"} className="lehno-focusable" style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
              display: "flex", alignItems: "center", gap: 8, minHeight: 40, padding: "8px 14px",
              fontFamily: "var(--font-body)", fontSize: 14,
              color: type === "autre" ? "var(--text-accent)" : "var(--text-secondary)",
              fontWeight: type === "autre" ? 600 : 400
            }}>
            {t.evtAutreType} <Icon name="chevron-right" size={14} />
          </button>
        </div>

        <div style={{ marginTop: 22 }}>
          <SectionLabel>{t.evtPourQui}</SectionLabel>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginTop: 9,
            padding: "10px 13px", borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-object)", minHeight: "var(--touch-min)",
            boxSizing: "border-box"
          }}>
            <Avatar name={qui} size={32} />
            <span className="lehno-display" style={{ fontSize: 15.5, flex: 1 }}>{qui}</span>
            <Icon name="chevron-down" size={15} color="var(--text-mention)" />
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-mention)", marginTop: 7 }}>
            {t.evtCreerProche}
          </div>
        </div>

        {/* Le libellé libre n'existe que pour « autre » : un anniversaire porte
            un libellé de traduction, pas un texte saisi. */}
        {type === "autre" ? (
          <div style={{ marginTop: 22 }}>
            <TextField platform="mobile" label={t.evtLabel}
              defaultValue={t.langue === "fr" ? "Mariage" : "Wedding"} hint={t.evtLabelAide} />
          </div>
        ) : null}

        <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
          <SectionLabel>{t.evtDate}</SectionLabel>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><TextField platform="mobile" label={t.evtJour} defaultValue="24" /></div>
            <div style={{ flex: 2 }}><TextField platform="mobile" label={t.evtMois} defaultValue={t.langue === "fr" ? "août" : "August"} /></div>
            <div style={{ flex: 1.2, opacity: sansAnnee ? 0.45 : 1 }}>
              <TextField platform="mobile" label={t.evtAnnee}
                defaultValue={sansAnnee ? "" : "1990"} />
            </div>
          </div>
          {/* Une case, pas une phrase : « je ne connais pas l'année » est un
              état du modèle, et un champ vide ne dit pas s'il est inconnu ou
              seulement oublié. */}
          <button type="button" onClick={() => setSansAnnee((v) => !v)}
            role="checkbox" aria-checked={sansAnnee} className="lehno-focusable"
            style={{
              all: "unset", cursor: "pointer", display: "flex", alignItems: "center",
              gap: 9, minHeight: "var(--touch-min)", fontFamily: "var(--font-body)",
              fontSize: 13.5, color: "var(--text-secondary)"
            }}>
            <span style={{
              width: 20, height: 20, borderRadius: 5, flex: "none",
              display: "grid", placeItems: "center",
              border: "1px solid " + (sansAnnee ? "transparent" : "var(--border-object)"),
              background: sansAnnee ? "var(--action)" : "transparent"
            }}>
              {sansAnnee ? <Icon name="check" size={13} strokeWidth={2.6}
                color="var(--text-on-accent)" /> : null}
            </span>
            {t.evtAnneeInconnue}
          </button>
        </div>

        <button type="button" onClick={() => setDetails((v) => !v)} aria-expanded={details}
          className="lehno-focusable" style={{
            all: "unset", cursor: "pointer", marginTop: 22, display: "flex",
            alignItems: "center", gap: 7, minHeight: "var(--touch-min)",
            fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--text-accent)"
          }}>
          <Icon name={details ? "chevron-down" : "chevron-right"} size={15} /> {t.evtDetails}
        </button>

        {details ? (
          <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
            <div>
              <SectionLabel>{t.evtNature}</SectionLabel>
              <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
                {[["happy", t.evtNatureJoyeux], ["sensitive", t.evtNatureSensible]].map(([k, l]) => {
                  const actif = nature === k;
                  return (
                    <button key={k} type="button" onClick={() => setNature(k)} aria-pressed={actif}
                      className="lehno-focusable" style={{
                        fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                        padding: "8px 14px", minHeight: 38, borderRadius: "var(--radius-pill)",
                        cursor: "pointer",
                        border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
                        background: actif ? "var(--action)" : "transparent",
                        color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                      }}>{l}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-mention)", marginTop: 8 }}>{t.evtNatureAide}</div>
            </div>
            <div>
              <SectionLabel>{t.evtRappel}</SectionLabel>
              <div style={{ fontSize: 14, marginTop: 6 }}>{t.evtRappelDefaut}</div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ padding: "0 16px 16px", flex: "none" }}>
        <Button platform="mobile" full onClick={onEnregistrer}>{t.enregistrer}</Button>
      </div>
    </div>
  );
}
