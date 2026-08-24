import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Button } from "../../components/core/Button.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";
import { SensitiveBanner } from "../../components/feedback/SensitiveBanner.jsx";
import { OfflineBanner } from "../../components/feedback/OfflineBanner.jsx";

/* L'écran de préparation (3.7) n'est pas un résultat : c'est le choix de ce
   qu'on veut faire écrire. Il vient de la carte imminente de l'accueil, et il
   ouvre trois chemins payants — portrait, idées, message.

   Le coût s'affiche sur chaque ligne, AVANT de lancer : c'est la règle de la
   spec, et c'est aussi ce qui évite qu'on découvre la dépense après coup. Ce
   qui a déjà été préparé ne se relance pas par défaut — on le consulte, et
   refaire est un geste explicite qui redit son prix. */

function Piste({ titre, texte, cout, solde, fait, onLancer, onVoir, onRecharger, t, desactive }) {
  return (
    <Card padding={15} radius="lg" style={{ marginBottom: 10, opacity: desactive ? 0.45 : 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="lehno-display" style={{ fontSize: 18 }}>{titre}</div>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-secondary)" }}>{texte}</p>
        </div>
        {fait ? (
          <span style={{
            fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600,
            letterSpacing: ".08em", textTransform: "uppercase",
            color: "var(--feedback-success)", whiteSpace: "nowrap"
          }}>{t.prepDeja}</span>
        ) : null}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginTop: 12,
        paddingTop: 12, borderTop: "1px solid var(--border-hairline)"
      }}>
        <CreditIndicator t={t} cout={cout} style={{ flex: 1 }} />
        {fait ? (
          <>
            <Button platform="mobile" variant="text" onClick={onLancer} disabled={desactive}
              style={{ minHeight: 40, padding: "9px 12px" }}>{t.prepRelancer}</Button>
            <Button platform="mobile" variant="outline" onClick={onVoir}
              style={{ minHeight: 40, padding: "9px 16px" }}>{t.prepVoir}</Button>
          </>
        ) : (
          <Button platform="mobile" onClick={onLancer} disabled={desactive}
            style={{ minHeight: 40, padding: "9px 18px" }}>{t.preparer}</Button>
        )}
      </div>
    </Card>
  );
}

export function PreparationScreen({
  t, etat = "nominal", qui = "Valery", quoi, solde = 4,
  onLancer, onVoir, onOpen
}) {
  const sensible = etat === "sensible";
  const horsligne = etat === "horsligne";
  const insuffisant = etat === "solde";
  const dispo = insuffisant ? 0 : solde;

  return (
    <div style={{ padding: "0 16px 18px" }}>
      {horsligne ? <OfflineBanner texte={t.horsConnexion} style={{ margin: "0 -16px 14px" }} /> : null}

      {/* Pas de titre ici : l'en-tête porte déjà « Pour Valery ». Pas de
          sur-titre non plus — les trois cartes disent ce qu'elles sont. Reste
          la date, qui situe, et la seule phrase qui apprenne quelque chose :
          rien ne part sans vous. */}
      <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
        {quoi || (t.langue === "fr" ? "Anniversaire · 24 août" : "Birthday · 24 Aug")}
      </div>

      {sensible ? (
        <SensitiveBanner texte={t.prepSensible} style={{ margin: "14px -16px 0" }} />
      ) : (
        <p style={{
          margin: "10px 0 0", fontSize: 13.5, color: "var(--text-mention)", maxWidth: "38ch"
        }}>{t.prepIntro}</p>
      )}

      <div style={{ marginTop: 18 }}>
        {/* Pas de portrait ici. Le brief sépare deux temps : le portrait
            appartient au proche et se compose depuis sa fiche, à tout moment ;
            la préparation d'une occasion ne propose que ce qui se périme avec
            la date — les idées et le message. */}
        {/* Une date sensible ne propose pas de cadeau : la spec l'impose, et
            c'est la seule ligne qui disparaît selon la nature de l'événement. */}
        {sensible ? null : (
          <Piste t={t} titre={t.prepIdeesTitre} texte={t.prepIdeesTexte}
            cout={1} solde={dispo} desactive={horsligne} onRecharger={() => onOpen && onOpen("moi")}
            onLancer={() => onLancer && onLancer("idees")} onVoir={() => onVoir && onVoir("idees")} />
        )}

        <Piste t={t} titre={t.prepMessageTitre} texte={t.prepMessageTexte}
          cout={1} solde={dispo} fait onRecharger={() => onOpen && onOpen("moi")} onLancer={() => onLancer && onLancer("message")}
          onVoir={() => onVoir && onVoir("message")} desactive={horsligne} />
      </div>

      {/* Le solde une seule fois, en pied : trois lignes qui répètent le même
          chiffre le transforment en bruit. Le coût, lui, reste sur chaque
          ligne — c'est là qu'on décide. */}
      <CreditIndicator t={t} solde={dispo} onRecharger={() => onOpen && onOpen("recharge")}
        style={{ marginTop: 16 }} />
    </div>
  );
}
