import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { ConfigPublique } from "../../lib/config-publique.js";
import { formaterMontant } from "../../lib/montants.js";
import { interpoler } from "../../lib/texte.js";
import type { Messages } from "../../messages/index.js";
import { SectionLabel } from "../ui/index.js";

// Les montants ne sont pas écrits ici : ils viennent de /v1/public/config. Un
// prix en dur dans une page est un prix qui ment le jour où il change.
export function Pricing(
  { t, langue, config }: { t: Messages; langue: Langue; config: ConfigPublique },
): ReactNode {
  const prixCredit = formaterMontant(config.creditUnitPrice, config.currency, langue);

  return (
    <section id="prix" style={{ background: "var(--surface-page)" }}>
      <div style={{ maxWidth: "var(--page-max)", margin: "0 auto", padding: "clamp(44px,6vw,76px) var(--page-gutter) clamp(48px,7vw,84px)" }}>
        <SectionLabel>{t.prixKicker}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "clamp(24px,4vw,48px)", marginTop: "var(--space-28)" }}>
          <div style={{ borderTop: "var(--border-width-firm) solid var(--action)", paddingTop: "var(--space-18)" }}>
            <div className="titre" style={{ fontSize: "clamp(38px,5vw,52px)", fontWeight: "var(--font-display-regular)", lineHeight: "var(--leading-display)", letterSpacing: "var(--tracking-display)", color: "var(--text-accent)" }}>
              {t.prixGratuitChiffre}
            </div>
            <h3 className="titre" style={{ fontWeight: "var(--font-display-medium)", fontSize: "clamp(19px,2.4vw,22px)", letterSpacing: "var(--tracking-title)", margin: "var(--space-14) 0 var(--space-8)" }}>
              {t.prixGratuitTitre}
            </h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", maxWidth: "40ch" }}>{t.prixGratuit}</p>
          </div>

          <div style={{ borderTop: "var(--border-width-firm) solid var(--border-object)", paddingTop: "var(--space-18)" }}>
            <div className="titre" style={{ fontSize: "clamp(38px,5vw,52px)", fontWeight: "var(--font-display-regular)", lineHeight: "var(--leading-display)", letterSpacing: "var(--tracking-display)" }}>
              <span>{prixCredit}</span>
              <span style={{ fontSize: ".42em", letterSpacing: 0, color: "var(--text-secondary)", marginLeft: ".5em" }}>{t.prixCreditsUnite}</span>
            </div>
            <h3 className="titre" style={{ fontWeight: "var(--font-display-medium)", fontSize: "clamp(19px,2.4vw,22px)", letterSpacing: "var(--tracking-title)", margin: "var(--space-14) 0 var(--space-8)" }}>
              {t.prixCreditsTitre}
            </h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", maxWidth: "40ch" }}>
              {interpoler(t.prixCredits, { credits: config.signupFreeCredits })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
