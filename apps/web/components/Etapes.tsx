import type { ReactNode } from "react";
import type { Messages } from "../messages";

// Trois temps, sur une grille en sous-grille : les titres s'alignent entre eux et
// les paragraphes aussi, quelle que soit la longueur de chaque texte.
export function Etapes({ t }: { t: Messages }): ReactNode {
  const temps: { numero: string; titre: string; texte: string }[] = [
    { numero: "01", titre: t.etape1Titre, texte: t.etape1 },
    { numero: "02", titre: t.etape2Titre, texte: t.etape2 },
    { numero: "03", titre: t.etape3Titre, texte: t.etape3 },
  ];

  return (
    <section id="comment" style={{ background: "var(--panel)" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(52px,8vw,96px) 20px clamp(56px,8vw,100px)" }}>
        <h2 style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--violet-deep)", fontWeight: 600, margin: 0 }}>
          {t.navComment}
        </h2>
        <div
          style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
            gridTemplateRows: "auto auto auto", gap: "clamp(28px,4vw,44px)",
            marginTop: "clamp(32px,4vw,44px)",
          }}
        >
          {temps.map(({ numero, titre, texte }) => (
            <div key={numero} style={{ display: "grid", gridTemplateRows: "subgrid", gridRow: "span 3", gap: 0, alignContent: "start" }}>
              <div className="titre" style={{ fontSize: "clamp(44px,6vw,60px)", fontWeight: 400, color: "var(--violet-deep)", lineHeight: 1 }} aria-hidden="true">{numero}</div>
              <h3 className="titre" style={{ fontWeight: 500, fontSize: "clamp(22px,3vw,26px)", letterSpacing: "-.02em", margin: "14px 0 10px" }}>{titre}</h3>
              <p style={{ margin: 0, color: "var(--muted)", maxWidth: "34ch" }}>{texte}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
