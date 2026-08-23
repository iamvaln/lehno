import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { BadgesMagasins } from "../BadgesMagasins.js";

// L'aplat de clôture quitte l'encre pour le violet profond en thème sombre —
// c'est @lehno/tokens qui le décide, sous le rôle « band ». L'abricot du bouton
// avant-lancement porte un moment heureux (l'inscription, pas encore ouverte) ;
// jamais le violet d'action, déjà réservé au formulaire du héros.
export function ClosingBand(
  { t, langue, avantLancement }: { t: Messages; langue: Langue; avantLancement: boolean },
): ReactNode {
  return (
    <section style={{ background: "var(--surface-band)", color: "var(--on-band)" }}>
      <div
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto", padding: "clamp(52px,8vw,88px) var(--page-gutter)",
          display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: "clamp(28px,4vw,56px)", alignItems: "center",
        }}
      >
        <h2
          className="titre"
          style={{
            fontWeight: "var(--font-display-medium)", fontSize: "clamp(32px,5vw,52px)", lineHeight: "var(--leading-display)",
            letterSpacing: "var(--tracking-display)", margin: 0, maxWidth: "20ch", textWrap: "balance",
          }}
        >
          {t.finTitre}
        </h2>
        <div style={{ display: "flex", gap: "var(--space-14)", alignItems: "center", flexWrap: "wrap" }}>
          {avantLancement ? (
            <a
              href="#commencer"
              style={{
                background: "var(--celebrate)", color: "var(--on-celebrate)", padding: "var(--space-12) var(--space-20)",
                borderRadius: "var(--radius-sm)", fontWeight: "var(--font-body-bold)", fontSize: "var(--text-body-s)",
                textDecoration: "none", fontFamily: "var(--font-body)",
              }}
            >
              {t.cta}
            </a>
          ) : (
            <BadgesMagasins t={t} langue={langue} surBande />
          )}
        </div>
      </div>
    </section>
  );
}
