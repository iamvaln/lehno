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

/* Les frais du prestataire, par moyen de paiement : ils s'ajoutent au prix du
   palier et se voient avant que la demande partre. */
const FRAIS = { mobile: (p) => Math.round(p * 0.02 / 25) * 25, carte: (p) => Math.round(p * 0.019) + 100 };

const PALIERS = [
  { n: 5, prix: 500, remise: 0 },
  { n: 12, prix: 1000, remise: 17 },
  { n: 30, prix: 2200, remise: 27 }
];

export function RechargeScreen({
  t, etat = "nominal", solde = 4, mouvements = [], flags = {}, onOpen, onPayer, onFait
}) {
  /* QUATRE DRAPEAUX TOUCHENT CET ÉCRAN, et deux formes en sortent.
     Au lancement, `credits` est ALLUMÉ mais `topup.provider` est éteint : il
     n'y a ni paliers ni moyens de paiement ni attente opérateur, puisque aucun
     opérateur n'encaisse. `credits` éteint donne la même page, pour une autre
     raison — l'achat n'existe plus du tout, et les générations deviennent
     gratuites, donc l'écran ne dit surtout pas « rechargez ».
     Dans les deux cas ce qui reste n'est pas l'écran d'achat amputé mais un
     autre écran : le solde, ses mouvements, et le chemin de `topup.manual` —
     verser sur le compte affiché, puis déposer le reçu. */
  const achat = flags.credits !== false;
  const operateur = flags.topupProvider !== false;
  const manuel = flags.topupManual !== false;

  /* TOUS LES HOOKS AVANT LA PREMIÈRE SORTIE. Les deux formes de cet écran n'ont
     pas les mêmes états, mais React compte les hooks, pas les branches : un
     `useState` placé après un `return` disparaît quand on change de drapeau en
     cours de route, et le rendu suivant casse. */
  const [recuPose, setRecuPose] = React.useState(false);
  const [choix, setChoix] = React.useState(12);
  const [moyen, setMoyen] = React.useState("mobile");
  /* Le récapitulatif est une étape, pas un écran de plus : on y voit le total
     frais compris, et c'est là que la demande part. */
  const [recap, setRecap] = React.useState(etat === "recap");
  React.useEffect(() => { setRecap(etat === "recap"); }, [etat]);

  if (!achat || !operateur) {
    return (
      <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
        <Card padding={16} radius="lg" style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{t.moiSolde}</div>
          <CreditIndicator t={t} solde={solde} variant="solde" style={{ marginTop: 2 }} />
        </Card>

        {manuel ? (
        <div style={{ marginTop: 22 }}>
          <SectionLabel>{t.versementTitre}</SectionLabel>
          <p style={{
            margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)"
          }}>{t.versementTexte}</p>

          <Card surface="panel" padding={15} radius="lg" style={{ marginTop: 11 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{t.versementCompte}</div>
            <div className="lehno-display" style={{
              fontSize: 21, fontWeight: 500, letterSpacing: ".01em", marginTop: 3
            }}>{t.versementNumero}</div>
            <Button platform="mobile" variant="text" icon="copy"
              onClick={() => onFait && onFait(t.versementCopieFait)}
              style={{ marginTop: 6, padding: "8px 0" }}>{t.versementCopier}</Button>
          </Card>

          {recuPose ? (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 9, marginTop: 10,
              padding: "13px 14px", borderRadius: "var(--radius-lg)",
              background: "var(--action-quiet-bg)", fontSize: 13.5, lineHeight: 1.5,
              color: "var(--text-accent)"
            }}>
              <Icon name="check" size={16} strokeWidth={2.4} style={{ marginTop: 2, flex: "none" }} />
              <span>{t.versementRecuFait}</span>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <Button platform="mobile" full icon="receipt"
                onClick={() => { setRecuPose(true); if (onFait) onFait(t.versementRecuFait); }}>
                {t.versementRecu}
              </Button>
              <div style={{
                marginTop: 7, fontSize: 12.5, color: "var(--text-mention)", textAlign: "center"
              }}>{t.versementDelai}</div>
            </div>
          )}
        </div>
        ) : null}

        <div style={{ marginTop: 24 }}>
          <SectionLabel>{t.mouvementsTitre}</SectionLabel>
          {mouvements.length ? (
            <div style={{ marginTop: 4 }}>
              {mouvements.map((m, i) => (
                <div key={m.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 0",
                  minHeight: "var(--touch-min)", boxSizing: "border-box",
                  borderTop: i ? "1px solid var(--border-hairline)" : "none"
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: "block", fontSize: 14.5, whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis"
                    }}>{m.quoi}</span>
                    <span style={{ fontSize: 12.5, color: "var(--text-mention)" }}>{m.quand}</span>
                  </span>
                  <span className="lehno-display" style={{
                    flex: "none", fontSize: 16, fontWeight: 500,
                    color: m.delta > 0 ? "var(--feedback-success)" : "var(--text-secondary)"
                  }}>{(m.delta > 0 ? "+" : "") + m.delta}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-mention)" }}>
              {t.mouvementsAucun}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (etat === "attente") {
    return (
      <div style={{
        padding: "0 20px 20px", display: "flex", flexDirection: "column",
        alignItems: "center", textAlign: "center", minHeight: "100%"
      }}>
        <Illustration nom="paiement-attente" largeur={92} style={{ marginTop: 8 }} />

        {/* Le disque tourne tant que la validation n'est pas revenue : une à deux
            minutes sans rien qui bouge se lit comme un écran figé. */}
        <div style={{
          display: "flex", alignItems: "center", gap: 9, marginTop: 12,
          color: "var(--text-accent)"
        }}>
          <span className="lehno-tourne" style={{
            width: 15, height: 15, borderRadius: "50%", flex: "none",
            border: "2px solid currentColor", borderTopColor: "transparent"
          }} />
          <span style={{
            fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600,
            letterSpacing: ".08em", textTransform: "uppercase"
          }}>{t.rechargeAttenteEnCours}</span>
        </div>

        <h1 className="lehno-display" style={{
          fontSize: 21, letterSpacing: "-.02em", margin: "8px 0 6px", fontWeight: 500, maxWidth: "24ch"
        }}>{t.rechargeAttenteTitre}</h1>
        <p style={{
          margin: 0, fontSize: 14.5, color: "var(--text-secondary)", maxWidth: "30ch", lineHeight: 1.5
        }}>{t.rechargeAttenteTexte}</p>

        {/* La sortie de secours : le code de l'opérateur, quand la demande ne
            s'affiche pas d'elle-même. */}
        <Card surface="panel" padding={14} radius="lg" style={{ width: "100%", marginTop: 14 }}>
          <div style={{
            fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-secondary)",
            textAlign: "left"
          }}>{t.rechargeAttenteSecours}</div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {[["Orange Money", "#150*50#"], ["MTN MoMo", "*126#"]].map(([op, code]) => (
              <div key={op} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12
              }}>
                <span style={{ fontSize: 13.5 }}>{op}</span>
                <span className="lehno-display" style={{
                  fontSize: 17, fontWeight: 500, letterSpacing: ".04em", color: "var(--text-accent)"
                }}>{code}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Pas d'annulation : une demande poussée sur le téléphone ne se
            rappelle pas depuis l'application. Elle est validée, ou elle
            expire. Fermer l'écran ne l'interrompt donc pas — et l'écran le
            dit, plutôt que de laisser croire le contraire. */}
        <p style={{
          margin: "auto 0 0", paddingTop: 10, fontSize: 12.5, color: "var(--text-mention)",
          textAlign: "center", maxWidth: "30ch"
        }}>{t.rechargeAttenteExpire}</p>
        <Button platform="mobile" full variant="text" style={{ marginTop: 8 }}
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
          {t.rechargeAboutiTexte(solde)}
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
          <Button platform="mobile" full icon="refresh-cw"
          onClick={() => onPayer && onPayer()}>{t.genReessayer}</Button>
          <Button platform="mobile" full variant="text"
            onClick={() => onOpen && onOpen("moi")}>{t.retour}</Button>
        </div>
      </div>
    );
  }

  const palier = PALIERS.find((p) => p.n === choix) || PALIERS[1];
  const frais = FRAIS[moyen](palier.prix);
  const total = palier.prix + frais;

  if (recap) {
    const lignes = [
      [t.rechargeRecapCredits, t.rechargeUnite(palier.n)],
      [t.rechargeRecapMontant, palier.prix + " F"],
      [moyen === "mobile" ? t.rechargeMobile : t.rechargeCarte, t.rechargeRecapFrais(frais + " F")]
    ];
    return (
      <div style={{
        padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%"
      }}>
        <h1 className="lehno-display" style={{
          fontSize: 22, letterSpacing: "-.02em", margin: "4px 0 14px", fontWeight: 500
        }}>{t.rechargeRecapTitre}</h1>

        <Card surface="panel" padding={18} radius="lg">
          {lignes.map(([l, v], i) => (
            <div key={l} style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              gap: 12, padding: "10px 0",
              borderTop: i ? "1px solid var(--border-hairline)" : "none"
            }}>
              <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{l}</span>
              <span style={{ fontSize: 14.5 }}>{v}</span>
            </div>
          ))}
          <div style={{
            display: "flex", alignItems: "baseline", justifyContent: "space-between",
            gap: 12, marginTop: 6, paddingTop: 12, borderTop: "1px solid var(--border-object)"
          }}>
            <span className="lehno-display" style={{ fontSize: 16, fontWeight: 500 }}>{t.rechargeRecapTotal}</span>
            <span className="lehno-display" style={{
              fontSize: 22, fontWeight: 500, color: "var(--text-accent)"
            }}>{total} F</span>
          </div>
        </Card>

        <div style={{ marginTop: "auto", paddingTop: 14, display: "grid", gap: 6 }}>
          <Button platform="mobile" full onClick={onPayer}>{t.rechargePayer(total + " F")}</Button>
          <Button platform="mobile" full variant="text"
            onClick={() => setRecap(false)}>{t.rechargeRecapModifier}</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <h1 className="lehno-display" style={{
        fontSize: 22, letterSpacing: "-.02em", margin: "4px 0 4px", fontWeight: 500
      }}>{t.rechargeTitre}</h1>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>{t.rechargeIntro}</p>

      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
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

      <div style={{ marginTop: 14 }}>
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

      <div style={{ marginTop: "auto", paddingTop: 14 }}>
        <CreditIndicator t={t} solde={solde} style={{ marginBottom: 10 }} />
        <Button platform="mobile" full onClick={() => setRecap(true)}>{t.continuer}</Button>
      </div>
    </div>
  );
}
