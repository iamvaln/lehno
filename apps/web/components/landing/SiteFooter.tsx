import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { BrandMark, Wordmark } from "../ui/index.js";

export function SiteFooter({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  // Le chemin des URL reste en français dans les deux langues (/en/conditions
  // existe déjà ainsi) : FAQ et mentions légales suivent la même convention.
  // Ordre : les pages légales groupées (cgu, confidentialité, mentions
  // légales), puis FAQ, puis contact — cgu/confidentialite/faq/contact
  // reprennent l'ordre du prototype SiteFooter.jsx du paquet de passation,
  // qui fait autorité ; les mentions légales, absentes de ce prototype mais
  // requises par specs/ux-surfaces-publiques-lehno.md §3.8, rejoignent les
  // deux autres pages légales sans déplacer FAQ ni contact.
  const liens: { href: string; texte: string }[] = [
    { href: `/${langue}/conditions`, texte: t.cgu },
    { href: `/${langue}/confidentialite`, texte: t.confidentialite },
    { href: `/${langue}/mentions-legales`, texte: t.mentionsLegales },
    { href: `/${langue}/faq`, texte: t.piedFaq },
    { href: `/${langue}/contact`, texte: t.contact },
  ];

  return (
    <footer style={{ background: "var(--surface-page)" }}>
      <div
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto", padding: "var(--space-40) var(--page-gutter) var(--space-56)",
          display: "flex", gap: "var(--space-28)", alignItems: "flex-start", flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
            <BrandMark size={28} alt={t.altMarque} />
            <Wordmark height={18} alt={t.altMarque} />
          </div>
          <div className="citation" style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)", marginTop: "var(--space-6)" }}>{t.signature}</div>
        </div>
        <nav style={{ marginLeft: "auto", display: "flex", gap: "var(--space-20)", flexWrap: "wrap", fontSize: "var(--text-body-xs)", color: "var(--text-secondary)" }}>
          {liens.map(({ href, texte }) => (
            <a key={href} href={href} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>{texte}</a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
