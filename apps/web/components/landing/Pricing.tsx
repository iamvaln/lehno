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
  { t, langue, config, ouvert }: { t: Messages; langue: Langue; config: ConfigPublique;
    /** Une fonctionnalité est-elle ouverte ? Le serveur a déjà résolu les
     *  dépendances ; la page ne connaît aucune règle. */
    ouvert: (cle: string) => boolean;
  },
): ReactNode {
  const prixCredit = formaterMontant(config.creditUnitPrice, config.currency, langue);

  /* L'énumération de ce qu'un crédit achète, réduite à ce qui est OUVERT.
     L'ordre est celui du dictionnaire, pas celui du registre : le serveur rend
     les clés dans l'ordre où il les résout, et une phrase dont les termes
     changent de place d'un déploiement à l'autre se relit mal.
     Au moins le message est toujours ouvert — la liste n'est donc jamais vide. */
  const noms = (Object.keys(t.prixGenerations) as (keyof typeof t.prixGenerations)[])
    .filter((cle) => ouvert(cle))
    .map((cle) => t.prixGenerations[cle]);
  const liste = noms.length <= 1
    ? (noms[0] ?? "")
    : `${noms.slice(0, -1).join(", ")} ${t.prixEt} ${noms[noms.length - 1]}`;

  return (
    <section id="prix" style={{ background: "var(--surface-page)" }}>
      <div style={{ maxWidth: "var(--page-max)", margin: "0 auto", padding: "clamp(44px,6vw,76px) var(--page-gutter) clamp(48px,7vw,84px)" }}>
        <SectionLabel>{t.prixKicker}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "clamp(24px,4vw,48px)", marginTop: "var(--space-28)" }}>
          <div style={{ borderTop: "var(--border-width-firm) solid var(--action)", paddingTop: "var(--space-20)" }}>
            <div className="titre" style={{ fontSize: "clamp(38px,5vw,52px)", fontWeight: "var(--font-display-regular)", lineHeight: "var(--leading-display)", letterSpacing: "var(--tracking-display)", color: "var(--text-accent)" }}>
              {t.prixGratuitChiffre}
            </div>
            <h3 className="titre" style={{ fontWeight: "var(--font-display-medium)", fontSize: "clamp(19px,2.4vw,22px)", letterSpacing: "var(--tracking-title)", margin: "var(--space-14) 0 var(--space-8)" }}>
              {t.prixGratuitTitre}
            </h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", maxWidth: "40ch" }}>{t.prixGratuit}</p>
          </div>

          <div style={{ borderTop: "var(--border-width-firm) solid var(--border-object)", paddingTop: "var(--space-20)" }}>
            <div className="titre" style={{ fontSize: "clamp(38px,5vw,52px)", fontWeight: "var(--font-display-regular)", lineHeight: "var(--leading-display)", letterSpacing: "var(--tracking-display)" }}>
              <span>{prixCredit}</span>
              <span style={{ fontSize: ".42em", letterSpacing: 0, color: "var(--text-secondary)", marginLeft: ".5em" }}>{t.prixCreditsUnite}</span>
            </div>
            <h3 className="titre" style={{ fontWeight: "var(--font-display-medium)", fontSize: "clamp(19px,2.4vw,22px)", letterSpacing: "var(--tracking-title)", margin: "var(--space-14) 0 var(--space-8)" }}>
              {t.prixCreditsTitre}
            </h3>
            <p style={{ margin: 0, color: "var(--text-secondary)", maxWidth: "40ch" }}>
              {interpoler(t.prixCredits, { liste, credits: config.signupFreeCredits })}
              {/* La phrase de parrainage ne paraît que si le parrainage existe :
                  promettre deux crédits par invitation quand rien ne les
                  distribue, c'est une promesse qu'on ne tiendra pas. */}
              {ouvert("referral") ? ` ${t.prixParrainage}` : ""}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
