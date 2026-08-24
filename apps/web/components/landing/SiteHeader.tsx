"use client";

import { useState, type ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { BasculeLangue } from "../BasculeLangue.js";
import { BasculeTheme } from "../BasculeTheme.js";
import { BrandMark, Button, Icon, Wordmark } from "../ui/index.js";

// L'en-tête du site. Sous le seuil de repli (base.css, requête de conteneur
// sur .page), la navigation se replie derrière un bouton — la langue, le
// thème et l'appel à l'action restent en place : ce sont eux qu'on vient
// chercher. Le bouton « Commencer » reste en filet ici : le plein — un seul
// par vue — est celui du formulaire du héros, juste en dessous.
export function SiteHeader({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
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
        position: "sticky", top: 0, zIndex: 20, background: "var(--surface-page)",
        borderBottom: "var(--border-width) solid var(--border-hairline)",
      }}
    >
      <div
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto", padding: "var(--space-14) var(--page-gutter)",
          display: "flex", alignItems: "center", gap: "var(--space-14)",
        }}
      >
        <BrandMark size={30} alt={t.altMarque} />
        <span className="site-wordmark">
          <Wordmark height={21} alt={t.altMarque} />
        </span>

        <nav className="site-nav" data-ferme={ouvert ? "0" : "1"} style={{ marginLeft: "auto" }}>
          {liens.map(({ href, texte }) => (
            <a key={href} href={href} onClick={fermer} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
              {texte}
            </a>
          ))}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-8)", flexWrap: "wrap" }}>
          <BasculeLangue t={t} langue={langue} />
          <BasculeTheme t={t} />
          <Button variant="outline" onClick={() => {}}>{t.cta}</Button>
          <button
            type="button"
            className="site-burger"
            onClick={() => setOuvert((o) => !o)}
            aria-expanded={ouvert}
            aria-label={ouvert ? t.menuFermer : t.menuOuvrir}
            style={{
              width: "var(--space-32)", height: "var(--space-32)", alignItems: "center", justifyContent: "center",
              color: "var(--text-secondary)", background: "transparent",
              border: "var(--border-width) solid var(--border-object)", borderRadius: "var(--radius-xs)",
              padding: 0, cursor: "pointer",
            }}
          >
            <Icon name={ouvert ? "x" : "menu"} size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
