import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Card } from "../../components/core/Card.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { OfflineBanner } from "../../components/feedback/OfflineBanner.jsx";

export function SouhaitScreen({ t, etat = "nominal" }) {
  if (etat === "vide") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="souhaits-vide" titre={t.videSouhaitsTitre}
          texte={t.videSouhaitsTexte} action={t.souhaitAjouter} />
      </div>
    );
  }

  const reserve = etat === "reserve";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {etat === "horsligne" ? <OfflineBanner t={t} enAttente={1} /> : null}

      <div style={{ padding: "8px 16px 18px", flex: 1 }}>
        {/* La photo de l'objet, facultative — spec 3.19 */}
        <div style={{
          height: 132, borderRadius: "var(--radius-lg)", background: "var(--surface-panel)",
          display: "grid", placeItems: "center", color: "var(--text-mention)", marginBottom: 16
        }}>
          <Icon name="image" size={24} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <h1 className="lehno-display" style={{
            fontSize: 22, letterSpacing: "-.02em", margin: 0, fontWeight: 500, flex: 1
          }}>{t.souhaitExemple}</h1>
          <Tag tone={reserve ? "quiet" : "outline"} style={{ flex: "none" }}>
            {reserve ? t.souhaitReserve : t.souhaitDisponible}
          </Tag>
        </div>

        <div className="lehno-display" style={{
          fontSize: 26, fontWeight: 400, letterSpacing: "-.02em", marginTop: 10
        }}>{t.souhaitPrix}</div>

        <div style={{ marginTop: 20 }}>
          <SectionLabel>{t.souhaitPrecisions}</SectionLabel>
          <p style={{ margin: "7px 0 0", fontSize: 14.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {t.souhaitPrecisionsTexte}
          </p>
        </div>

        <Card padding={14} radius="lg" style={{ marginTop: 16 }}>
          <SectionLabel>{t.souhaitProvenance}</SectionLabel>
          <Quote size={14.5} style={{ marginTop: 6 }}>{t.souhaitParole}</Quote>
          <Provenance origin={t.souhaitOrigine} date={t.souhaitOrigineDate} />
        </Card>

        {reserve ? (
          <div style={{
            marginTop: 14, padding: "12px 14px", background: "var(--surface-panel)",
            fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.5
          }}>{t.souhaitReserveTexte}</div>
        ) : null}

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border-hairline)"
        }}>
          <span style={{ fontSize: 14.5 }}>{t.souhaitSurMur}</span>
          <span style={{
            width: 44, height: 26, borderRadius: 999, background: "var(--action)",
            position: "relative", flex: "none"
          }}>
            <span style={{
              position: "absolute", top: 3, right: 3, width: 20, height: 20,
              borderRadius: "50%", background: "var(--text-on-accent)"
            }} />
          </span>
        </div>
      </div>

      <div style={{ padding: "0 16px 16px", flex: "none", display: "grid", gap: 8 }}>
        <Button platform="mobile" full variant="outline">{t.souhaitOffert}</Button>
        <Button platform="mobile" full variant="text">{t.modifier}</Button>
      </div>
    </div>
  );
}
