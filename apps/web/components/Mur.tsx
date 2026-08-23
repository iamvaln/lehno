import type { ReactNode } from "react";
import type { Messages } from "../messages";
import { Telephone } from "./Telephone";
import { ApercuMur } from "./ApercuMur";

export function Mur({ t }: { t: Messages }): ReactNode {
  const points: { titre: string; texte: string }[] = [
    { titre: t.murPoint1Titre, texte: t.murPoint1 },
    { titre: t.murPoint2Titre, texte: t.murPoint2 },
    { titre: t.murPoint3Titre, texte: t.murPoint3 },
  ];

  return (
    <section id="mur" style={{ background: "var(--panel)" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(52px,7vw,92px) 20px clamp(44px,6vw,80px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(28px,4vw,56px)", alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="titre" style={{ fontWeight: 500, fontSize: "clamp(28px,4vw,38px)", letterSpacing: "-.028em", lineHeight: 1.12, margin: "0 0 14px", textWrap: "balance" }}>
              {t.murTitre}
            </h2>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "clamp(16px,2vw,18px)", maxWidth: "42ch" }}>{t.murTexte}</p>
            <div style={{ display: "grid", gap: 0, marginTop: "clamp(22px,3vw,30px)", maxWidth: "42ch" }}>
              {points.map(({ titre, texte }, index) => (
                <div
                  key={titre}
                  style={{
                    borderTop: "1px solid var(--line2)", padding: "14px 0",
                    borderBottom: index === points.length - 1 ? "1px solid var(--line2)" : undefined,
                  }}
                >
                  <div className="titre" style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-.01em" }}>{titre}</div>
                  <div style={{ fontSize: 14.5, color: "var(--muted)", marginTop: 3 }}>{texte}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", minWidth: 0 }}>
            <Telephone><ApercuMur t={t} /></Telephone>
          </div>
        </div>
      </div>
    </section>
  );
}
