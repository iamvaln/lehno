import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";
import { Illustration } from "../../components/brand/Illustration.jsx";

/* Crédits et recharge (3.9).

   Le mobile money impose son propre temps : la demande part vers le téléphone,
   et l'utilisateur doit la valider ailleurs. C'est le moment le plus inquiétant
   du produit — on ne sait pas si son argent est parti. L'écran d'attente dit
   donc exactement où regarder, et laisse annuler : sans cette sortie, on ferme
   l'application en doutant.

   Les paliers montrent leur remise en pourcentage, pas en francs économisés :
   on choisit une quantité, on ne fait pas un calcul. */

const PALIERS = [
  { n: 5, prix: 500, remise: 0 },
  { n: 12, prix: 1000, remise: 17 },
  { n: 30, prix: 2200, remise: 27 }
];

export function RechargeScreen({ t, etat = "nominal", solde = 4, onOpen, onPayer }) {
  const [choix, setChoix] = React.useState(12);
  const [moyen, setMoyen] = React.useState("mobile");

  if (etat === "attente") {
    return (
      <div style={{
        padding: "0 20px 20px", display: "flex", flexDirection: "column",
        alignItems: "center", textAlign: "center", minHeight: "100%"
      }}>
        <Illustration nom="paiement-attente" largeur={144} style={{ marginTop: 26 }} />
        <h1 className="lehno-display" style={{
          fontSize: 22, letterSpacing: "-.02em", margin: "20px 0 8px", fontWeight: 500, maxWidth: "24ch"
        }}>{t.rechargeAttenteTitre}</h1>
        <p style={{
          margin: 0, fontSize: 14.5, color: "var(--text-secondary)", maxWidth: "30ch", lineHeight: 1.5
        }}>{t.rechargeAttenteTexte}</p>
        {/* Pas d'annulation : une demande poussée sur le téléphone ne se
            rappelle pas depuis l'application. Elle est validée, ou elle
            expire. Fermer l'écran ne l'interrompt donc pas — et l'écran le
            dit, plutôt que de laisser croire le contraire. */}
        <p style={{
          margin: "auto 0 0", fontSize: 12.5, color: "var(--text-mention)",
          textAlign: "center", maxWidth: "30ch"
        }}>{t.rechargeAttenteExpire}</p>
        <Button platform="mobile" full variant="text" style={{ marginTop: 12 }}
          onClick={() => onOpen && onOpen("moi")}>{t.rechargeAttenteFermer}</Button>
      </div>
    );
  }

  if (etat === "abouti") {
    return (
      <div style={{
        padding: "0 20px 20px", display: "flex", flexDirection: "column",
        alignItems: "center", textAlign: "center", minHeight: "100%"
      }}>
        <Illustration nom="paiement-abouti" largeur={144} style={{ marginTop: 26 }} />
        <h1 className="lehno-display" style={{
          fontSize: 22, margin: "20px 0 8px", fontWeight: 500
        }}>{t.rechargeAboutiTitre}</h1>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-secondary)" }}>
          {t.rechargeAboutiTexte(solde + choix)}
        </p>
        <Button platform="mobile" full style={{ marginTop: "auto" }}
          onClick={() => onOpen && onOpen("moi")}>{t.continuer}</Button>
      </div>
    );
  }

  if (etat === "echec") {
    return (
      <div style={{
        padding: "0 20px 20px", display: "flex", flexDirection: "column",
        alignItems: "center", textAlign: "center", minHeight: "100%"
      }}>
        <Illustration nom="paiement-echoue" largeur={144} style={{ marginTop: 26 }} />
        <h1 className="lehno-display" style={{
          fontSize: 22, margin: "20px 0 8px", fontWeight: 500, maxWidth: "24ch"
        }}>{t.rechargeEchecTitre}</h1>
        {/* Ce que l'utilisateur veut savoir d'abord, avant toute explication. */}
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-secondary)" }}>
          {t.rechargeEchecTexte}
        </p>
        <div style={{ width: "100%", display: "grid", gap: 8, marginTop: "auto" }}>
          <Button platform="mobile" full icon="refresh-cw">{t.genReessayer}</Button>
          <Button platform="mobile" full variant="text"
            onClick={() => onOpen && onOpen("moi")}>{t.retour}</Button>
        </div>
      </div>
    );
  }

  const palier = PALIERS.find((p) => p.n === choix) || PALIERS[1];

  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <h1 className="lehno-display" style={{
        fontSize: 22, letterSpacing: "-.02em", margin: "4px 0 4px", fontWeight: 500
      }}>{t.rechargeTitre}</h1>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>{t.rechargeIntro}</p>

      <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
        {PALIERS.map((p) => {
          const actif = p.n === choix;
          return (
            <button key={p.n} type="button" onClick={() => setChoix(p.n)} aria-pressed={actif}
              className="lehno-focusable" style={{
                all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 15px", borderRadius: "var(--radius-lg)",
                border: "1px solid " + (actif ? "var(--action)" : "var(--border-object)"),
                background: actif ? "var(--action-quiet-bg)" : "transparent"
              }}>
              <span className="lehno-display" style={{
                fontSize: 19, fontWeight: 500, color: actif ? "var(--text-accent)" : "var(--text-body)"
              }}>{t.rechargeUnite(p.n)}</span>
              {p.remise ? (
                <span style={{
                  fontFamily: "var(--font-body)", fontSize: 11.5, fontWeight: 600,
                  color: "var(--feedback-success)"
                }}>{t.rechargeEconomie(p.remise)}</span>
              ) : null}
              <span className="lehno-display" style={{
                marginLeft: "auto", fontSize: 17, fontWeight: 500
              }}>{p.prix} F</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.rechargeMoyen}</SectionLabel>
        <div style={{ display: "grid", gap: 8, marginTop: 9 }}>
          {[["mobile", "smartphone", t.rechargeMobile], ["carte", "credit-card", t.rechargeCarte]].map(([k, ic, l]) => {
            const actif = moyen === k;
            return (
              <button key={k} type="button" onClick={() => setMoyen(k)} aria-pressed={actif}
                className="lehno-focusable" style={{
                  all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
                  display: "flex", alignItems: "center", gap: 11,
                  padding: "13px 15px", minHeight: "var(--touch-min)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid " + (actif ? "var(--action)" : "var(--border-object)"),
                  background: actif ? "var(--action-quiet-bg)" : "transparent"
                }}>
                <Icon name={ic} size={17} color={actif ? "var(--text-accent)" : "var(--text-mention)"} />
                <span style={{ fontSize: 14.5, color: actif ? "var(--text-accent)" : "var(--text-body)" }}>{l}</span>
                {actif ? <Icon name="check" size={16} color="var(--text-accent)" style={{ marginLeft: "auto" }} /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 20 }}>
        <CreditIndicator t={t} solde={solde} style={{ marginBottom: 10 }} />
        <Button platform="mobile" full onClick={onPayer}>
          {t.rechargePayer(palier.prix + " F")}
        </Button>
      </div>
    </div>
  );
}
