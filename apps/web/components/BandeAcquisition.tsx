import type { ReactNode } from "react";
import type { Langue } from "../lib/langues.js";
import type { Messages } from "../messages/index.js";

/** Ce qu'une surface dit d'elle-même pour inviter. Absente, la coquille reprend
 *  les clés génériques. */
export interface Acquisition {
  titre: string;
  texte: string;
  action: string;
}

/**
 * L'invitation, au pied de chaque surface publique.
 *
 * **La phrase parle du contexte, pas du produit.** « Vous aussi, soyez là le
 * jour J » est vrai partout, donc convaincant nulle part : une surface qui sait
 * mieux dire passe la sienne. Mais le générique vaut mieux que rien — c'est ce
 * qui évite qu'une page publique se termine sans porte de sortie.
 *
 * Elle ne se pose pas partout pour autant : la landing finit déjà sur son aplat
 * de clôture, et le Mur porte son invitation dans la page. Deux invitations à
 * la suite, c'en est une de trop.
 */
export function BandeAcquisition(
  { t, langue, acquisition }: { t: Messages; langue: Langue; acquisition?: Acquisition },
): ReactNode {
  const dit = acquisition ?? { titre: t.acqTitre, texte: t.acqTexte, action: t.acqAction };

  return (
    <section
      aria-labelledby="acquisition-titre"
      style={{ background: "var(--surface-band)", color: "var(--on-band)" }}
    >
      <div
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto",
          padding: "clamp(40px,6vw,68px) var(--page-gutter)",
          display: "flex", gap: "clamp(24px,4vw,56px)",
          alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <h2
            id="acquisition-titre"
            className="titre"
            style={{
              fontWeight: "var(--font-display-medium)",
              fontSize: "clamp(26px,4vw,40px)",
              lineHeight: "var(--leading-display)",
              letterSpacing: "var(--tracking-display)",
              margin: 0, textWrap: "balance",
            }}
          >
            {dit.titre}
          </h2>
          <p style={{ margin: "var(--space-10) 0 0", maxWidth: "56ch", textWrap: "pretty" }}>
            {dit.texte}
          </p>
        </div>
        {/* Un lien, pas un bouton : c'est une navigation vers la landing, et
            l'annoncer comme un bouton priverait le visiteur du clic milieu, de
            l'ouverture en onglet et de l'aperçu de destination. La mise en
            forme reprend celle de l'aplat de clôture, dont c'est le pendant. */}
        <a
          href={`/${langue}`}
          style={{
            background: "var(--celebrate)", color: "var(--on-celebrate)",
            padding: "var(--space-16) var(--space-32)", borderRadius: "var(--radius-md)",
            fontWeight: "var(--font-body-bold)", fontSize: "var(--text-body-l)",
            textDecoration: "none", fontFamily: "var(--font-body)", flex: "0 0 auto",
          }}
        >
          {dit.action}
        </a>
      </div>
    </section>
  );
}
