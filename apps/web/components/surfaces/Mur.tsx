import type { ReactNode } from "react";
import type { PublicWall } from "@lehno/contracts";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { PublicShell } from "../PublicShell.js";
import { Avatar, Tag } from "../ui/index.js";
import { jourEtMois } from "../../lib/dates.js";

/**
 * Le Mur — la page publique d'un utilisateur.
 *
 * **C'est la seule surface où la marque ne parle pas en son nom.** Sur la
 * landing, le produit vouvoie le visiteur ; ici, c'est le propriétaire qui
 * s'adresse à ses proches. « Je », tutoiement.
 *
 * **Tout est facultatif, et un bloc absent ne se remplace par rien.** Pas de
 * cadre gris, pas d'« aucune information » : une vitrine à moitié vide reste
 * une vitrine, alors qu'un emplacement vide signalé se lit comme un défaut.
 *
 * **L'invitation vit dans la page**, en pied — d'où `acquisition={false}` sur
 * la coquille. Deux invitations à la suite, c'en est une de trop.
 */
export function Mur(
  { t, langue, mur }: { t: Messages; langue: Langue; mur: PublicWall },
): ReactNode {
  return (
    <PublicShell t={t} langue={langue} acquisition={false}>
      <section
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto",
          padding: "clamp(48px,8vw,88px) var(--page-gutter)",
          display: "grid", gap: "var(--space-32)", justifyItems: "start",
        }}
      >
        <Avatar name={mur.displayName} size={72} />

        <div>
          <h1
            className="titre"
            style={{
              fontWeight: "var(--font-display-medium)",
              fontSize: "clamp(30px,5vw,46px)",
              lineHeight: "var(--leading-display)",
              letterSpacing: "var(--tracking-display)",
              margin: 0, textWrap: "balance",
            }}
          >
            {mur.displayName}
          </h1>
          {/* Le mot d'accueil est de lui : il passe avant tout ce que la page
              compose elle-même. */}
          {mur.welcomeMessage ? (
            <p style={{ margin: "var(--space-14) 0 0", maxWidth: "62ch", textWrap: "pretty" }}>
              {mur.welcomeMessage}
            </p>
          ) : null}
        </div>

        {mur.birthday ? (
          <p style={{ margin: 0 }}>
            <strong>{t.murAnniversaire}</strong>
            {" — "}
            {jourEtMois(mur.birthday, langue)}
          </p>
        ) : null}

        {mur.interests.length > 0 ? (
          <div>
            <strong>{t.murInterets}</strong>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-8)", marginTop: "var(--space-10)" }}>
              {mur.interests.map((interet) => (
                <Tag key={`${interet.kind}-${interet.value}`}>{interet.value}</Tag>
              ))}
            </div>
          </div>
        ) : null}

        {/* Le jeton est nul quand il n'y a pas d'occasion, quand la fenêtre est
            fermée, ou quand le drapeau est éteint — le serveur résout les trois,
            et la page n'a aucune règle à connaître. On ne propose donc jamais un
            bouton qui mènerait à un 404 ; on garde le fait, sur une ligne. */}
        {mur.wishLinkToken ? (
          <a
            href={`/${langue}/v/${mur.wishLinkToken}`}
            style={{
              background: "var(--celebrate)", color: "var(--on-celebrate)",
              padding: "var(--space-14) var(--space-28)", borderRadius: "var(--radius-md)",
              fontWeight: "var(--font-body-bold)", textDecoration: "none",
            }}
          >
            {t.murDeposer}
          </a>
        ) : (
          <p style={{ margin: 0, color: "var(--text-mention)" }}>{t.murVoeuxFermes}</p>
        )}

        <a href={`/${langue}`} style={{ fontWeight: "var(--font-body-semibold)" }}>
          {t.murInvitation}
        </a>
      </section>
    </PublicShell>
  );
}
