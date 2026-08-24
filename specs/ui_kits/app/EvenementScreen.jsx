import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { SensitiveBanner } from "../../components/feedback/SensitiveBanner.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";

export function EvenementScreen({ t, etat = "nominal", onEnregistrer }) {
  const [type, setType] = React.useState("anniversaire");
  const [details, setDetails] = React.useState(false);
  const sensible = etat === "sensible";

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
            <Avatar name="Valery Bah" size={32} />
            <span className="lehno-display" style={{ fontSize: 15.5, flex: 1 }}>Valery Bah</span>
            <Icon name="chevron-down" size={15} color="var(--text-mention)" />
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-mention)", marginTop: 7 }}>
            {t.evtCreerProche}
          </div>
        </div>

        <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
          <SectionLabel>{t.evtDate}</SectionLabel>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><TextField platform="mobile" label={t.evtJour} defaultValue="24" /></div>
            <div style={{ flex: 2 }}><TextField platform="mobile" label={t.evtMois} defaultValue={t.langue === "fr" ? "août" : "August"} /></div>
            <div style={{ flex: 1.2 }}><TextField platform="mobile" label={t.evtAnnee} defaultValue="1990" /></div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-mention)" }}>{t.evtAnneeAide}</div>
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
              <div style={{ fontSize: 14, marginTop: 6 }}>{t.evtNatureJoyeux}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-mention)", marginTop: 3 }}>{t.evtNatureAide}</div>
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
