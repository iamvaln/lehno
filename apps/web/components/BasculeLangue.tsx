import type { ReactNode } from "react";
import type { Langue } from "../lib/langues";
import type { Messages } from "../messages";

// Une ancre ordinaire, pas next/link : changer de langue est une navigation entière,
// et précharger l'autre langue coûterait un document que presque personne n'ouvre.
// Un lien, pas un état : changer de langue change d'adresse, donc la page se
// partage, se met en signet et s'indexe dans la langue qu'on voit.
// Le drapeau est celui de la langue vers laquelle on va, jamais de celle qu'on lit.
//
// Les hexadécimaux ci-dessous sont les seuls du dossier, et c'est volontaire : ce
// sont les couleurs de deux drapeaux nationaux, fixées hors de notre palette. Les
// passer en variables les ferait suivre le thème, ce qu'un drapeau ne fait pas.
export function BasculeLangue({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  const autre: Langue = langue === "fr" ? "en" : "fr";

  return (
    <a
      href={`/${autre}`}
      hrefLang={autre}
      aria-label={t.langueLabel}
      title={t.langueLabel}
      style={{
        display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600,
        color: "var(--muted)", background: "transparent", border: "1px solid var(--edge)",
        borderRadius: 9, padding: "6px 11px", height: 34,
      }}
    >
      <span style={{ display: "block", width: 20, height: 14, borderRadius: 2, overflow: "hidden", flex: "none" }}>
        {autre === "en" ? (
          <svg viewBox="0 0 60 40" width="20" height="14" style={{ display: "block" }} aria-hidden="true">
            <rect width="60" height="40" fill="#012169" />
            <path d="M0 0 60 40 M60 0 0 40" stroke="#FFFFFF" strokeWidth="9" />
            <path d="M0 0 60 40 M60 0 0 40" stroke="#C8102E" strokeWidth="4" />
            <path d="M30 0 V40 M0 20 H60" stroke="#FFFFFF" strokeWidth="14" />
            <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="8" />
          </svg>
        ) : (
          <svg viewBox="0 0 60 40" width="20" height="14" style={{ display: "block" }} aria-hidden="true">
            <rect width="20" height="40" fill="#002654" />
            <rect x="20" width="20" height="40" fill="#FFFFFF" />
            <rect x="40" width="20" height="40" fill="#ED2939" />
          </svg>
        )}
      </span>
      {t.langueBouton}
    </a>
  );
}
