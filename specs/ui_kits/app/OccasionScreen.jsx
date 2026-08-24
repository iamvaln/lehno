import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { Card } from "../../components/core/Card.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Countdown } from "../../components/content/Countdown.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";
import { SensitiveBanner } from "../../components/feedback/SensitiveBanner.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { OfflineBanner } from "../../components/feedback/OfflineBanner.jsx";

export function OccasionScreen({ t, qui = "Valery Bah", etat = "nominal", onOpen }) {
  const sensible = etat === "sensible";
  const passee = etat === "passee";
  const soldeVide = etat === "solde";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {sensible ? <SensitiveBanner>{t.sensibleApproche}</SensitiveBanner> : null}
      {etat === "horsligne" ? <OfflineBanner t={t} /> : null}

      <div style={{ padding: "8px 16px 18px", flex: 1 }}>
        {/* En-tête : le proche, le type, la date et le décompte */}
        <button type="button" onClick={() => onOpen && onOpen("proche", { nom: qui })} className="lehno-focusable"
          style={{
            all: "unset", cursor: "pointer", display: "flex", alignItems: "center",
            gap: 12, width: "100%", boxSizing: "border-box"
          }}>
          <Avatar name={qui} size={46} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="lehno-display" style={{ fontSize: 20, display: "block" }}>{qui}</span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {t.typeAnniversaire} · {t.langue === "fr" ? "24 août" : "24 Aug"}
            </span>
          </span>
          {passee
            ? <Tag tone="quiet">{t.occPassee}</Tag>
            : <Countdown days={3} size="m" locale={t.langue} />}
        </button>

        {passee ? (
          <>
            <div style={{ marginTop: 24 }}>
              <SectionLabel>{t.occMessageEnvoye}</SectionLabel>
              <Card padding={15} radius="lg" style={{ marginTop: 9 }}>
                <Quote size={15}>{t.occMessageTexte}</Quote>
                <Provenance origin={t.occEnvoyeLe} date={t.langue === "fr" ? "24 août" : "24 Aug"} />
              </Card>
            </div>
            <div style={{ marginTop: 20 }}>
              <SectionLabel>{t.occVoeuxRecus}</SectionLabel>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
                {t.occAucunVoeu}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* La liste de souhaits de l'occasion */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <SectionLabel>{t.occSouhaits}</SectionLabel>
                <button type="button" onClick={() => onOpen && onOpen("souhait")}
                  className="lehno-focusable" style={{
                    all: "unset", cursor: "pointer", marginLeft: "auto",
                    fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-accent)"
                  }}>{t.souhaitAjouter}</button>
              </div>

              {sensible ? (
                <div style={{ fontSize: 13.5, color: "var(--text-mention)", marginTop: 9 }}>
                  {t.occSansSouhait}
                </div>
              ) : (
                <div style={{ display: "grid", marginTop: 6 }}>
                  {[[t.souhaitExemple, "outline", t.souhaitDisponible],
                    [t.souhaitAutre, "quiet", t.souhaitReserve]].map(([nom, ton, st], i) => (
                    <button key={nom} type="button" onClick={() => onOpen && onOpen("souhait")}
                      className="lehno-focusable" style={{
                        all: "unset", boxSizing: "border-box", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10, padding: "12px 0",
                        minHeight: "var(--touch-min)",
                        borderTop: i ? "1px solid var(--border-hairline)" : "none"
                      }}>
                      <span style={{ flex: 1, fontSize: 14.5 }}>{nom}</span>
                      <Tag tone={ton} style={{ fontSize: 11, padding: "2px 8px" }}>{st}</Tag>
                      <Icon name="chevron-right" size={15} color="var(--text-mention)" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notes propres à cette célébration */}
            <div style={{ marginTop: 22 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <SectionLabel>{t.occNotes}</SectionLabel>
                <button type="button" onClick={() => onOpen && onOpen("note", { nom: qui })}
                  className="lehno-focusable" style={{
                    all: "unset", cursor: "pointer", marginLeft: "auto",
                    fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-accent)"
                  }}>{t.noteAjouter}</button>
              </div>
              <Card padding={14} radius="lg" style={{ marginTop: 9 }}>
                <Quote size={14.5}>{t.occNoteTexte}</Quote>
                <Provenance origin={t.souhaitOrigine} date={t.occNoteDate} />
              </Card>
            </div>

            {/* La préparation assistée — une occasion sensible se concentre
                sur le message, sans idée de cadeau. */}
            <div style={{ marginTop: 24 }}>
              <SectionLabel>{t.occPreparer}</SectionLabel>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {!sensible ? (
                  <div>
                    <Button platform="mobile" full variant="outline" icon="sparkles"
                      onClick={() => onOpen && onOpen("idees", { nom: qui })}>{t.occIdees}</Button>
                    <CreditIndicator t={t} cout={1} style={{ marginTop: 7 }} />
                  </div>
                ) : null}
                <div>
                  <Button platform="mobile" full onClick={() => onOpen && onOpen("message", { nom: qui })}>
                    {t.occMessage}
                  </Button>
                  <CreditIndicator t={t} cout={1} style={{ marginTop: 7 }} />
                </div>
                {/* Le solde une seule fois, en pied du bloc — le répéter sous
                    chaque action le transforme en bruit. */}
                <CreditIndicator t={t} solde={soldeVide ? 0 : 4}
                  onRecharger={() => onOpen && onOpen("recharge")} style={{ marginTop: 4 }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
