import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { PublicShell } from "../PublicShell.js";

/**
 * La page introuvable.
 *
 * **Elle dit ce qui s'est passé et propose la suite.** Pas d'excuse, pas
 * d'illustration, pas d'« Oups » — quelqu'un arrivé là par le lien d'une amie
 * n'a pas besoin d'être consolé, il a besoin de savoir quoi faire.
 *
 * Elle porte **le cadre du site**, en-tête et pied compris : c'est souvent la
 * première page de Lehno qu'un visiteur voit, et une page nue ne lui laisserait
 * aucun moyen d'aller voir ce qu'est Lehno.
 *
 * Elle sert aussi de réponse aux surfaces de lien : un Mur non publié, un jeton
 * qui n'a jamais rien désigné. Distinguer « n'existe pas » de « privé » dirait
 * qui a un compte (§9.3 — 404, jamais 403), et c'est pourquoi ces cas arrivent
 * ici plutôt que sur un écran à eux.
 */
export function Introuvable({ t, langue }: { t: Messages; langue: Langue }): ReactNode {
  return (
    <PublicShell t={t} langue={langue}>
      <section
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto",
          padding: "clamp(56px,9vw,104px) var(--page-gutter)",
          display: "grid", gap: "var(--space-22)", justifyItems: "start",
        }}
      >
        <div
          className="titre"
          aria-hidden="true"
          style={{
            fontWeight: "var(--font-display-regular)",
            fontSize: "clamp(56px,9vw,92px)", lineHeight: 1,
            letterSpacing: "var(--tracking-display)", color: "var(--text-accent)",
          }}
        >
          404
        </div>
        <h1
          className="titre"
          style={{
            margin: 0,
            fontWeight: "var(--font-display-regular)",
            fontSize: "clamp(28px,3.6vw,40px)",
            lineHeight: "var(--leading-display)",
            letterSpacing: "var(--tracking-display)",
            textWrap: "balance",
          }}
        >
          {t.introuvableTitre}
        </h1>
        <p style={{ margin: 0, maxWidth: "58ch", color: "var(--text-secondary)", textWrap: "pretty" }}>
          {t.introuvableTexte}
        </p>
        <div style={{ display: "flex", gap: "var(--space-16)", flexWrap: "wrap" }}>
          <a href={`/${langue}`} style={{ fontWeight: "var(--font-body-semibold)" }}>
            {t.introuvableRetour}
          </a>
          <a href={`/${langue}/faq`}>{t.introuvableFaq}</a>
        </div>
      </section>
    </PublicShell>
  );
}
