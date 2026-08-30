import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { PublicShell } from "../PublicShell.js";

/**
 * Un avis court : ce qui s'est passé, et la suite.
 *
 * **Le titre porte l'information**, une ligne l'explique, le pied offre la
 * sortie. Pas d'illustration, pas d'« Oups » — un visiteur arrivé par le lien
 * d'une amie n'a pas besoin d'être consolé, il a besoin de savoir quoi faire.
 *
 * Il sert à tout ce qui n'est pas un contenu : un lien révoqué, une liste
 * dépubliée, un service injoignable. Un écran par cas dirait à chaque fois la
 * même chose avec une mise en page différente.
 */
export function AvisCourt(
  { t, langue, titre, texte }: {
    t: Messages; langue: Langue; titre: string; texte: string;
  },
): ReactNode {
  return (
    <PublicShell t={t} langue={langue}>
      <section
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto",
          padding: "clamp(64px,10vw,120px) var(--page-gutter)",
        }}
      >
        <h1
          className="titre"
          style={{
            fontWeight: "var(--font-display-medium)",
            fontSize: "clamp(30px,5vw,46px)",
            lineHeight: "var(--leading-display)",
            letterSpacing: "var(--tracking-display)",
            margin: 0, maxWidth: "24ch", textWrap: "balance",
          }}
        >
          {titre}
        </h1>
        <p style={{ margin: "var(--space-16) 0 var(--space-32)", maxWidth: "62ch", textWrap: "pretty" }}>
          {texte}
        </p>
        <a href={`/${langue}`} style={{ fontWeight: "var(--font-body-semibold)" }}>
          {t.etatRetour}
        </a>
      </section>
    </PublicShell>
  );
}
