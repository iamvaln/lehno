import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";

/* Réglages (3.28) — ce qui me concerne.

   On y vient rarement : l'écran ne cherche pas à être élégant, il cherche à être
   trouvable. Des sections nommées, des lignes qui se ressemblent, aucun raccourci
   décoratif. Le solde vient en tête parce que c'est ce qu'on ouvre le plus souvent
   — le reste se consulte deux fois par an. */

function Rang({ libelle, valeur, icone, danger, onOuvrir }) {
  return (
    <button type="button" onClick={onOuvrir} className="lehno-focusable" style={{
      all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
      display: "flex", alignItems: "center", gap: 11, padding: "13px 0",
      minHeight: "var(--touch-min)", borderTop: "1px solid var(--border-hairline)"
    }}>
      {icone ? <Icon name={icone} size={17} color={danger ? "var(--feedback-error)" : "var(--text-mention)"} /> : null}
      <span style={{
        flex: 1, fontSize: 14.5,
        color: danger ? "var(--feedback-error)" : "var(--text-body)"
      }}>{libelle}</span>
      {valeur ? (
        <span style={{ fontSize: 13, color: "var(--text-mention)" }}>{valeur}</span>
      ) : null}
      {danger ? null : <Icon name="chevron-right" size={15} color="var(--text-mention)" />}
    </button>
  );
}

export function ReglagesHubScreen({
  t, solde = 4, base = "../../", flags = {}, onOpen, onLangue
}) {
  /* QUAND « MOI » DISPARAÎT, SON IDENTITÉ ATTERRIT ICI. Les cinq sections de
     l'onglet Moi sont toutes gouvernées par un drapeau ; toutes éteintes,
     l'onglet ne mènerait qu'à du vide — pire qu'un onglet absent. Il sort donc
     de la barre, et ce qui n'était pas gouverné par un drapeau (mon nom, mon
     adresse publique, l'accès au profil) remonte en tête des Réglages, où l'on
     va déjà chercher ce qui nous concerne. */
  const moiAbsent = flags.moi === false;
  const parrainage = flags.referral !== false;
  const methodes = flags.topupProvider !== false;

  return (
    <div style={{ padding: "0 16px 18px" }}>
      {moiAbsent ? (
        <button type="button" onClick={() => onOpen && onOpen("profil")}
          className="lehno-focusable" style={{
            all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
            display: "flex", alignItems: "center", gap: 13, margin: "6px 0 22px",
            minHeight: "var(--touch-min)"
          }}>
          <Avatar name="Valentine" src={base + "assets/valentine.png"} size={52} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="lehno-display" style={{ fontSize: 20, display: "block" }}>Valentine</span>
            <span style={{ display: "block", fontSize: 13, color: "var(--text-secondary)" }}>
              lehno.app/valentine
            </span>
          </span>
          <Icon name="chevron-right" size={16} color="var(--text-mention)" />
        </button>
      ) : null}

      <SectionLabel style={{ marginTop: moiAbsent ? 0 : 6 }}>{t.reglagesArgent}</SectionLabel>
      <Card padding={15} radius="lg" style={{ marginTop: 9 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{t.moiSolde}</div>
            <CreditIndicator t={t} solde={solde} variant="solde" style={{ marginTop: 2 }} />
          </div>
          <Button platform="mobile" onClick={() => onOpen && onOpen("recharge")}
            style={{ minHeight: 40, padding: "9px 18px" }}>{t.moiRecharger}</Button>
        </div>
      </Card>
      {/* Les renvois éteints disparaissent : pas d'écran de méthodes de
          paiement quand l'achat n'existe pas, pas de page d'invitation quand
          le parrainage est fermé. */}
      {parrainage || methodes ? (
        <div style={{ marginTop: 4 }}>
          {parrainage ? (
            <Rang libelle={t.parrainageTitre} icone="user-plus"
              onOuvrir={() => onOpen && onOpen("parrainage")} />
          ) : null}
          {methodes ? (
            <Rang libelle={t.moiPaiement} icone="credit-card"
              onOuvrir={() => onOpen && onOpen("paiement")} />
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.reglagesCompte}</SectionLabel>
        <div style={{ marginTop: 4 }}>
          <Rang libelle={t.moiProfil} icone="user"
            onOuvrir={() => onOpen && onOpen("profil")} />
          <div style={{
            display: "flex", alignItems: "center", gap: 11, padding: "9px 0",
            minHeight: "var(--touch-min)", borderTop: "1px solid var(--border-hairline)"
          }}>
            <Icon name="languages" size={17} color="var(--text-mention)" />
            <span style={{ flex: 1, fontSize: 14.5 }}>{t.moiLangue}</span>
            <div style={{
              display: "inline-flex", borderRadius: "var(--radius-pill)",
              border: "1px solid var(--border-object)", overflow: "hidden", flex: "none"
            }}>
              {[["fr", "Français"], ["en", "English"]].map(([k, l]) => {
                const actif = t.langue === k;
                return (
                  <button key={k} type="button" aria-pressed={actif}
                    onClick={() => onLangue && onLangue(k)} className="lehno-focusable"
                    style={{
                      all: "unset", cursor: "pointer", padding: "9px 13px", minHeight: 38,
                      boxSizing: "border-box", fontFamily: "var(--font-body)", fontSize: 13,
                      fontWeight: 600,
                      background: actif ? "var(--action)" : "transparent",
                      color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                    }}>{l}</button>
                );
              })}
            </div>
          </div>
          <Rang libelle={t.moiSecurite} icone="shield"
            onOuvrir={() => onOpen && onOpen("securite")} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.reglagesAlertes}</SectionLabel>
        <div style={{ marginTop: 4 }}>
          <Rang libelle={t.moiRappels} icone="bell"
            onOuvrir={() => onOpen && onOpen("rappels")} />
          <Rang libelle={t.moiDonnees} icone="database" valeur={t.moiDonneesValeur}
            onOuvrir={() => onOpen && onOpen("donnees")} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.reglagesAide}</SectionLabel>
        <div style={{ marginTop: 4 }}>
          <Rang libelle={t.moiAideCentre} icone="circle-help"
            onOuvrir={() => onOpen && onOpen("aide")} />
          <Rang libelle={t.moiDeconnexion} icone="log-out" danger
            onOuvrir={() => onOpen && onOpen("connexion")} />
        </div>
      </div>
    </div>
  );
}
