"use client";

import { useState, type ReactNode } from "react";
import type { Langue } from "../lib/langues";
import type { Messages } from "../messages";
import { Marque } from "./Marque";
import { BasculeTheme } from "./BasculeTheme";
import { BasculeLangue } from "./BasculeLangue";

// Sous 760 px la navigation se replie derrière un bouton, mais la langue, le thème
// et l'appel à l'action restent en place : ce sont eux qu'on vient chercher.
export function Entete({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  const [ouvert, setOuvert] = useState(false);
  const fermer = (): void => setOuvert(false);

  const liens: { href: string; texte: string }[] = [
    { href: "#comment", texte: t.navComment },
    { href: "#contenu", texte: t.navContenu },
    { href: "#mur", texte: t.navMur },
    { href: "#prix", texte: t.navPrix },
  ];

  return (
    <header
      style={{
        maxWidth: 1160, margin: "0 auto", padding: "18px 20px", display: "flex",
        alignItems: "center", gap: "12px 18px", flexWrap: "wrap",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <Marque alt={t.altMarque} />

      <nav className="ent-nav" data-ferme={ouvert ? "0" : "1"}>
        {liens.map(({ href, texte }) => (
          <a key={href} href={href} onClick={fermer} style={{ color: "var(--muted)" }}>{texte}</a>
        ))}
      </nav>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px 10px", flexWrap: "wrap" }}>
        <BasculeLangue t={t} langue={langue} />
        <BasculeTheme t={t} />
        <a
          href="#commencer"
          className="ent-cta"
          style={{
            background: "var(--violet)", color: "var(--on-violet)", padding: "10px 18px",
            borderRadius: 10, fontWeight: 600, fontSize: 15,
          }}
        >
          {t.cta}
        </a>
        <button
          type="button"
          className="ent-burger"
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-label={ouvert ? t.menuFermer : t.menuOuvrir}
          style={{
            alignItems: "center", justifyContent: "center", width: 34, height: 34,
            color: "var(--muted)", background: "transparent", border: "1px solid var(--edge)",
            borderRadius: 9, padding: 0, cursor: "pointer",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {ouvert
              ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>
              : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
          </svg>
        </button>
      </div>
    </header>
  );
}
