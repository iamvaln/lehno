import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { PublicShell } from "../PublicShell.js";
import { Card } from "../ui/index.js";

/* DELETING AN ACCOUNT, FROM THE WEB.
 *
 * The app already closes an account — settings, then account and security.
 * This page exists because that is not enough for a store: Google requires a
 * URL that someone can open WITHOUT the app, and the case it has in mind is
 * precisely the one the app cannot serve — a phone that was lost, reset, or
 * whose owner uninstalled before thinking of their data.
 *
 * SO THE SECOND ROUTE IS THE POINT, not a fallback. The page names both, and
 * the one that needs no installation comes with an address that reaches a
 * person.
 *
 * IT ALSO SAYS WHAT SURVIVES. A deletion page that only says "everything is
 * erased" is either false or unverifiable — accounting records outlive an
 * account, and they must, because the law that requires them does not care
 * that someone left. Saying so here is the only honest version, and it is
 * what the store's reviewer looks for.
 */
export function AccountDeletionPage({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  return (
    <PublicShell t={t} langue={langue}>
      <div
        style={{
          maxWidth: "var(--page-max-texte)", margin: "0 auto",
          padding: "var(--section-pad-y) var(--page-gutter)",
        }}
      >
        {/* No <header> here — see the same note in ContactPage: nested under
            <main> some ARIA role engines still count it as a second banner. */}
        <div style={{ marginBottom: "var(--space-40)", maxWidth: "var(--measure)" }}>
          <div className="surtitre" style={{ color: "var(--text-mention)", marginBottom: "var(--space-12)" }}>
            {t.suppressionKicker}
          </div>
          <h1
            className="titre"
            style={{
              margin: 0, fontWeight: "var(--font-display-regular)",
              fontSize: "clamp(34px,4.4vw,52px)", lineHeight: "var(--leading-display)",
              textWrap: "balance",
            }}
          >
            {t.suppressionTitre}
          </h1>
          <p
            style={{
              margin: "var(--space-16) 0 0", fontSize: "var(--text-body-l)",
              lineHeight: "var(--leading-roomy)", color: "var(--text-secondary)", textWrap: "pretty",
            }}
          >
            {t.suppressionChapeau}
          </p>
        </div>

        <div
          style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            gap: "var(--space-32)", alignItems: "start", marginBottom: "var(--space-32)",
          }}
        >
          {t.suppressionVoies.map((voie) => (
            <Card key={voie.titre} surface="card" radius="2xl">
              <h2
                className="titre"
                style={{ margin: "0 0 var(--space-8)", fontWeight: "var(--font-display-medium)", fontSize: "var(--text-display-xs)" }}
              >
                {voie.titre}
              </h2>
              <p
                style={{
                  margin: 0, fontSize: "var(--text-body-s)",
                  lineHeight: "var(--leading-roomy)", color: "var(--text-secondary)", textWrap: "pretty",
                }}
              >
                {voie.texte}
              </p>
              {voie.adresse ? (
                <p style={{ margin: "var(--space-16) 0 0", fontSize: "var(--text-body-s)" }}>
                  <a href={`mailto:${voie.adresse}`} style={{ color: "var(--text-body)" }}>
                    {voie.adresse}
                  </a>
                </p>
              ) : null}
            </Card>
          ))}
        </div>

        <Card surface="panel" radius="2xl">
          <h2
            className="titre"
            style={{ margin: "0 0 var(--space-16)", fontWeight: "var(--font-display-medium)", fontSize: "var(--text-display-xs)" }}
          >
            {t.suppressionEffetTitre}
          </h2>
          <div style={{ display: "grid", gap: "var(--space-20)" }}>
            {t.suppressionEffets.map((effet) => (
              <div key={effet.titre}>
                <div
                  className="surtitre"
                  style={{ color: "var(--text-mention)", marginBottom: "var(--space-6)" }}
                >
                  {effet.titre}
                </div>
                <p
                  style={{
                    margin: 0, fontSize: "var(--text-body-s)",
                    lineHeight: "var(--leading-roomy)", color: "var(--text-secondary)",
                    maxWidth: "var(--measure)", textWrap: "pretty",
                  }}
                >
                  {effet.texte}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PublicShell>
  );
}
