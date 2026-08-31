import type { ReactNode } from "react";
import type { PublicSubmission } from "@lehno/contracts";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { Provenance, Tag } from "../ui/index.js";

/**
 * Ce que ce répondant a déjà envoyé, avec le sort de chaque souhait.
 *
 * **C'est la seule surface publique où l'on montre une décision du
 * propriétaire, et elle se montre sans la commenter.** « Écarté » ne s'excuse
 * pas et ne se justifie pas : une explication inventée par la page serait une
 * explication que le propriétaire n'a pas donnée.
 *
 * Le bloc sert à ne pas proposer deux fois la même chose — d'où sa place, juste
 * au-dessus du champ des souhaits et non en tête de page.
 */
export function DejaEnvoye(
  { t, langue, contributions }: {
    t: Messages; langue: Langue; contributions: PublicSubmission[];
  },
): ReactNode {
  const quand = (iso: string): string =>
    new Intl.DateTimeFormat(langue === "en" ? "en-GB" : "fr-FR", {
      day: "numeric", month: "long",
    }).format(new Date(iso));

  const libelle = (sort: PublicSubmission["wishes"][number]["reviewStatus"]): string =>
    sort === "retained" ? t.collecteRetenu : sort === "discarded" ? t.collecteEcarte : t.collecteEnAttente;

  return (
    <div
      style={{
        background: "var(--surface-panel)",
        border: "var(--border-width) solid var(--border-hairline)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-12) var(--space-14)",
      }}
    >
      <div className="surtitre" style={{ color: "var(--text-mention)" }}>{t.collecteDejaTitre}</div>

      {contributions.map((contribution) => (
        <div key={contribution.createdAt} style={{ marginTop: "var(--space-10)" }}>
          <div style={{ display: "grid" }}>
            {contribution.wishes.map((souhait) => (
              <div
                key={souhait.label}
                style={{
                  display: "flex", gap: "var(--space-12)", alignItems: "center", flexWrap: "wrap",
                  padding: "var(--space-8) 0",
                  borderBottom: "var(--border-width) solid var(--border-hairline)",
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>{souhait.label}</span>
                <Tag tone={souhait.reviewStatus === "retained" ? "quiet" : "outline"}>
                  {libelle(souhait.reviewStatus)}
                </Tag>
              </div>
            ))}
          </div>
          <Provenance date={quand(contribution.createdAt)} />
        </div>
      ))}
    </div>
  );
}
