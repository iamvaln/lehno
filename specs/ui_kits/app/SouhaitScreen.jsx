import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { Card } from "../../components/core/Card.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { OfflineBanner } from "../../components/feedback/OfflineBanner.jsx";

/* Détail et gestion d'un souhait (3.19).
 *
 * L'ÉTAT A TROIS VALEURS — disponible, réservé, déjà offert — et il se change
 * ici. Le montrer en étiquette seule laissait « déjà offert » n'exister que
 * comme bouton : un état du modèle qu'on ne peut pas lire n'en est pas un.
 *
 * LA RÉSERVATION DIT QUI, OU DIT QU'ELLE NE LE DIT PAS. La spec est explicite :
 * le nom du réservant apparaît s'il a choisi de se faire connaître, sinon la
 * réservation reste anonyme. Une réservation muette laisserait croire à un
 * défaut d'affichage.
 *
 * L'EXPOSITION SUR LE MUR EST UN VRAI INTERRUPTEUR. C'était un span décoratif —
 * le geste le plus conséquent de l'écran, puisqu'il rend un souhait public, et
 * il ne répondait pas.
 *
 * « RETIRER » vit en bas, en contour : trouvable sans être offert. */

const ETATS = [
  ["disponible", "souhaitDisponible"],
  ["reserve", "souhaitReserve"],
  ["offert", "souhaitOffertEtat"]
];

export function SouhaitScreen({ t, etat = "nominal", onOpen }) {
  /* UNE SEULE SOURCE pour l'état. Le ternaire ignorait « anonyme » et retombait
     sur « disponible », pendant que le bandeau passait par une seconde branche :
     l'écran annonçait donc à la fois disponible et réservé. « anonyme » ne
     décide plus que la PHRASE, pas l'état. */
  const [valeur, setValeur] = React.useState(
    etat === "reserve" || etat === "anonyme" ? "reserve" : "disponible");
  const [surMur, setSurMur] = React.useState(true);
  const anonyme = etat === "anonyme";
  const reserve = valeur === "reserve";

  if (etat === "vide") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="souhaits-vide" titre={t.videSouhaitsTitre}
          texte={t.videSouhaitsTexte} action={t.souhaitAjouter} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {etat === "horsligne" ? <OfflineBanner t={t} enAttente={1} /> : null}

      <div style={{ padding: "8px 16px 18px", flex: 1 }}>
        {/* La photo de l'objet, facultative — et remplaçable : la spec en fait
            une action, pas un décor. */}
        <button type="button" className="lehno-focusable" style={{
          all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
          height: 132, borderRadius: "var(--radius-lg)", background: "var(--surface-panel)",
          display: "grid", placeItems: "center", marginBottom: 8
        }}>
          <span style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            color: "var(--text-accent)", fontFamily: "var(--font-body)",
            fontSize: 13, fontWeight: 600
          }}>
            <Icon name="image-plus" size={22} />
            {t.souhaitPhotoAjouter}
          </span>
        </button>

        <h1 className="lehno-display" style={{
          fontSize: 22, letterSpacing: "-.02em", margin: "12px 0 0", fontWeight: 500
        }}>{t.souhaitExemple}</h1>

        <div className="lehno-display" style={{
          fontSize: 26, fontWeight: 400, letterSpacing: "-.02em", marginTop: 8
        }}>{t.souhaitPrix}</div>

        {/* L'état se lit ET se change : trois valeurs, pas deux. */}
        <div style={{ marginTop: 20 }}>
          <SectionLabel>{t.souhaitEtat}</SectionLabel>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
            {ETATS.map(([k, cle]) => {
              const actif = valeur === k;
              return (
                <button key={k} type="button" onClick={() => setValeur(k)} aria-pressed={actif}
                  className="lehno-focusable" style={{
                    all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                    minHeight: 38, padding: "0 14px", borderRadius: "var(--radius-pill)",
                    fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                    border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
                    background: actif ? "var(--action)" : "transparent",
                    color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                  }}>{t[cle]}</button>
              );
            })}
          </div>
        </div>

        {/* Une réservation dit qui, ou dit qu'elle ne le dit pas. */}
        {reserve ? (
          <div style={{
            marginTop: 14, padding: "12px 14px", borderRadius: "var(--radius-lg)",
            background: "var(--surface-panel)", display: "flex", gap: 9,
            alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.5
          }}>
            <Icon name="bookmark" size={16} color="var(--text-accent)" style={{ marginTop: 2 }} />
            <span>{anonyme ? t.souhaitReserveAnonyme : t.souhaitReservePar("Awa Diop")}</span>
          </div>
        ) : null}

        <div style={{ marginTop: 20 }}>
          <SectionLabel>{t.souhaitPrecisions}</SectionLabel>
          <p style={{ margin: "7px 0 0", fontSize: 14.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {t.souhaitPrecisionsTexte}
          </p>
        </div>

        {/* Le lien : « où le trouver » est ce qui rend un souhait offrable. */}
        <div style={{ marginTop: 18 }}>
          <SectionLabel>{t.souhaitLien}</SectionLabel>
          <a href="#" style={{
            display: "inline-flex", alignItems: "center", gap: 7, marginTop: 7,
            minHeight: 34, fontSize: 14.5, color: "var(--text-accent)"
          }}>
            <Icon name="link" size={15} />{t.souhaitLienTexte}
          </a>
        </div>

        <Card padding={14} radius="lg" style={{ marginTop: 18 }}>
          <SectionLabel>{t.souhaitProvenance}</SectionLabel>
          <Quote size={14.5} style={{ marginTop: 6 }}>{t.souhaitParole}</Quote>
          <Provenance origin={t.souhaitOrigine} date={t.souhaitOrigineDate} />
        </Card>

        {/* Le geste le plus conséquent de l'écran : il rend un souhait public. */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 12, marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border-hairline)"
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5 }}>{t.souhaitSurMur}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-mention)", marginTop: 2 }}>
              {t.souhaitSurMurAide}
            </div>
          </div>
          <button type="button" role="switch" aria-checked={surMur}
            onClick={() => setSurMur((x) => !x)} className="lehno-focusable"
            aria-label={t.souhaitSurMur} style={{
              all: "unset", cursor: "pointer", flex: "none", width: 44, height: 26,
              borderRadius: 999, padding: 3, boxSizing: "border-box",
              background: surMur ? "var(--action)" : "var(--border-object)",
              transition: "background var(--transition-state)"
            }}>
            <span style={{
              display: "block", width: 20, height: 20, borderRadius: "50%",
              background: "var(--surface-page)",
              transform: surMur ? "translateX(18px)" : "translateX(0)",
              transition: "transform var(--transition-state)"
            }} />
          </button>
        </div>
      </div>

      <div style={{ padding: "0 16px 16px", flex: "none", display: "grid", gap: 8 }}>
        <Button platform="mobile" full variant="outline" icon="pencil">{t.modifier}</Button>
        <Button platform="mobile" full variant="destructive-outline" icon="trash-2">
          {t.souhaitRetirer}
        </Button>
      </div>
    </div>
  );
}
