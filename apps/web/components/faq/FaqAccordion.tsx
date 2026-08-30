"use client";

import { useId, useState, type ReactNode } from "react";
import type { Messages } from "../../messages/index.js";
import { Icon } from "../ui/index.js";

type Groupe = Messages["faq"]["groupes"][number];
type Item = Groupe["items"][number];

// La durée et la courbe de l'ouverture se recomposent ici, jamais en dur :
// prefers-reduced-motion (app/base.css) les remet à zéro sur toute
// transition, mais seulement si la transition passe par ses jetons.
const OUVERTURE = "grid-template-rows var(--duration-enter) var(--ease-pose)";
const ROTATION = "transform var(--duration-enter) var(--ease-pose)";

function FaqEntry({ item }: { item: Item }): ReactNode {
  const [ouvert, setOuvert] = useState(false);
  const idPanneau = `faq-panneau-${useId()}`;

  return (
    <div style={{ borderTop: "var(--border-width) solid var(--border-hairline)" }}>
      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        style={{
          boxSizing: "border-box", width: "100%", cursor: "pointer",
          background: "transparent", border: "none", textAlign: "left", padding: "var(--space-12) 0",
          display: "flex", alignItems: "center", gap: "var(--space-14)", minHeight: "var(--touch-min)",
          fontFamily: "var(--font-body)", fontSize: "var(--text-body-l)", color: "var(--text-body)",
        }}
      >
        <span style={{ flex: 1, minWidth: 0, textWrap: "pretty" }}>{item.q}</span>
        <span
          style={{
            flex: "none", display: "grid", placeItems: "center",
            transform: ouvert ? "rotate(180deg)" : "none", transition: ROTATION,
          }}
        >
          <Icon name="chevron-down" size={18} color="var(--text-mention)" />
        </span>
      </button>
      <div
        id={idPanneau}
        aria-hidden={!ouvert}
        style={{ display: "grid", gridTemplateRows: ouvert ? "1fr" : "0fr", transition: OUVERTURE }}
      >
        <div style={{ overflow: "hidden" }}>
          <div style={{ paddingBottom: "var(--space-20)" }}>
                          <p
                style={{
                  margin: 0, fontSize: "var(--text-body-m)", lineHeight: "var(--leading-roomy)",
                  maxWidth: "var(--measure)", color: "var(--text-secondary)", textWrap: "pretty",
                }}
              >
                {item.reponse}
              </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// L'accordéon complet, groupé par thème. Fidèle au prototype de référence
// (FaqPage.jsx) : plusieurs entrées peuvent rester ouvertes en même temps,
// rien ne se referme tout seul quand une autre s'ouvre.
export function FaqAccordion(
  { groupes }: { groupes: Groupe[] },
): ReactNode {
  return (
    <div style={{ display: "grid", gap: "var(--space-44)", maxWidth: 760 }}>
      {groupes.map((groupe) => (
        <section key={groupe.titre}>
          <h2 className="surtitre" style={{ margin: "0 0 var(--space-6)", color: "var(--text-mention)" }}>
            {groupe.titre}
          </h2>
          <div style={{ borderBottom: "var(--border-width) solid var(--border-hairline)" }}>
            {groupe.items.map((item) => (
              <FaqEntry key={item.q} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
