import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { Card } from "../../components/core/Card.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Countdown } from "../../components/content/Countdown.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";
import { SensitiveBanner } from "../../components/feedback/SensitiveBanner.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { OfflineBanner } from "../../components/feedback/OfflineBanner.jsx";

export function OccasionScreen({
  t, qui = "Valery Bah", etat = "nominal", quand, souhaits = [], flags = {},
  onOpen, onLancer, onVoir
}) {
  /* TROIS DRAPEAUX TOUCHENT CETTE PAGE. La wishlist éteinte : le bloc part en
     entier — titre, lignes, « Ajouter », « Toute la wishlist » —, puisque tout
     y menait à un écran qui n'existe plus. Les générations éteintes : le bloc
     « préparer » part de même, plutôt que de garder son titre au-dessus de
     rien. L'achat éteint, lui, ne ferme rien : les générations deviennent
     gratuites, donc les coûts et le solde sortent de l'écran et le reste
     demeure. */
  const listeOuverte = flags.wishlist !== false;
  /* Le décompte vient de la carte touchée, comme la date juste à côté : écrit en
     dur, il annonçait « dans trois jours » un anniversaire du jour. */
  const jours = quand && quand.jours != null ? quand.jours : 3;
  const genere = flags.generation !== false;
  const gratuit = flags.credits === false;
  /* La date et le motif viennent de la carte touchée : « aujourd'hui » sur
     l'accueil ne peut pas devenir « le 24 » à l'écran suivant. */
  const dateDite = quand && (t.langue === "fr" ? quand.date : (quand.dateEn || quand.date));
  const motif = quand && (t.langue === "fr" ? quand.quoi : (quand.quoiEn || quand.quoi));
  const sensible = etat === "sensible";
  const passee = etat === "passee";
  const soldeVide = etat === "solde";
  /* Une occasion déjà travaillée : le message est écrit, un souhait est parti.
     Sans cet état, on ne voyait qu'une occasion neuve ou une occasion passée. */
  const prepare = etat === "prepare";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {sensible ? <SensitiveBanner>{t.sensibleApproche}</SensitiveBanner> : null}
      {etat === "horsligne" ? <OfflineBanner t={t} /> : null}

      {/* Privée de ses deux blocs, la page ne laisse pas 450 px de vide sous une
          carte de note : le geste du socle prend la place en pied, comme la
          fiche promeut « Ajouter une note » quand « Préparer » s'en va. */}
      <div style={{
        padding: "8px 16px 18px", flex: 1,
        display: "flex", flexDirection: "column"
      }}>
        {/* En-tête : le proche, le type, la date et le décompte */}
        <button type="button" onClick={() => onOpen && onOpen("proche", { nom: qui })} className="lehno-focusable"
          style={{
            all: "unset", cursor: "pointer", display: "flex", alignItems: "center",
            gap: 12, width: "100%", boxSizing: "border-box"
          }}>
          <Avatar name={qui} size={46} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="lehno-display" style={{ fontSize: 20, display: "block" }}>{qui}</span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {motif || t.typeAnniversaire} · {dateDite || (t.langue === "fr" ? "24 août" : "24 Aug")}
            </span>
          </span>
          {passee
            ? <Tag tone="quiet">{t.occPassee}</Tag>
            : <Countdown size="s" today={jours === 0} style={{ flex: "none" }}
                label={jours === 0 ? t.aujourdhui : t.decompte(jours)} />}
        </button>

        {passee ? (
          <>
            <div style={{ marginTop: 24 }}>
              <SectionLabel>{t.occMessageEnvoye}</SectionLabel>
              <Card padding={15} radius="lg" style={{ marginTop: 9 }}>
                <Quote size={15}>{t.occMessageTexte}</Quote>
                <Provenance origin={t.occEnvoyeLe} date={t.langue === "fr" ? "24 août" : "24 Aug"} />
              </Card>
            </div>
            <div style={{ marginTop: 20 }}>
              <SectionLabel>{t.occVoeuxRecus}</SectionLabel>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
                {t.occAucunVoeu}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* La wishlist de l'occasion */}
            {listeOuverte ? (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <SectionLabel>{t.occSouhaits}</SectionLabel>
                <button type="button"
                  onClick={() => onOpen && onOpen("souhait", { nouveau: true, mien: false, pour: qui })}
                  className="lehno-focusable" style={{
                    all: "unset", cursor: "pointer", marginLeft: "auto",
                    display: "inline-flex", alignItems: "center",
                    minHeight: "var(--touch-min)", margin: "-14px 0 -14px auto",
                    fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-accent)"
                  }}>{t.souhaitAjouter}</button>
              </div>

              {sensible ? (
                <div style={{ fontSize: 13.5, color: "var(--text-mention)", marginTop: 9 }}>
                  {t.occSansSouhait}
                </div>
              ) : (
                <div style={{ display: "grid", marginTop: 6 }}>
                  {souhaits.slice(0, 3).map((s, i) => {
                    const dit = s.etat === "offert" ? t.souhaitOffertEtat
                      : s.etat === "ecarte" ? t.souhaitEcarte
                      : s.etat === "retenu" ? t.listeRetenu : t.souhaitAEtudier;
                    return (
                    <button key={s.id} type="button"
                      onClick={() => onOpen && onOpen("souhait", { ...s, mien: false, pour: qui })}
                      className="lehno-focusable" style={{
                        all: "unset", boxSizing: "border-box", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 10, padding: "12px 0",
                        minHeight: "var(--touch-min)",
                        borderTop: i ? "1px solid var(--border-hairline)" : "none"
                      }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, whiteSpace: "nowrap",
                        overflow: "hidden", textOverflow: "ellipsis" }}>{s.quoi}</span>
                      <Tag tone={s.etat === "retenu" ? "outline" : "quiet"}
                        style={{ fontSize: 11, padding: "2px 8px", flex: "none" }}>{dit}</Tag>
                      <Icon name="chevron-right" size={15} color="var(--text-mention)" style={{ flex: "none" }} />
                    </button>
                    );
                  })}

                  <button type="button" onClick={() => onOpen && onOpen("listes", { nom: qui })}
                    className="lehno-focusable" style={{
                      all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                      display: "flex", alignItems: "center", gap: 8, padding: "12px 0",
                      minHeight: "var(--touch-min)",
                      borderTop: "1px solid var(--border-hairline)",
                      fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600,
                      color: "var(--text-accent)"
                    }}>
                    <span style={{ flex: 1 }}>{t.occSouhaitsTout(souhaits.length)}</span>
                    <Icon name="chevron-right" size={15} />
                  </button>
                </div>
              )}
            </div>
            ) : null}

            {/* Notes propres à cette célébration */}
            <div style={{ marginTop: 22 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <SectionLabel>{t.occNotes}</SectionLabel>
                <button type="button" onClick={() => onOpen && onOpen("note", { nom: qui })}
                  className="lehno-focusable" style={{
                    all: "unset", cursor: "pointer", marginLeft: "auto",
                    display: "inline-flex", alignItems: "center",
                    minHeight: "var(--touch-min)", margin: "-14px 0 -14px auto",
                    fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-accent)"
                  }}>{t.noteAjouter}</button>
              </div>
              <Card padding={14} radius="lg" style={{ marginTop: 9 }}>
                <Quote size={14.5}>{t.occNoteTexte}</Quote>
                <Provenance origin={t.souhaitOrigine} date={t.occNoteDate} />
              </Card>
            </div>

            {/* Ce qui est déjà écrit se relit ici : on ne repropose pas de le
                payer, et « Refaire » redit son prix. */}
            {prepare && genere ? (
              <div style={{ marginTop: 22 }}>
                <SectionLabel>{t.occMessagePret}</SectionLabel>
                <Card padding={15} radius="lg" style={{ marginTop: 9 }}>
                  <Quote size={15}>{t.occMessageTexte}</Quote>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <Button platform="mobile" variant="outline" style={{ flex: 1 }}
                      onClick={() => onVoir && onVoir("message")}>{t.prepVoir}</Button>
                    <Button platform="mobile" variant="text" style={{ flex: "none" }}
                      onClick={() => onLancer && onLancer("message")}>{t.prepRelancer}</Button>
                  </div>
                </Card>
              </div>
            ) : null}

            {/* La préparation assistée — une occasion sensible se concentre
                sur le message, sans idée de cadeau. */}
            {genere ? (
            <div style={{ marginTop: 24 }}>
              <SectionLabel>{t.occPreparer}</SectionLabel>              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {!sensible ? (
                  <div>
                    <Button platform="mobile" full variant="outline" icon="sparkles"
                      onClick={() => (prepare
                        ? onVoir && onVoir("idees")
                        : onLancer && onLancer("idees"))}>
                      {prepare ? t.prepVoirIdees : t.occIdees}
                    </Button>
                    {prepare || gratuit ? null : <CreditIndicator t={t} cout={1} style={{ marginTop: 7 }} />}
                  </div>
                ) : null}
                {prepare ? null : (
                <div>
                  <Button platform="mobile" full onClick={() => onLancer && onLancer("message")}>
                    {t.occMessage}
                  </Button>
                  {gratuit ? null : <CreditIndicator t={t} cout={1} style={{ marginTop: 7 }} />}
                </div>
                )}
                {/* Le solde une seule fois, en pied du bloc — le répéter sous
                    chaque action le transforme en bruit. */}
                {gratuit ? null : (
                  <CreditIndicator t={t} solde={soldeVide ? 0 : 4}
                    onRecharger={() => onOpen && onOpen("recharge")} style={{ marginTop: 4 }} />
                )}
              </div>
            </div>
            ) : null}

            {/* Ni génération ni wishlist : le geste du socle devient l'action
                principale, en pied, plutôt que de laisser la place ouverte. */}
            {genere || listeOuverte ? null : (
              <div style={{ marginTop: "auto", paddingTop: 24 }}>
                <Button platform="mobile" full icon="plus"
                  onClick={() => onOpen && onOpen("note", { nom: qui })}>
                  {t.occNoterPour(dateDite || (t.langue === "fr" ? "24 août" : "24 Aug"))}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
