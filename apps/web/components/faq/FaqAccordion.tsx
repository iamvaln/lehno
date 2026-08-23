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

// Le bloc « à rédiger » : deux réponses par langue ne sont pas encore
// tranchées (expiration des crédits, accès aux contacts/agenda). Plutôt que
// d'inventer une réponse, la question reste posée et ce bloc dit ce qu'elle
// doit couvrir, et qui l'écrit — repris du prototype ARediger.jsx du paquet
// de passation, propre à cette page : les pages légales n'en ont pas besoin ici.
function ReponseEnAttente({ label, texte, qui }: { label: string; texte: string; qui: string }): ReactNode {
  return (
    <div
      style={{
        border: "var(--border-width) dashed var(--border-object)", borderRadius: "var(--radius-md)",
        background: "var(--surface-panel)", padding: "var(--space-14) var(--space-16)",
        margin: "var(--space-10) 0 var(--space-4)",
      }}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: "var(--space-6)", marginBottom: "var(--space-6)",
          fontFamily: "var(--font-body)", fontSize: "var(--text-mention-s)", fontWeight: "var(--font-body-bold)",
          letterSpacing: "var(--tracking-kicker)", textTransform: "uppercase", color: "var(--text-mention)",
        }}
      >
        <Icon name="pencil-line" size={13} color="var(--text-mention)" />
        {label}
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-body-s)", color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
        {texte}
      </p>
      <div
        style={{
          marginTop: "var(--space-8)", paddingTop: "var(--space-8)",
          borderTop: "var(--border-width) solid var(--border-hairline)",
          fontSize: "var(--text-mention-s)", color: "var(--text-mention)",
        }}
      >
        {qui}
      </div>
    </div>
  );
}

// Une question de l'accordéon. Bouton véritable (pas un <div> cliquable) :
// aria-expanded porte l'état, aria-controls désigne le panneau qu'il
// commande. Le panneau lui-même reste dans le DOM replié — sa hauteur
// s'anime via grid-template-rows — mais aria-hidden le retire de l'arbre
// d'accessibilité tant qu'il est fermé, pour qu'un lecteur d'écran
// n'annonce jamais une réponse invisible à l'écran.
function FaqEntry({ item, labelARediger, quiRedige }: { item: Item; labelARediger: string; quiRedige: string }): ReactNode {
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
          <div style={{ paddingBottom: "var(--space-18)" }}>
            {"reponse" in item ? (
              <p
                style={{
                  margin: 0, fontSize: "var(--text-body-m)", lineHeight: "var(--leading-roomy)",
                  maxWidth: "var(--measure)", color: "var(--text-secondary)", textWrap: "pretty",
                }}
              >
                {item.reponse}
              </p>
            ) : (
              <ReponseEnAttente label={labelARediger} texte={item.couvre} qui={quiRedige} />
            )}
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
  { groupes, labelARediger, quiRedige }: { groupes: Groupe[]; labelARediger: string; quiRedige: string },
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
              <FaqEntry key={item.q} item={item} labelARediger={labelARediger} quiRedige={quiRedige} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
