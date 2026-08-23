import type { ReactNode } from "react";
import type { Langue } from "../lib/langues";
import type { Messages } from "../messages";
import { Marque } from "./Marque";

export function Pied({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  const liens: { href: string; texte: string }[] = [
    { href: `/${langue}/conditions`, texte: t.cgu },
    { href: `/${langue}/confidentialite`, texte: t.confidentialite },
    { href: `/${langue}/contact`, texte: t.contact },
  ];

  return (
    <footer
      className="pied"
      style={{
        maxWidth: 1160, margin: "0 auto", padding: "36px 20px 60px", display: "flex",
        gap: "16px 28px", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line)",
      }}
    >
      <div>
        <Marque alt={t.altMarque} taille={26} mot={19} />
        <div className="titre" style={{ fontStyle: "italic", fontSize: 15, color: "var(--muted)", marginTop: 6 }}>{t.signature}</div>
      </div>
      <nav style={{ marginLeft: "auto", display: "flex", gap: "12px 18px", fontSize: 14, flexWrap: "wrap" }}>
        {liens.map(({ href, texte }) => (
          <a key={href} href={href} style={{ color: "var(--muted)" }}>{texte}</a>
        ))}
      </nav>
    </footer>
  );
}
