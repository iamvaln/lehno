import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { cheminLegal } from "../../lib/chemins.js";
import { BrandMark, Wordmark } from "../ui/index.js";

export function SiteFooter({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  // Les chemins légaux viennent de lib/chemins.ts : ils sont dans la langue
  // de la page, « /en/privacy » et non « /en/confidentialite ». Contact et FAQ
  // s'écrivent pareil dans les deux langues.
  //
  // Quatre liens, l'ordre de la maquette v3. Les mentions légales n'y figurent
  // pas : specs/ux-surfaces-publiques-lehno.md les demandait au pied, mais le
  // propriétaire a tranché que la maquette l'emporte. La page
  // /{langue}/mentions-legales existe toujours et se construit ; il faut donc
  // lui trouver une autre entrée, sinon elle devient injoignable.
  const liens: { href: string; texte: string }[] = [
    { href: cheminLegal("cgu", langue), texte: t.cgu },
    { href: cheminLegal("confidentialite", langue), texte: t.confidentialite },
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
          {/* La marque du pied ramène à l'accueil, comme celle de l'en-tête.
              Un logo est un chemin de retour, où qu'il se trouve. */}
          <a
            href={`/${langue}`}
            aria-label={t.altMarque}
            style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}
          >
            <BrandMark size={28} alt="" />
            <Wordmark height={18} alt="" />
          </a>
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
