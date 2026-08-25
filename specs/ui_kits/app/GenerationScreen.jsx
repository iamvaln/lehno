import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Button } from "../../components/core/Button.jsx";
import { Quote } from "../../components/content/Quote.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";
import { Illustration } from "../../components/brand/Illustration.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";

/* L'attente et le résultat de la génération (3.7), deux moments du même écran.

   L'attente est soignée parce qu'elle dure : elle dit combien de temps, et
   surtout qu'on peut partir. « Vous pouvez fermer : ce sera là à votre retour »
   n'est pas une politesse, c'est la promesse que rien ne se perd — d'où le
   bouton qui invite à faire autre chose, plutôt qu'un sablier qui retient.

   L'échec dit d'abord ce que l'utilisateur veut savoir : son crédit n'a pas
   été prélevé. Le reste est secondaire. */

const IDEES = {
  fr: [
    "Une lettre sur ce que cette amitié a changé cette année",
    "Un après-midi au marché aux vinyles, puis un café",
    "Le moulin à café manuel repéré en mars",
    "Un abonnement de trois mois chez le torréfacteur de Bonapriso",
    "Un week-end de rando aux chutes de la Métché"
  ],
  en: [
    "A letter about what that friendship changed this year",
    "An afternoon at the record market, then a coffee",
    "The hand coffee grinder spotted in March",
    "A three-month subscription at the Bonapriso roaster",
    "A hiking weekend at the Métché falls"
  ]
};

const MESSAGE = {
  fr: "Valery, 36 ans et toujours cette manie de refaire le monde à minuit. Merci pour l'été dernier — je te dois au moins un café correct. Bon anniversaire.",
  en: "Valery, 36 and still that habit of fixing the world at midnight. Thank you for last summer — I owe you at least one decent coffee. Happy birthday."
};

/* Portrait et message sont composés PAR le produit : ils ne peuvent donc porter
   aucun genre. Fragments à verbe initial, nom propre, deuxième personne — et
   l'adresse finale du message reste neutre, « mon vieux » désignait un homme. */
function Attente({ t, onQuitter }) {
  return (
    <div style={{
      padding: "0 20px 20px", display: "flex", flexDirection: "column",
      alignItems: "center", textAlign: "center", minHeight: "100%"
    }}>
      <Illustration nom="generation-en-cours" largeur={150} style={{ marginTop: 30 }} />
      <h1 className="lehno-display" style={{
        fontSize: 23, letterSpacing: "-.02em", margin: "22px 0 8px", fontWeight: 500
      }}>{t.genAttenteTitre}</h1>
      <p style={{
        margin: 0, fontSize: 14.5, color: "var(--text-secondary)", maxWidth: "30ch", lineHeight: 1.5
      }}>{t.genAttenteTexte}</p>

      {/* Une barre qui avance sans promettre de fin : elle occupe l'œil, elle
          ne prétend pas connaître le temps restant. */}
      <div style={{
        width: 148, height: 3, borderRadius: 2, background: "var(--border-object)",
        overflow: "hidden", margin: "24px 0 0"
      }}>
        <div style={{
          width: "40%", height: "100%", background: "var(--action)",
          animation: "lehno-gen 1.6s var(--ease-traverse) infinite"
        }} />
      </div>
      <style>{`@keyframes lehno-gen { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
        @media (prefers-reduced-motion: reduce) { [style*="lehno-gen"] { animation: none !important; } }`}</style>

      {/* Le bouton tient la promesse de l'écran : il ramène à l'accueil, et
          l'écriture continue. On retrouve le travail dans les reprises (3.16) —
          c'est ce qui rend « vous pouvez fermer » vrai plutôt que poli. */}
      <Button platform="mobile" full variant="text" style={{ marginTop: "auto" }}
        onClick={onQuitter}>
        {t.genAttenteQuitter}
      </Button>
    </div>
  );
}

