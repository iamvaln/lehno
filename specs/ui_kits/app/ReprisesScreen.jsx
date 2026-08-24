import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Countdown } from "../../components/content/Countdown.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";

/* Reprises en cours (3.16) — ce qu'on a lancé et laissé en plan.

   L'écran existe pour tenir une promesse : rien ne se perd. Il se lit donc du
   plus urgent au moins urgent — l'occasion la plus proche d'abord —, et non par
   date de création : ce qui presse n'est pas ce qu'on a commencé en dernier.

   Une occasion passée ne disparaît pas de la liste : le travail existe encore,
   et c'est à l'utilisateur de décider s'il le jette. La mention le signale
   sans le condamner. */

const REPRISES = {
  fr: [
    { id: "r1", genre: "repriseBrouillon", qui: "Awa Diop", jours: 0,
      extrait: "Awa, cette année encore tu as tenu tout le monde debout…" },
    { id: "r2", genre: "repriseIdees", qui: "Valery Bah", jours: 3,
      extrait: "Trois pistes, dont le moulin à café" },
    { id: "r3", genre: "reprisePortrait", qui: "Maman", jours: 12,
      extrait: "Commencé, pas encore relu" },
    { id: "r4", genre: "repriseBrouillon", qui: "Sarah", jours: -6,
      extrait: "Un mot pour ses trente ans" }
  ],
  en: [
    { id: "r1", genre: "repriseBrouillon", qui: "Awa Diop", jours: 0,
      extrait: "Awa, another year of keeping everyone standing…" },
    { id: "r2", genre: "repriseIdees", qui: "Valery Bah", jours: 3,
      extrait: "Three directions, including the coffee grinder" },
    { id: "r3", genre: "reprisePortrait", qui: "Maman", jours: 12,
      extrait: "Started, not read back yet" },
    { id: "r4", genre: "repriseBrouillon", qui: "Sarah", jours: -6,
      extrait: "A few words for the thirtieth" }
  ]
};

const ICONES = {
  repriseBrouillon: "pencil-line",
  repriseIdees: "gift",
  reprisePortrait: "sparkles"
};

export function ReprisesScreen({ t, etat = "nominal", onOpen }) {
  const langue = t.langue === "fr" ? "fr" : "en";

  if (etat === "vide") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="rien-approche"
          titre={t.reprisesVideTitre} texte={t.reprisesVideTexte} />
      </div>
    );
  }

  /* Du plus urgent au moins urgent ; les dates dépassées ferment la liste. */
  const liste = [...REPRISES[langue]].sort((a, b) => {
    const passe = (x) => (x.jours < 0 ? 1 : 0);
    if (passe(a) !== passe(b)) return passe(a) - passe(b);
    return a.jours - b.jours;
  });

  return (
    <div style={{ padding: "0 16px 18px" }}>
      <p style={{
        margin: "4px 0 18px", fontSize: 14, color: "var(--text-secondary)", maxWidth: "36ch"
      }}>{t.reprisesIntro}</p>

      {liste.map((r) => {
        const passee = r.jours < 0;
        return (
          <Card key={r.id} padding={15} radius="lg" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
              <span style={{
                width: 32, height: 32, borderRadius: "var(--radius-xs)", flex: "none",
                background: "var(--action-quiet-bg)", color: "var(--text-accent)",
                display: "grid", placeItems: "center"
              }}>
                <Icon name={ICONES[r.genre]} size={16} />
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{t[r.genre]}</div>
                <div className="lehno-display" style={{ fontSize: 17, marginTop: 1 }}>{r.qui}</div>
              </div>

              {passee ? (
                <span style={{
                  fontSize: 11.5, color: "var(--text-mention)", whiteSpace: "nowrap", marginTop: 3
                }}>{t.repriseDepassee}</span>
              ) : (
                <Countdown days={r.jours} size="s" locale={t.langue} />
              )}
            </div>

            <Quote size={14} tone="muted" style={{ marginTop: 10 }}>{r.extrait}</Quote>

            <Button platform="mobile" full variant="outline" style={{ marginTop: 12 }}
              onClick={() => onOpen && onOpen("generation")}>{t.repriseReprendre}</Button>
          </Card>
        );
      })}
    </div>
  );
}
