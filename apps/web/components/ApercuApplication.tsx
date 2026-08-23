import type { ReactNode } from "react";
import type { Messages } from "../messages";

const ligne = {
  border: "1px solid var(--line2)", borderRadius: 14, padding: "12px 15px", marginTop: 9,
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
} as const;

const decompte = {
  fontSize: 24, fontWeight: 500, color: "var(--violet-deep)", letterSpacing: "-.03em", flex: "none",
} as const;

const onglet = (actif: boolean) => ({
  display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4,
  color: actif ? "var(--violet-deep)" : "var(--faint)",
});

// L'accueil de l'application, tel qu'il paraît dans le héros. Ce n'est pas l'écran
// réel : c'est ce qu'il promet — une échéance qui porte ses actions, les suivantes
// en lignes calmes.
export function ApercuApplication({ t }: { t: Messages }): ReactNode {
  return (
    <div style={{ background: "var(--bg)", height: "100%", paddingTop: 46, boxSizing: "border-box", color: "var(--text)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "6px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line2)", flex: "none" }}>
        <span className="titre" style={{ fontWeight: 500, fontSize: 19, letterSpacing: "-.01em" }} aria-hidden="true">
          Le<span style={{ color: "var(--violet)" }}>h</span>no
        </span>
        <span style={{ position: "relative", color: "var(--text)", lineHeight: 0 }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          <span style={{ position: "absolute", top: -5, right: -6, minWidth: 15, height: 15, boxSizing: "border-box", padding: "0 3px", borderRadius: 999, background: "var(--apricot)", color: "var(--on-apricot)", border: "1.5px solid var(--bg)", fontSize: 10, fontWeight: 700, lineHeight: "12px", textAlign: "center" }}>
            3<span className="lecture-seule"> — {t.notifications}</span>
          </span>
        </span>
      </div>

      <div style={{ padding: "14px 18px 6px", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div className="titre" style={{ fontSize: 25, fontWeight: 500, letterSpacing: "-.022em", lineHeight: 1.15 }}>{t.salut}</div>
        <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>{t.salutSous}</div>

        <div style={{ background: "var(--panel)", borderRadius: 14, padding: 14, marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div className="titre" style={{ fontSize: 19, fontWeight: 500, letterSpacing: "-.01em" }}>Celarine</div>
              <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 2 }}>{t.anniv} · {t.aujourdhui}</div>
            </div>
            <span style={{ background: "var(--apricot)", color: "var(--on-apricot)", padding: "5px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, flex: "none" }}>{t.aujourdhui}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 13 }}>
            <span style={{ background: "var(--violet)", color: "var(--on-violet)", borderRadius: 9, padding: 9, textAlign: "center", fontSize: 14, fontWeight: 600 }}>{t.preparer}</span>
            <span style={{ border: "1px solid var(--edge)", color: "var(--muted)", borderRadius: 9, padding: "9px 14px", textAlign: "center", fontSize: 14, fontWeight: 600 }}>{t.marquer}</span>
          </div>
        </div>

        <div style={ligne}>
          <div style={{ minWidth: 0 }}>
            <div className="titre" style={{ fontSize: 19, fontWeight: 500, letterSpacing: "-.01em" }}>Valery</div>
            <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 2 }}>{t.anniv} · {t.date24}</div>
          </div>
          <div className="titre" style={decompte}>{t.j3}</div>
        </div>

        <div style={ligne}>
          <div style={{ minWidth: 0 }}>
            <div className="titre" style={{ fontSize: 19, fontWeight: 500, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>Mathias &amp; Rose</div>
            <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 2 }}>{t.mariage} · {t.date30}</div>
          </div>
          <div className="titre" style={decompte}>{t.j9}</div>
        </div>

        <div style={{ marginTop: 10, background: "var(--violet)", color: "var(--on-violet)", textAlign: "center", borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 16 }}>{t.appBouton}</div>
      </div>

      <div style={{ borderTop: "1px solid var(--line2)", background: "var(--bg)", padding: "9px 14px 14px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, flex: "none" }}>
        <div style={onglet(true)}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
          <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t.tabAccueil}</span>
        </div>
        <div style={onglet(false)}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t.tabDates}</span>
        </div>
        <div style={onglet(false)}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
          <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t.tabProches}</span>
        </div>
        <div style={onglet(false)}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
          <span style={{ fontSize: 10.5, fontWeight: 600 }}>{t.tabMoi}</span>
        </div>
      </div>
    </div>
  );
}
