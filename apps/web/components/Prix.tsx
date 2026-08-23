import type { ReactNode } from "react";
import type { Langue } from "../lib/langues";
import type { Messages } from "../messages";
import type { ConfigPublique } from "../lib/config-publique";
import { formaterMontant } from "../lib/montants";
import { interpoler } from "../lib/texte";

// Les montants ne sont pas écrits ici : ils viennent de /v1/public/config. La
// maquette portait « 100 F » et « 5 crédits » en dur ; un prix en dur dans une page
// est un prix qui ment le jour où il change.
export function Prix(
  { t, langue, config }: { t: Messages; langue: Langue; config: ConfigPublique },
): ReactNode {
  const prixCredit = formaterMontant(config.creditUnitPrice, config.currency, langue);

  return (
    <section id="prix" style={{ background: "var(--bg)" }}>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(44px,6vw,76px) 20px clamp(48px,7vw,84px)" }}>
        <h2 style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--faint)", fontWeight: 600, margin: 0 }}>
          {t.prixKicker}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "clamp(24px,4vw,48px)", marginTop: 28 }}>
          <div style={{ borderTop: "2px solid var(--violet)", paddingTop: 18 }}>
            <div className="titre" style={{ fontSize: "clamp(38px,5vw,52px)", fontWeight: 400, lineHeight: 1, letterSpacing: "-.03em", color: "var(--violet-deep)" }}>
              {t.prixGratuitChiffre}
            </div>
            <h3 className="titre" style={{ fontWeight: 500, fontSize: "clamp(19px,2.4vw,22px)", letterSpacing: "-.02em", margin: "14px 0 8px" }}>{t.prixGratuitTitre}</h3>
            <p style={{ margin: 0, color: "var(--muted)", maxWidth: "40ch" }}>{t.prixGratuit}</p>
          </div>

          <div style={{ borderTop: "2px solid var(--line2)", paddingTop: 18 }}>
            <div className="titre" style={{ fontSize: "clamp(38px,5vw,52px)", fontWeight: 400, lineHeight: 1, letterSpacing: "-.03em" }}>
              <span>{prixCredit}</span>
              <span style={{ fontSize: ".42em", letterSpacing: 0, color: "var(--muted)", marginLeft: ".5em" }}>{t.prixCreditsUnite}</span>
            </div>
            <h3 className="titre" style={{ fontWeight: 500, fontSize: "clamp(19px,2.4vw,22px)", letterSpacing: "-.02em", margin: "14px 0 8px" }}>{t.prixCreditsTitre}</h3>
            <p style={{ margin: 0, color: "var(--muted)", maxWidth: "40ch" }}>{interpoler(t.prixCredits, { credits: config.signupFreeCredits })}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