export function GenerationScreen({
  t, etat = "message", qui = "Valery Bah", solde = 3, onEnvoyer, onCopier, onRetour, onOpen
}) {
  /* Les hooks AVANT tout return anticipé : leur nombre ne peut pas dépendre de
     l'état, et le prototype change l'état sur la même instance. */
  const [choisie, setChoisie] = React.useState(null);

  if (etat === "attente") return <Attente t={t} onQuitter={() => onOpen && onOpen("accueil")} />;

  if (etat === "erreur") {
    return (
      <div style={{ padding: "0 16px 18px" }}>
        <Banner intent="error" style={{ margin: "0 -16px 16px" }}>{t.genErreurTexte}</Banner>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center", paddingTop: 10
        }}>
          <Illustration nom="paiement-echoue" largeur={140} />
          <h1 className="lehno-display" style={{
            fontSize: 21, margin: "18px 0 0", fontWeight: 500, maxWidth: "24ch"
          }}>{t.genErreurTitre}</h1>
          <Button platform="mobile" full icon="refresh-cw" style={{ marginTop: 22 }}>
            {t.genReessayer}
          </Button>
        </div>
      </div>
    );
  }

  const langue = t.langue === "fr" ? "fr" : "en";


  if (etat === "idees") {
    return (
      <div style={{ padding: "0 16px 18px" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t.prepPour(qui)}</div>
        <div className="lehno-display" style={{ fontSize: 22, margin: "2px 0 14px" }}>{t.resIdeesTitre}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {IDEES[langue].map((idee, i) => {
            const prise = choisie === i;
            return (
              <div key={idee} style={{
                padding: "13px 14px", borderRadius: "var(--radius-lg)",
                border: "1px solid " + (prise ? "var(--action)" : "var(--border-object)"),
                background: prise ? "var(--action-quiet-bg)" : "transparent"
              }}>
                <div style={{ display: "flex", gap: 11, alignItems: "baseline" }}>
                  <span className="lehno-display" style={{
                    fontSize: 15, color: "var(--text-accent)", minWidth: 14
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 14.5, lineHeight: 1.45 }}>{idee}</span>
                </div>
                <button type="button" onClick={() => setChoisie(prise ? null : i)}
                  className="lehno-focusable" style={{
                    all: "unset", cursor: "pointer", display: "block", marginTop: 9,
                    marginLeft: 25, fontFamily: "var(--font-body)", fontSize: 13,
                    fontWeight: 600, color: prise ? "var(--feedback-success)" : "var(--text-accent)"
                  }}>{prise ? t.ideeChoisie : t.ideeChoisir}</button>
              </div>
            );
          })}
        </div>
        <Provenance origin={t.langue === "fr" ? "écrit à partir de 9 notes sur Valery"
          : "written from 9 notes about Valery"} />
        <div style={{ display: "grid", gap: 8, marginTop: 20 }}>
          <Button platform="mobile" full variant="outline" icon="refresh-cw">{t.resRegenerer}</Button>
        </div>
        <CreditIndicator t={t} depense={1} solde={solde} onRecharger={() => onOpen && onOpen("recharge")} style={{ marginTop: 14 }} />
      </div>
    );
  }

  /* Pas de branche portrait ici : le portrait est une image, et elle vit
     dans PortraitScreen. La génération d'un portrait mène donc là-bas, pas à
     un paragraphe de plus. */

  /* Le message : le seul résultat qui sort de l'application. */
  return (
    <div style={{ padding: "0 16px 18px" }}>
      <div className="lehno-display" style={{ fontSize: 22, marginBottom: 12 }}>{t.resMessageTitre}</div>
      <Card surface="panel" padding={18} radius="lg">
        <Quote size={17}>{MESSAGE[langue]}</Quote>
        <Provenance origin={t.langue === "fr" ? "écrit à partir de 9 notes sur Valery"
          : "written from 9 notes about Valery"} />
      </Card>

      <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
        <Button platform="mobile" full icon="send" onClick={onEnvoyer}>{t.resEnvoyerVia}</Button>
        <Button platform="mobile" full variant="outline" icon="copy" onClick={onCopier}>
          {t.resCopierTexte}
        </Button>
        <Button platform="mobile" full variant="text" icon="pencil">{t.resAjuster}</Button>
        <Button platform="mobile" full variant="text" icon="refresh-cw">{t.resRegenerer}</Button>
      </div>

      <p style={{
        margin: "16px 0 0", fontSize: 12.5, color: "var(--text-mention)", lineHeight: 1.5
      }}>{t.envoiRappel}</p>
      <CreditIndicator t={t} depense={1} solde={solde} onRecharger={() => onOpen && onOpen("recharge")} style={{ marginTop: 10 }} />
    </div>
  );
}
