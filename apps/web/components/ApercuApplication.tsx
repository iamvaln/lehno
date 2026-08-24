import type { CSSProperties, ReactNode } from "react";
import type { Langue } from "../lib/langues.js";
import type { Messages } from "../messages/index.js";
import { Countdown, Icon, Wordmark } from "./ui/index.js";

const LIGNE: CSSProperties = {
  border: "var(--border-width) solid var(--border-object)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-12) var(--space-14)",
  marginTop: "var(--space-8)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "var(--space-10)",
};

const onglet = (actif: boolean): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--space-4)",
  color: actif ? "var(--text-accent)" : "var(--text-mention)",
});

const ONGLETS: { icone: string; nom: (t: Messages) => string }[] = [
  { icone: "house", nom: (t) => t.tabAccueil },
  { icone: "calendar", nom: (t) => t.tabDates },
  { icone: "heart", nom: (t) => t.tabProches },
  { icone: "circle-user", nom: (t) => t.tabMoi },
];

// L'accueil de l'application, tel qu'il paraît dans le héros. Ce n'est pas l'écran
// réel : c'est ce qu'il promet — une échéance qui porte ses actions, les suivantes
// en lignes calmes.
export function ApercuApplication({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  return (
    <div
      style={{
        background: "var(--surface-page)", height: "100%", paddingTop: "var(--space-44)",
        boxSizing: "border-box", color: "var(--text-body)", display: "flex",
        flexDirection: "column", overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "var(--space-6) var(--space-16) var(--space-10)", display: "flex",
          justifyContent: "space-between", alignItems: "center",
          borderBottom: "var(--border-width) solid var(--border-object)", flex: "none",
        }}
      >
        <span style={{ lineHeight: 0 }}>
          <Wordmark height={18} alt={t.altMarque} />
        </span>
        <span style={{ position: "relative", color: "var(--text-body)", lineHeight: 0 }}>
          <Icon name="bell" size={19} />
          <span
            style={{
              position: "absolute", top: -5, right: -6, minWidth: 15, height: 15, boxSizing: "border-box",
              padding: "0 3px", borderRadius: "var(--radius-pill)", background: "var(--celebrate)",
              color: "var(--on-celebrate)", border: "var(--border-width-firm) solid var(--surface-page)",
              fontSize: 10, fontWeight: "var(--font-body-bold)", lineHeight: "12px", textAlign: "center",
            }}
          >
            3<span className="lecture-seule"> — {t.notifications}</span>
          </span>
        </span>
      </div>

      <div style={{ padding: "var(--space-14) var(--space-16) var(--space-6)", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div className="titre" style={{ fontSize: 25, fontWeight: "var(--font-display-medium)", lineHeight: "var(--leading-title)" }}>{t.salut}</div>
        <div style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)", marginTop: "var(--space-4)" }}>{t.salutSous}</div>

        <div style={{ background: "var(--surface-panel)", borderRadius: "var(--radius-md)", padding: "var(--space-14)", marginTop: "var(--space-16)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-10)" }}>
            <div style={{ minWidth: 0 }}>
              <div className="titre" style={{ fontSize: 19, fontWeight: "var(--font-display-medium)" }}>Celarine</div>
              <div style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>{t.anniv} · {t.aujourdhui}</div>
            </div>
            <Countdown days={0} today locale={langue} size="s" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "var(--space-8)", marginTop: "var(--space-12)" }}>
            <span style={{ background: "var(--action)", color: "var(--text-on-accent)", borderRadius: "var(--radius-sm)", padding: "var(--space-8)", textAlign: "center", fontSize: "var(--text-body-s)", fontWeight: "var(--font-body-semibold)" }}>{t.preparer}</span>
            <span style={{ border: "var(--border-width) solid var(--border-object)", color: "var(--text-secondary)", borderRadius: "var(--radius-sm)", padding: "var(--space-8) var(--space-14)", textAlign: "center", fontSize: "var(--text-body-s)", fontWeight: "var(--font-body-semibold)" }}>{t.marquer}</span>
          </div>
        </div>

        <div style={LIGNE}>
          <div style={{ minWidth: 0 }}>
            <div className="titre" style={{ fontSize: 19, fontWeight: "var(--font-display-medium)" }}>Valery</div>
            <div style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>{t.anniv} · {t.date24}</div>
          </div>
          <Countdown days={3} locale={langue} size="s" />
        </div>

        <div style={LIGNE}>
          <div style={{ minWidth: 0 }}>
            <div className="titre" style={{ fontSize: 19, fontWeight: "var(--font-display-medium)", whiteSpace: "nowrap" }}>Mathias &amp; Rose</div>
            <div style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)", marginTop: "var(--space-2)" }}>{t.mariage} · {t.date30}</div>
          </div>
          <Countdown days={9} locale={langue} size="s" />
        </div>

        <div
          style={{
            marginTop: "var(--space-10)", background: "var(--action)", color: "var(--text-on-accent)",
            textAlign: "center", borderRadius: "var(--radius-md)", padding: "var(--space-14)",
            fontWeight: "var(--font-body-semibold)", fontSize: "var(--text-body-m)",
          }}
        >
          {t.appBouton}
        </div>
      </div>

      <div
        style={{
          borderTop: "var(--border-width) solid var(--border-object)", background: "var(--surface-page)",
          padding: "var(--space-8) var(--space-14) var(--space-14)", display: "grid",
          gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-4)", flex: "none",
        }}
      >
        {ONGLETS.map(({ icone, nom }, index) => (
          <div key={icone} style={onglet(index === 0)}>
            <Icon name={icone} size={21} />
            <span style={{ fontSize: 10.5, fontWeight: "var(--font-body-semibold)" }}>{nom(t)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
