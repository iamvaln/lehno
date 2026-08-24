import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";
import { Quote } from "../../components/content/Quote.jsx";

/* Les écrans de compte de l'onglet Moi : profil, réglages, sécurité, paiement,
   aide, réservations.

   Ce sont les vues qu'on consulte deux ou trois fois par an. Elles ne cherchent
   donc pas à séduire : sections nommées, rangs identiques, aucune surprise. Le
   soin passe ailleurs — dans ce qu'elles disent quand quelque chose ne va pas.

   Les actions destructrices restent en contour, jamais en plein : trouvables,
   pas offertes. */

function Interrupteur({ actif, onBascule, libelle }) {
  return (
    <button type="button" role="switch" aria-checked={actif} onClick={onBascule}
      aria-label={libelle} className="lehno-focusable" style={{
        all: "unset", cursor: "pointer", flex: "none", width: 44, height: 26,
        borderRadius: 999, padding: 3, boxSizing: "border-box",
        background: actif ? "var(--action)" : "var(--border-object)",
        transition: "background var(--transition-state)"
      }}>
      <span style={{
        display: "block", width: 20, height: 20, borderRadius: "50%",
        background: "var(--surface-page)",
        transform: actif ? "translateX(18px)" : "translateX(0)",
        transition: "transform var(--transition-state)"
      }} />
    </button>
  );
}

function Bascule({ libelle, actif, onBascule, premier }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
      minHeight: "var(--touch-min)",
      borderTop: premier ? "none" : "1px solid var(--border-hairline)"
    }}>
      <span style={{ flex: 1, fontSize: 14.5 }}>{libelle}</span>
      <Interrupteur actif={actif} onBascule={onBascule} libelle={libelle} />
    </div>
  );
}

/* ─── Mon profil (3.23) ─────────────────────────────────────────────── */

export function ProfilScreen({ t, etat = "nominal", base = "../../", onEnregistrer }) {
  const pris = etat === "erreur";
  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ display: "grid", justifyItems: "center", gap: 10, margin: "8px 0 22px" }}>
        <Avatar name="Valentine" src={base + "assets/valentine.png"} size={76} />
        <button type="button" className="lehno-focusable" style={{
          all: "unset", cursor: "pointer", fontFamily: "var(--font-body)",
          fontSize: 13, color: "var(--text-accent)", fontWeight: 600
        }}>{t.profilPhoto}</button>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <TextField platform="mobile" label={t.champPrenom} defaultValue="Valentine" />
        <TextField platform="mobile" label={t.champPseudo} defaultValue="valentine"
          invalid={pris} hint={pris ? t.pseudoPris : t.pseudoAdresse} />
        <TextField platform="mobile" label={t.champEmail} type="email"
          defaultValue="valentine@exemple.fr" />
        <TextField platform="mobile" label={t.champLangue}
          defaultValue={t.langue === "fr" ? "Français" : "English"}
          hint={t.profilLangueAide} />
      </div>

      <Button platform="mobile" full style={{ marginTop: "auto" }} onClick={onEnregistrer}>
        {t.enregistrer}
      </Button>
    </div>
  );
}

/* ─── Rappels et notifications (3.11) ───────────────────────────────── */

export function ReglagesScreen({ t, etat = "nominal" }) {
  const refuse = etat === "refuse";
  const [quand, setQuand] = React.useState({ j7: true, j1: true, jour: true });
  const [comment, setComment] = React.useState({ push: !refuse, email: true });

  return (
    <div style={{ padding: "0 16px 18px" }}>
      {/* Le refus système se dit d'emblée, avec ce qui prend le relais : sans
          cette phrase, on croirait ne plus rien recevoir. */}
      {refuse ? (
        <Banner intent="warning" style={{ margin: "0 -16px 16px" }}>{t.reglagesRefus}</Banner>
      ) : null}

      <SectionLabel>{t.reglagesQuand}</SectionLabel>
      <div style={{ marginTop: 4 }}>
        <Bascule premier libelle={t.reglagesJ7} actif={quand.j7}
          onBascule={() => setQuand((v) => ({ ...v, j7: !v.j7 }))} />
        <Bascule libelle={t.reglagesJ1} actif={quand.j1}
          onBascule={() => setQuand((v) => ({ ...v, j1: !v.j1 }))} />
        <Bascule libelle={t.reglagesJour} actif={quand.jour}
          onBascule={() => setQuand((v) => ({ ...v, jour: !v.jour }))} />
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.reglagesComment}</SectionLabel>
        <div style={{ marginTop: 4, opacity: refuse ? 0.55 : 1 }}>
          <Bascule premier libelle={t.reglagesPush} actif={comment.push}
            onBascule={refuse ? undefined : () => setComment((v) => ({ ...v, push: !v.push }))} />
          <Bascule libelle={t.reglagesEmail} actif={comment.email}
            onBascule={() => setComment((v) => ({ ...v, email: !v.email }))} />
        </div>
      </div>

      {refuse ? (
        <Button platform="mobile" full variant="outline" icon="settings" style={{ marginTop: 20 }}>
          {t.reglagesActiver}
        </Button>
      ) : null}
    </div>
  );
}

