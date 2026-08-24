import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";

/* Moi (3.17) — le hub du compte, en sections.

   On y vient rarement : l'écran ne cherche donc pas à être élégant, il cherche
   à être trouvable. Des sections nommées, des lignes qui se ressemblent, aucun
   raccourci décoratif.

   Les gestes de création vivent ailleurs — sur l'accueil, dans Dates, sur une
   fiche. Ce hub ne réunit que ce qui relève de « mon compte » : c'est ce qui
   l'empêche de devenir un second menu. */

function Rang({ libelle, valeur, icone, danger, onOuvrir }) {
  return (
    <button type="button" onClick={onOuvrir} className="lehno-focusable" style={{
      all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
      display: "flex", alignItems: "center", gap: 11, padding: "13px 0",
      minHeight: "var(--touch-min)", borderTop: "1px solid var(--border-hairline)"
    }}>
      {icone ? <Icon name={icone} size={17} color="var(--text-mention)" /> : null}
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

export function MoiScreen({ t, etat = "nominal", solde = 4, base = "../../", onOpen }) {
  const murPublie = etat !== "prive";

  return (
    <div style={{ padding: "0 16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13, margin: "4px 0 22px" }}>
        <Avatar name="Valentine" src={base + "assets/valentine.png"} size={54} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="lehno-display" style={{ fontSize: 21 }}>Valentine</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>lehno.app/valentine</div>
        </div>
      </div>

      {/* Le solde d'abord : c'est ce qu'on vient vérifier le plus souvent. */}
      <SectionLabel>{t.moiCreditsSection}</SectionLabel>
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
      <div style={{ marginTop: 4 }}>
        <Rang libelle={t.parrainageTitre} icone="user-plus"
          onOuvrir={() => onOpen && onOpen("parrainage")} />
        <Rang libelle={t.moiPaiement} icone="credit-card"
          onOuvrir={() => onOpen && onOpen("paiement")} />
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.moiPresence}</SectionLabel>
        <div style={{ marginTop: 4 }}>
          <Rang libelle={t.moiMonMur} icone="globe"
            valeur={murPublie ? undefined : t.moiMurDesactive}
            onOuvrir={() => onOpen && onOpen("monmur")} />
          <Rang libelle={t.moiReservations} icone="bookmark"
            onOuvrir={() => onOpen && onOpen("reservations")} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.moiCompte}</SectionLabel>
        <div style={{ marginTop: 4 }}>
          <Rang libelle={t.moiProfil} icone="user"
            onOuvrir={() => onOpen && onOpen("profil")} />
          <Rang libelle={t.moiReglages} icone="bell"
            onOuvrir={() => onOpen && onOpen("reglages")} />
          <Rang libelle={t.moiLangue} icone="languages"
            valeur={t.langue === "fr" ? "Français" : "English"}
            onOuvrir={() => onOpen && onOpen("profil")} />
          <Rang libelle={t.moiSecurite} icone="shield"
            onOuvrir={() => onOpen && onOpen("securite")} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.moiAide}</SectionLabel>
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
