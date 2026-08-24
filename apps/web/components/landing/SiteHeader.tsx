"use client";

import { useState, type ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { BasculeLangue } from "../BasculeLangue.js";
import { BasculeTheme } from "../BasculeTheme.js";
import { Icon, Lockup } from "../ui/index.js";

// L'en-tête du site. Sous le seuil de repli (base.css, requête de conteneur
// sur .page), la navigation se replie derrière un bouton — la langue, le
// thème et l'appel à l'action restent en place : ce sont eux qu'on vient
// chercher. Le bouton « Commencer » reste en filet ici : le plein — un seul
// par vue — est celui du formulaire du héros, juste en dessous.
export function SiteHeader({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  const [ouvert, setOuvert] = useState(false);
  const fermer = (): void => setOuvert(false);

  // Chemins absolus, pas de simples ancres : cet en-tête coiffe aussi les
  // pages secondaires (FAQ, contact, pages légales), où « #comment » ne
  // désigne rien et laisse le visiteur sur place avec une URL sale.
  const liens: { href: string; texte: string }[] = [
    { href: `/${langue}#comment`, texte: t.navComment },
    { href: `/${langue}#contenu`, texte: t.navContenu },
    { href: `/${langue}#mur`, texte: t.navMur },
    { href: `/${langue}#prix`, texte: t.navPrix },
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
          // flexWrap manquait : sous 920px, .site-nav passe en flex-basis 100%
          // pour occuper sa propre ligne (voir base.css). Sans retour à la
          // ligne autorisé, elle restait sur la même rangée que la marque et
          // les commandes, et recouvrait le contenu au lieu de se déployer
          // sous l'en-tête.
          flexWrap: "wrap",
        }}
      >
        {/* La marque ramène à l'accueil. La maquette ne le montre pas — c'est
            un prototype d'une seule page, il n'y a nulle part où aller — mais
            l'en-tête coiffe aussi la FAQ, le contact et les pages légales, et
            un logo qui ne ramène pas chez soi manque à tout le monde. */}
        <a
          href={`/${langue}`}
          aria-label={t.altMarque}
          style={{ display: "flex", alignItems: "center", textDecoration: "none" }}
        >
          <Lockup height={34} markSize={30} alt={t.altMarque} />
        </a>

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
          {/* Un lien, pas un bouton : il mène au formulaire du héros. Il
              portait un onClick vide, donc il ne menait nulle part. Plein et
              violet, comme la maquette v3 — c'est l'action que la page
              demande, et l'en-tête la garde sous les yeux au défilement. */}
          <a
            href={`/${langue}#commencer`}
            className="ent-cta"
            style={{
              background: "var(--action)", color: "var(--text-on-accent)",
              padding: "var(--space-10) var(--space-16)", borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-body)", fontWeight: "var(--font-body-semibold)",
              fontSize: "var(--text-body-s)", textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            {t.cta}
          </a>
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