/* ─── Sécurité et connexions (3.24) ─────────────────────────────────── */

export function SecuriteScreen({ t, etat = "nominal" }) {
  const inhabituelle = etat === "inhabituelle";
  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {inhabituelle ? (
        <Banner intent="warning" style={{ margin: "0 -16px 16px" }}>{t.securiteInhabituelle}</Banner>
      ) : null}

      <SectionLabel>{t.securiteMoyens}</SectionLabel>
      <div style={{ marginTop: 4 }}>
        {[["Google", "valentine@exemple.fr"], [t.champEmail, "valentine@exemple.fr"]].map(([nom, val], i) => (
          <div key={nom} style={{
            display: "flex", alignItems: "center", gap: 11, padding: "13px 0",
            borderTop: i ? "1px solid var(--border-hairline)" : "none"
          }}>
            <Icon name="key-round" size={16} color="var(--text-mention)" />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5 }}>{nom}</span>
              <span style={{ fontSize: 12.5, color: "var(--text-mention)" }}>{val}</span>
            </span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.securiteAppareils}</SectionLabel>
        <div style={{ marginTop: 4 }}>
          {[[t.securiteCetAppareil, "iPhone · Douala", true],
            ["Chrome", t.langue === "fr" ? "Ordinateur · il y a 3 jours" : "Desktop · 3 days ago", false]].map(([nom, val, ici], i) => (
            <div key={nom} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "13px 0",
              borderTop: i ? "1px solid var(--border-hairline)" : "none"
            }}>
              <Icon name={ici ? "smartphone" : "monitor"} size={16} color="var(--text-mention)" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5 }}>{nom}</span>
                <span style={{ fontSize: 12.5, color: "var(--text-mention)" }}>{val}</span>
              </span>
              {ici ? <Icon name="check" size={15} color="var(--feedback-success)" /> : null}
            </div>
          ))}
        </div>
        <Button platform="mobile" full variant="outline" style={{ marginTop: 14 }}>
          {t.securiteDeconnecterTout}
        </Button>
      </div>

      <div style={{
        marginTop: "auto", paddingTop: 28, borderTop: "1px solid var(--border-hairline)"
      }}>
        <Button platform="mobile" full variant="destructive-outline" icon="trash-2">
          {t.securiteSupprimer}
        </Button>
        <p style={{
          margin: "8px 0 0", fontSize: 12, color: "var(--text-mention)", textAlign: "center"
        }}>{t.securiteSupprimerAide}</p>
      </div>
    </div>
  );
}

/* ─── Méthodes de paiement (3.25) ───────────────────────────────────── */

export function PaiementScreen({ t, etat = "nominal" }) {
  if (etat === "vide") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="paiement-attente"
          titre={t.paiementAucuneTitre} texte={t.paiementAucuneTexte}
          action={t.paiementAjouter} onAction={() => {}} />
      </div>
    );
  }

  const expire = etat === "expire";
  return (
    <div style={{ padding: "0 16px 18px" }}>
      <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
        <Card padding={15} radius="lg">
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Icon name="smartphone" size={17} color="var(--text-mention)" />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5 }}>{t.rechargeMobile}</span>
              <span style={{ fontSize: 12.5, color: "var(--text-mention)" }}>+237 6•• •• 41 08</span>
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase",
              color: "var(--feedback-success)"
            }}>{t.paiementDefaut}</span>
          </div>
        </Card>

        <Card padding={15} radius="lg" style={{
          borderColor: expire ? "var(--feedback-error)" : undefined
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Icon name="credit-card" size={17}
              color={expire ? "var(--feedback-error)" : "var(--text-mention)"} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5 }}>•••• 4218</span>
              <span style={{
                fontSize: 12.5, color: expire ? "var(--feedback-error)" : "var(--text-mention)"
              }}>{expire ? t.paiementExpire : "12/27"}</span>
            </span>
          </div>
        </Card>
      </div>

      <Button platform="mobile" full variant="outline" icon="plus" style={{ marginTop: 16 }}>
        {t.paiementAjouter}
      </Button>
    </div>
  );
}

