import type { ReactNode } from "react";
import type { Messages } from "../messages";

const etiquette = {
  fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" as const,
  color: "var(--faint)", fontWeight: 600,
};

const pastille = {
  border: "1px solid var(--line2)", borderRadius: 999, padding: "5px 12px", fontSize: 13,
} as const;

// Le Mur tel qu'un proche le voit. La voix est à la première personne : c'est la
// seule surface où c'est le propriétaire qui parle, pas la marque.
export function ApercuMur({ t }: { t: Messages }): ReactNode {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100%", color: "var(--text)" }}>
      <div style={{ background: "var(--panel)", padding: "46px 22px 20px", textAlign: "center" }}>
        {/* Un monogramme, pas une photographie : la maquette y montrait le portrait
            de la fondatrice, qui n'a pas à vivre dans le dépôt pour une vignette. */}
        <div
          aria-hidden="true"
          className="titre"
          style={{
            width: 58, height: 58, borderRadius: "50%", background: "var(--violet)",
            color: "var(--on-violet)", margin: "0 auto 10px", display: "flex",
            alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 500,
          }}
        >
          V
        </div>
        <div className="titre" style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-.01em", lineHeight: 1.3 }}>{t.murHello}</div>
        <div className="titre" style={{ fontStyle: "italic", fontSize: 14, color: "var(--muted)", marginTop: 8 }}>{t.murSous}</div>
      </div>

      <div style={{ padding: "16px 18px 18px" }}>
        <div style={etiquette}>{t.murAime}</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
          <span style={pastille}>{t.murTag1}</span>
          <span style={pastille}>{t.murTag2}</span>
          <span style={pastille}>{t.murTag3}</span>
        </div>

        <div style={{ ...etiquette, marginTop: 13 }}>{t.murEvite}</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 8 }}>
          <span style={{ ...pastille, borderStyle: "dashed", color: "var(--muted)" }}>{t.murNo1}</span>
          <span style={{ ...pastille, borderStyle: "dashed", color: "var(--muted)" }}>{t.murNo2}</span>
        </div>

        <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 13 }}>{t.murDate}</div>

        <div style={{ border: "1px solid var(--violet)", borderRadius: 13, padding: 12, textAlign: "center", marginTop: 13 }}>
          <div style={{ fontSize: 14, color: "var(--muted)" }}>{t.murIdee}</div>
          <div style={{ marginTop: 10, color: "var(--violet-deep)", border: "1px solid var(--violet)", borderRadius: 10, padding: 8, fontSize: 14, fontWeight: 600 }}>{t.murListe}</div>
        </div>

        <div style={{ marginTop: 10, background: "var(--violet)", color: "var(--on-violet)", textAlign: "center", borderRadius: 10, padding: 11, fontWeight: 600, fontSize: 15 }}>{t.murMot}</div>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line2)", display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/brand/lehno-favicon-28.svg" alt={t.altMarque} width={24} height={24} style={{ display: "block", flex: "none" }} />
          <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.35, flex: 1 }}>{t.murPied}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--violet-deep)", whiteSpace: "nowrap" }}>{t.murPiedLien}</div>
        </div>
      </div>
    </div>
  );
}
