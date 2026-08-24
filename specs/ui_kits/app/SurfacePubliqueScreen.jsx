import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { Card } from "../../components/core/Card.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";

/* Surfaces publiques dans l'application (3.12).
 *
 * Une personne équipée de l'application ouvre un lien public : la surface
 * s'affiche ici plutôt que dans le navigateur. Trois situations, et la spec les
 * traite comme trois comportements, pas comme trois écrans.
 *
 * SANS COMPTE, AUCUN ÉCRAN DE CONNEXION. C'est la règle qui gouverne l'écran :
 * répondre à une collecte ou laisser un vœu ne demande rien. La proposition de
 * créer un espace vient APRÈS le geste — un mur d'inscription avant ferait
 * perdre le geste et la personne.
 *
 * CONNECTÉ, LA PERSONNE EST RECONNUE : son pseudo est déjà connu, elle n'a rien
 * à saisir. Le champ de nom disparaît alors — le laisser vide alors qu'on sait
 * qui c'est, c'est demander deux fois.
 *
 * L'INVITATION EST UNE INVITATION. Elle vient une fois le geste accompli, elle
 * porte un « pas maintenant » qui marche, et elle ne revient pas dans la même
 * session. C'est ce qui la distingue d'un mur.
 */

const GOUTS = { fr: ["jazz", "céramique", "randonnée"], en: ["jazz", "ceramics", "hiking"] };

export function SurfacePubliqueScreen({ t, etat = "voeu", onOpen }) {
  const langue = t.langue === "fr" ? "fr" : "en";
  const [envoye, setEnvoye] = React.useState(false);
  const [ecarte, setEcarte] = React.useState(false);

  /* Les trois situations de la spec, plus les états d'indisponibilité. */
  const connecte = etat === "connecte";
  const mur = etat === "mur" || etat === "murprive";
  const collecte = etat === "collecte";

  if (etat === "revoque") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="lien-revoque" titre={t.pubRevoque}
          texte={t.pubRevoqueTexte} />
      </div>
    );
  }

  if (etat === "voeuxclos") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="voeux-clos" titre={t.pubVoeuxClos} />
      </div>
    );
  }

  if (etat === "murprive") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="mur-depublie" titre={t.pubMurPrive} />
      </div>
    );
  }

  /* Le geste accompli, puis l'invitation. Jamais l'inverse. */
  if (envoye) {
    return (
      <div style={{ padding: "8px 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <Banner intent="success" style={{ margin: "0 -16px 0" }}>{t.pubEnvoye}</Banner>

        {ecarte ? null : (
          <Card surface="panel" padding={18} radius="xl" style={{ marginTop: 20 }}>
            <h2 className="lehno-display" style={{
              fontSize: 20, letterSpacing: "-.02em", margin: 0, fontWeight: 500
            }}>{t.pubInviteTitre}</h2>
            <p style={{
              margin: "8px 0 0", fontSize: 14, color: "var(--text-secondary)",
              lineHeight: 1.5, maxWidth: "34ch"
            }}>{t.pubInviteTexte}</p>
            <Button platform="mobile" full style={{ marginTop: 14 }}
              onClick={() => onOpen && onOpen("connexion")}>{t.pubInviteAction}</Button>
            {/* Un « pas maintenant » qui marche : c'est ce qui distingue une
                invitation d'un mur. */}
            <Button platform="mobile" full variant="text" onClick={() => setEcarte(true)}>
              {t.pubInvitePlusTard}
            </Button>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Reconnu : on le dit, et on ne redemande rien. Sans compte : on dit que
          rien n'est demandé — c'est ce qui lève l'hésitation avant le geste. */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
        fontSize: 12.5, color: "var(--text-mention)"
      }}>
        <Icon name={connecte ? "circle-check" : "unlock"} size={14}
          color={connecte ? "var(--feedback-success)" : "var(--text-mention)"} />
        <span>{connecte ? t.pubReconnu("Valentine") : t.pubSansCompte}</span>
      </div>

      <div style={{ padding: "4px 16px 18px", flex: 1 }}>
        {/* Qui invite, pas qui lit : sur une collecte c'est Valentine qui
            demande, sur un Mur ou un vœu c'est Awa dont on visite la page. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={collecte ? "Valentine" : "Awa Diop"} size={48} />
          <h1 className="lehno-display" style={{
            fontSize: 20, letterSpacing: "-.02em", margin: 0, fontWeight: 500, flex: 1
          }}>{mur ? t.pubMurTitre : collecte ? t.pubCollecteTitre : t.pubVoeuTitre}</h1>
        </div>

        {mur ? (
          <>
            <div style={{ marginTop: 22 }}>
              <SectionLabel>{t.murGoutsLabel}</SectionLabel>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
                {GOUTS[langue].map((g) => <Tag key={g}>{g}</Tag>)}
              </div>
            </div>
            <Card padding={15} radius="lg" style={{ marginTop: 18 }}>
              <SectionLabel>{t.murSouhaitsLabel}</SectionLabel>
              <div style={{ fontSize: 14.5, marginTop: 6 }}>{t.souhaitExemple}</div>
              <Button platform="mobile" full variant="outline" style={{ marginTop: 12 }}>
                {t.murListeCta}
              </Button>
            </Card>
            <Card padding={15} radius="lg" style={{ marginTop: 10 }}>
              <SectionLabel>{t.murMotLabel}</SectionLabel>
              <Quote size={15} style={{ marginTop: 6 }}>{t.murMotExemple}</Quote>
            </Card>
          </>
        ) : (
          <>
            {collecte ? (
              <>
                <p style={{
                  margin: "14px 0 0", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5
                }}>{t.pubCollecteQui("Valentine")}</p>
                <p style={{
                  margin: "8px 0 0", fontSize: 12.5, color: "var(--text-mention)", lineHeight: 1.45
                }}>{t.pubCollecteAvis}</p>

                <div style={{ marginTop: 22 }}>
                  <TextField platform="mobile" label={t.pubCollecteDate}
                    placeholder="22 / 03" hint={t.pubCollecteDateAide} />
                </div>

                <div style={{ marginTop: 20 }}>
                  <TextField platform="mobile" multiline rows={3}
                    label={t.pubCollecteSouhaits}
                    placeholder={t.pubCollecteSouhaitsPlaceholder}
                    hint={t.pubCollecteSouhaitsAide} />
                </div>

                <div style={{ marginTop: 20 }}>
                  <TextField platform="mobile" multiline rows={3}
                    label={t.pubCollecteMot}
                    placeholder={t.pubCollecteMotPlaceholder} />
                </div>
              </>
            ) : (
              <div style={{ marginTop: 20 }}>
                <TextField platform="mobile" multiline rows={4}
                  label={t.pubVoeuChamp} placeholder={t.pubVoeuPlaceholder} />
              </div>
            )}

            {/* Reconnue, Ana n'a pas à redonner son nom. */}
            {connecte ? null : (
              <div style={{ marginTop: 16 }}>
                <TextField platform="mobile" label={t.pubQui} hint={t.pubQuiAide} />
              </div>
            )}
          </>
        )}
      </div>

      {mur ? (
        <div style={{ padding: "0 16px 16px", flex: "none" }}>
          <Button platform="mobile" full onClick={() => setEnvoye(true)}>{t.murMotCta}</Button>
        </div>
      ) : (
        <div style={{ padding: "0 16px 16px", flex: "none" }}>
          <Button platform="mobile" full onClick={() => setEnvoye(true)}>{t.pubEnvoyer}</Button>
        </div>
      )}
    </div>
  );
}