/* ─── Aide (3.26) ───────────────────────────────────────────────────── */

export function AideScreen({ t }) {
  const rangs = [
    [t.aideQuestions, "circle-help"],
    [t.aideContact, "mail"],
    [t.aideNoter, "star"]
  ];
  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ marginTop: 4 }}>
        {rangs.map(([l, ic], i) => (
          <button key={l} type="button" className="lehno-focusable" style={{
            all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
            display: "flex", alignItems: "center", gap: 11, padding: "14px 0",
            minHeight: "var(--touch-min)",
            borderTop: i ? "1px solid var(--border-hairline)" : "none"
          }}>
            <Icon name={ic} size={17} color="var(--text-mention)" />
            <span style={{ flex: 1, fontSize: 14.5 }}>{l}</span>
            <Icon name="chevron-right" size={15} color="var(--text-mention)" />
          </button>
        ))}
      </div>
      <div style={{
        marginTop: "auto", paddingTop: 24, textAlign: "center",
        fontSize: 12, color: "var(--text-mention)"
      }}>{t.aideVersion} 1.0</div>
    </div>
  );
}

/* ─── Mes réservations (3.27) ───────────────────────────────────────── */

const RESERVATIONS = {
  fr: [
    { id: "v1", quoi: "Un moulin à café manuel", qui: "Valery Bah", quand: "24 août", jours: 3 },
    { id: "v2", quoi: "Un cours de céramique", qui: "Awa Diop", quand: "22 août", jours: 0 },
    { id: "v3", quoi: "Une paire de gants de jardin", qui: "Maman", quand: "2 sept.", jours: 12, retire: true }
  ],
  en: [
    { id: "v1", quoi: "A hand coffee grinder", qui: "Valery Bah", quand: "24 Aug", jours: 3 },
    { id: "v2", quoi: "A ceramics class", qui: "Awa Diop", quand: "22 Aug", jours: 0 },
    { id: "v3", quoi: "A pair of garden gloves", qui: "Maman", quand: "2 Sep", jours: 12, retire: true }
  ]
};

export function ReservationsScreen({ t, etat = "nominal" }) {
  const langue = t.langue === "fr" ? "fr" : "en";

  if (etat === "vide") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="souhait-reserve"
          titre={t.reservVideTitre} texte={t.reservVideTexte} />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 18px" }}>
      <p style={{
        margin: "4px 0 16px", fontSize: 14, color: "var(--text-secondary)", maxWidth: "36ch"
      }}>{t.reservIntro}</p>

      {RESERVATIONS[langue].map((r) => (
        <Card key={r.id} padding={15} radius="lg" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
            <Avatar name={r.qui} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="lehno-display" style={{ fontSize: 16 }}>{r.quoi}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2 }}>
                {t.procheProchaine(r.qui, r.quand)}
              </div>
            </div>
          </div>

          {/* Un souhait retiré par son propriétaire se signale : on doit savoir
              qu'il ne faut plus l'offrir, sans que la réservation disparaisse. */}
          {r.retire ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 7, marginTop: 10,
              paddingTop: 9, borderTop: "1px solid var(--border-hairline)",
              fontSize: 12.5, color: "var(--feedback-warning)"
            }}>
              <Icon name="circle-alert" size={14} strokeWidth={2} />
              <span>{t.reservRetire}</span>
            </div>
          ) : null}

          <Button platform="mobile" full variant="text" style={{ marginTop: 10 }}>
            {t.reservLiberer}
          </Button>
        </Card>
      ))}
    </div>
  );
}
