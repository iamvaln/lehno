import type { ReactNode } from "react";
import type { Invitation as Parrainage } from "@lehno/contracts";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { interpoler } from "../../lib/texte.js";
import { BadgesMagasins } from "../BadgesMagasins.js";
import { PublicShell } from "../PublicShell.js";
import { Avatar, Banner } from "../ui/index.js";

/**
 * L'invitation au parrainage — silhouette « carte ».
 *
 * **Une invitation est intime** : quelqu'un vous dit que ça vous servira. La
 * page tient donc en une colonne, sur du blanc, sans aplat ni maquette de
 * téléphone : qui invite, ce que fait Lehno, ce qu'il y a à l'ouverture,
 * comment l'installer. Un héros à deux colonnes et un chiffre à 82 px, ce
 * serait de l'argumentaire de marque là où il n'y a qu'une recommandation
 * entre deux personnes.
 *
 * **Le gain tient sur une ligne** — un chiffre, puis sa raison — au lieu de
 * tenir une section.
 *
 * **La page ne porte pas la clôture d'acquisition de la coquille** : elle *est*
 * la page d'acquisition. Répéter « Découvrir Lehno » sous les badges des
 * magasins reviendrait à proposer deux fois la même chose dans deux tons
 * différents.
 *
 * Sans code valable, il n'y a pas de gain à annoncer : la ligne disparaît, les
 * badges restent. Le contrat ne distingue pas « expiré » de « déjà employé »
 * — la page ne l'invente pas.
 */
export function Invitation(
  { t, langue, parrainage }: {
    t: Messages; langue: Langue; parrainage: Parrainage | null;
  },
): ReactNode {
  return (
    <PublicShell t={t} langue={langue} acquisition={false}>
      <section
        style={{
          maxWidth: "40rem", margin: "0 auto",
          padding: "clamp(40px,7vw,72px) var(--page-gutter)",
          display: "grid", gap: "var(--space-30)",
        }}
      >
        {parrainage === null ? <Banner intent="warning">{t.inviteSansCode}</Banner> : null}

        {parrainage ? (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
            <Avatar name={parrainage.inviterUsername} size={40} />
            <div style={{ color: "var(--text-secondary)" }}>
              <strong style={{ color: "var(--text-body)" }}>{parrainage.inviterUsername}</strong>
              {" "}
              {t.inviteMention}
            </div>
          </div>
        ) : null}

        <div>
          <h1
            className="titre"
            style={{
              margin: 0,
              fontWeight: "var(--font-display-regular)",
              fontSize: "clamp(29px,3.4vw,40px)",
              lineHeight: "var(--leading-display)",
              letterSpacing: "var(--tracking-display)",
              textWrap: "balance",
            }}
          >
            {parrainage ? t.inviteTitre : t.inviteTitreSansCode}
          </h1>
          <p style={{ margin: "var(--space-16) 0 0", color: "var(--text-secondary)", textWrap: "pretty" }}>
            {t.invitePromesse}
          </p>
        </div>

        {/* Le gain ne s'annonce QUE s'il existe : un chiffre à zéro, ou promis
            sans code, serait une promesse que l'ouverture du compte
            démentirait. */}
        {parrainage && parrainage.creditsForInvited > 0 ? (
          <p
            style={{
              margin: 0, paddingTop: "var(--space-24)",
              borderTop: "var(--border-width) solid var(--border-hairline)",
              textWrap: "pretty",
            }}
          >
            <span
              className="titre"
              style={{ fontSize: 26, letterSpacing: "var(--tracking-display)", color: "var(--text-accent)" }}
            >
              {parrainage.creditsForInvited}
            </span>
            {" "}
            {t.inviteGainTexte}
          </p>
        ) : null}

        <div style={{ display: "grid", gap: "var(--space-14)", justifyItems: "start" }}>
          <BadgesMagasins t={t} langue={langue} />
          {parrainage ? (
            <div style={{ fontSize: "var(--text-mention-m)", color: "var(--text-mention)" }}>
              {t.inviteCodeLabel}{" "}
              <span style={{ fontWeight: "var(--font-body-bold)", letterSpacing: ".08em", color: "var(--text-accent)" }}>
                {parrainage.code}
              </span>
            </div>
          ) : null}
        </div>
      </section>
    </PublicShell>
  );
}
