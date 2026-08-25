import { Fragment, type ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Bloc, DocumentLegal, Inline } from "../../lib/markdown-leger.js";
import type { Messages } from "../../messages/index.js";
import { PublicShell } from "../PublicShell.js";
import { SectionLabel } from "../ui/index.js";

// Le gabarit des pages légales (conditions, confidentialité) : même en-tête
// et même pied que la landing — c'est la coquille publique qui les porte —,
// un titre puis un
// sommaire latéral collant à gauche du corps du texte — qui devient une
// bande statique en tête du contenu sous le seuil de repli, comme le reste
// du site (.legal-grid, .legal-somm dans base.css, sur la même requête de
// conteneur .page que SiteHeader). Pas de mise en évidence de la section
// visible au défilement : le sommaire reste un jeu de liens ordinaires,
// utilisable sans JavaScript.
function RenduInline({ contenu }: { contenu: Inline[] }): ReactNode {
  return contenu.map((morceau, i) => {
    if (morceau.type === "gras") return <strong key={i}>{morceau.valeur}</strong>;
    if (morceau.type === "lien")
      return (
        <a key={i} href={morceau.href} style={{ color: "var(--text-accent)" }}>
          {morceau.texte}
        </a>
      );
    return <Fragment key={i}>{morceau.valeur}</Fragment>;
  });
}

function RenduBloc({ bloc }: { bloc: Bloc }): ReactNode {
  if (bloc.type === "sous-titre") {
    return (
      <h3
        className="titre"
        style={{
          fontWeight: "var(--font-display-medium)", fontSize: "var(--text-display-xs)",
          lineHeight: "var(--leading-title)", margin: "var(--space-24) 0 var(--space-6)",
        }}
      >
        {bloc.texte}
      </h3>
    );
  }

  if (bloc.type === "liste") {
    return (
      <ul style={{ margin: "0 0 var(--space-16)", paddingLeft: "var(--space-20)", display: "grid", gap: "var(--space-8)" }}>
        {bloc.items.map((item, i) => (
          <li key={i} style={{ fontSize: "var(--text-body-m)", lineHeight: "var(--leading-body)" }}>
            <RenduInline contenu={item} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p style={{ margin: "0 0 var(--space-16)", fontSize: "var(--text-body-m)", lineHeight: "var(--leading-body)", maxWidth: "var(--measure)" }}>
      <RenduInline contenu={bloc.contenu} />
    </p>
  );
}

export function LegalPage(
  { t, langue, kicker, document }: { t: Messages; langue: Langue; kicker: string; document: DocumentLegal },
): ReactNode {
  return (
    <PublicShell t={t} langue={langue}>
        <div
          style={{
            maxWidth: "var(--page-max)", margin: "0 auto",
            padding: "clamp(40px,5vw,68px) var(--page-gutter) clamp(52px,7vw,92px)",
          }}
        >
          <header style={{ marginBottom: "var(--space-32)" }}>
            <SectionLabel style={{ marginBottom: "var(--space-12)" }}>{kicker}</SectionLabel>
            <h1
              className="titre"
              style={{
                fontWeight: "var(--font-display-regular)", fontSize: "clamp(34px,4.4vw,52px)",
                lineHeight: "var(--leading-display)", letterSpacing: "var(--tracking-display)",
                margin: 0, textWrap: "balance", maxWidth: "22ch",
              }}
            >
              {document.titre}
            </h1>
            {document.chapeau.length > 0 && (
              <p
                style={{
                  margin: "var(--space-16) 0 0", fontSize: "var(--text-body-l)",
                  lineHeight: "var(--leading-body)", color: "var(--text-secondary)",
                  maxWidth: "var(--measure)", textWrap: "pretty",
                }}
              >
                <RenduInline contenu={document.chapeau} />
              </p>
            )}
            {document.maj && (
              <div
                style={{
                  marginTop: "var(--space-16)", paddingTop: "var(--space-12)",
                  borderTop: "var(--border-width) solid var(--border-hairline)",
                  fontSize: "var(--text-mention-s)", color: "var(--text-mention)",
                }}
              >
                {document.maj}
              </div>
            )}
          </header>

          {document.sections.length > 0 && (
            <div className="legal-grid">
              <nav className="legal-somm" aria-label={t.sommaire}>
                <SectionLabel style={{ marginBottom: "var(--space-10)" }}>{t.sommaire}</SectionLabel>
                <div style={{ display: "grid", gap: "var(--space-2)" }}>
                  {document.sections.map((s) => (
                    <a
                      key={s.id}
                      href={`#${s.id}`}
                      style={{
                        display: "block", padding: "var(--space-6) 0 var(--space-6) var(--space-10)",
                        borderLeft: "var(--border-width-firm) solid var(--border-hairline)",
                        color: "var(--text-secondary)", fontSize: "var(--text-body-s)",
                        lineHeight: "var(--leading-title)", textDecoration: "none",
                      }}
                    >
                      {s.titre}
                    </a>
                  ))}
                </div>
              </nav>

              <div style={{ minWidth: 0 }}>
                {document.sections.map((s) => (
                  <section key={s.id} id={s.id} style={{ marginBottom: "var(--space-32)" }}>
                    <h2
                      className="titre"
                      style={{
                        fontWeight: "var(--font-display-medium)", fontSize: "var(--text-display-xs)",
                        lineHeight: "var(--leading-title)", letterSpacing: "var(--tracking-title)",
                        margin: "0 0 var(--space-6)", textWrap: "balance",
                      }}
                    >
                      {s.titre}
                    </h2>
                    {s.blocs.map((bloc, i) => <RenduBloc key={i} bloc={bloc} />)}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
    </PublicShell>
  );
}
