import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { SiteFooter } from "../landing/SiteFooter.js";
import { SiteHeader } from "../landing/SiteHeader.js";
import { SectionLabel } from "../ui/index.js";
import { FaqAccordion } from "./FaqAccordion.js";

// La FAQ porte le même en-tête et le même pied que la landing : ce n'est pas
// une coquille séparée, c'est la même identité de site (voir
// components/landing/SiteHeader.tsx et SiteFooter.tsx). Rien n'est écrit
// ici : tout le contenu vient de t.faq (messages/fr.ts et en.ts), recopié
// mot pour mot depuis le paquet de passation — voir test/faq-contenu.test.ts.
export function FaqPage({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  const p = t.faq;

  return (
    <div className="page">
      <SiteHeader t={t} langue={langue} />
      <main>
        <div
          style={{
            maxWidth: "var(--page-max)", margin: "0 auto",
            padding: "clamp(40px,5vw,68px) var(--page-gutter) clamp(52px,7vw,92px)",
          }}
        >
          <header style={{ marginBottom: "var(--space-40)", maxWidth: "var(--measure)" }}>
            <SectionLabel style={{ marginBottom: "var(--space-12)" }}>{p.kicker}</SectionLabel>
            <h1
              className="titre"
              style={{
                margin: 0, fontWeight: "var(--font-display-regular)",
                fontSize: "clamp(34px,4.4vw,52px)", lineHeight: "var(--leading-display)",
                letterSpacing: "var(--tracking-display)", textWrap: "balance",
              }}
            >
              {p.titre}
            </h1>
            <p
              style={{
                margin: "var(--space-16) 0 0", fontSize: "var(--text-body-l)", lineHeight: "var(--leading-roomy)",
                color: "var(--text-secondary)", textWrap: "pretty",
              }}
            >
              {p.chapeau}
            </p>
          </header>

          <FaqAccordion groupes={p.groupes} />
        </div>
      </main>
      <SiteFooter t={t} langue={langue} />
    </div>
  );
}
