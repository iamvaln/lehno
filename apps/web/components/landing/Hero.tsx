import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { ApercuApplication } from "../ApercuApplication.js";
import { BadgesMagasins } from "../BadgesMagasins.js";
import { FormulaireAttente } from "../FormulaireAttente.js";
import { Telephone } from "../Telephone.js";

// Deux états, un seul drapeau : avant lancement on prend une adresse, après on
// renvoie vers les magasins. Rien d'autre ne change dans le héros. Le seul
// titre de premier rang de la page — h1 — vit ici.
export function Hero(
  { t, langue, avantLancement, ouvert }: { t: Messages; langue: Langue; avantLancement: boolean;
    ouvert: (cle: string) => boolean;
  },
): ReactNode {
  return (
    <section style={{ background: "var(--surface-page)" }}>
      <div
        className="hero-grille"
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto",
          padding: "clamp(40px,6vw,72px) var(--page-gutter) clamp(48px,7vw,84px)",
          gap: "clamp(28px,4vw,60px)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            className="titre"
            style={{
              fontWeight: "var(--font-display-medium)", fontSize: "clamp(40px,6.4vw,72px)",
              lineHeight: "var(--leading-display)", letterSpacing: "var(--tracking-display)",
              margin: 0, textWrap: "balance",
            }}
          >
            {t.heroTitre}
          </h1>
          <p
            style={{
              fontSize: "clamp(17px,2vw,21px)", lineHeight: "var(--leading-body)", color: "var(--text-secondary)",
              maxWidth: "34ch", margin: "var(--space-20) 0 0", textWrap: "pretty",
            }}
          >
            {t.heroSous}
          </p>
          <div id="commencer" style={{ marginTop: "var(--space-32)" }}>
            {avantLancement ? <FormulaireAttente t={t} /> : <BadgesMagasins t={t} langue={langue} />}
          </div>
        </div>

        <div
          style={{
            background: "var(--surface-panel)", borderRadius: "var(--radius-2xl)",
            padding: "clamp(24px,4vw,44px) var(--space-20) 0", display: "flex",
            justifyContent: "center", minWidth: 0,
          }}
        >
          <Telephone>
            <ApercuApplication t={t} langue={langue} ouvert={ouvert} />
          </Telephone>
        </div>
      </div>
    </section>
  );
}
