import type { ReactNode } from "react";
import type { Messages } from "../../messages/index.js";
import { SectionLabel } from "../ui/index.js";

// Trois temps, sur une grille en sous-grille : les titres s'alignent entre eux et
// les paragraphes aussi, quelle que soit la longueur de chaque texte.
export function HowItWorks({ t }: { t: Messages }): ReactNode {
  const temps: { numero: string; titre: string; texte: string }[] = [
    { numero: "01", titre: t.etape1Titre, texte: t.etape1 },
    { numero: "02", titre: t.etape2Titre, texte: t.etape2 },
    { numero: "03", titre: t.etape3Titre, texte: t.etape3 },
  ];

  return (
    <section id="comment" style={{ background: "var(--surface-panel)" }}>
      <div style={{ maxWidth: "var(--page-max)", margin: "0 auto", padding: "clamp(52px,8vw,96px) var(--page-gutter) clamp(56px,8vw,100px)" }}>
        <SectionLabel style={{ color: "var(--text-accent)" }}>{t.navComment}</SectionLabel>
        <div
          style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gridTemplateRows: "auto auto auto", gap: "clamp(28px,4vw,44px)",
            marginTop: "clamp(32px,4vw,44px)",
          }}
        >
          {temps.map(({ numero, titre, texte }) => (
            <div key={numero} style={{ display: "grid", gridTemplateRows: "subgrid", gridRow: "span 3", gap: 0, alignContent: "start", minWidth: 0 }}>
              <div className="titre" style={{ fontSize: "clamp(44px,6vw,60px)", fontWeight: "var(--font-display-regular)", color: "var(--text-accent)", lineHeight: "var(--leading-display)" }} aria-hidden="true">
                {numero}
              </div>
              <h3 className="titre" style={{ fontWeight: "var(--font-display-medium)", fontSize: "clamp(22px,3vw,26px)", letterSpacing: "var(--tracking-title)", margin: "var(--space-14) 0 var(--space-10)", textWrap: "balance" }}>
                {titre}
              </h3>
              <p style={{ margin: 0, color: "var(--text-secondary)", maxWidth: "34ch" }}>{texte}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
