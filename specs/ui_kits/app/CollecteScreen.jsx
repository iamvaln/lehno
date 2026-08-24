import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Illustration } from "../../components/brand/Illustration.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";

/* Partage d'un lien de collecte (3.20) — depuis la fiche d'un proche.

   L'écran a un seul geste : envoyer le lien. Tout le reste — l'adresse en
   clair, le décompte des réponses, la révocation — est là pour qu'on sache
   ce qu'on a mis dans le monde et qu'on puisse le reprendre.

   L'intro dit la seule chose qui compte pour décider : ce qui revient ne
   s'enregistre pas tout seul. C'est ce qui rend le partage sans risque. */

export function CollecteScreen({ t, etat = "nominal", reponses = 2, onOpen }) {
  const revoque = etat === "revoque";

  return (
    <div style={{ padding: "0 16px 18px" }}>
      <div style={{ display: "grid", justifyItems: "center", marginTop: 6 }}>
        <Illustration nom="contribution-envoyee" largeur={132} />
      </div>

      <h1 className="lehno-display" style={{
        fontSize: 22, letterSpacing: "-.02em", margin: "16px 0 8px", fontWeight: 500
      }}>{t.collecteTitre}</h1>
      <p style={{
        margin: 0, fontSize: 14.5, color: "var(--text-secondary)", maxWidth: "38ch", lineHeight: 1.5
      }}>{t.collecteIntro}</p>

      {revoque ? (
        <Banner intent="info" style={{ margin: "16px -16px 0" }}>{t.collecteRevoqueTexte}</Banner>
      ) : null}

      <Card padding={15} radius="lg" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="link" size={16} color="var(--text-mention)" />
          <span style={{
            flex: 1, minWidth: 0, fontSize: 14.5,
            textDecoration: revoque ? "line-through" : "none",
            color: revoque ? "var(--text-mention)" : "var(--text-body)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>{t.collecteLien}</span>
          <span style={{
            fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600,
            letterSpacing: ".08em", textTransform: "uppercase", whiteSpace: "nowrap",
            color: revoque ? "var(--text-mention)" : "var(--feedback-success)"
          }}>{revoque ? t.collecteEtatRevoque : t.collecteEtatActif}</span>
        </div>
      </Card>

      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {revoque ? (
          <Button platform="mobile" full icon="link">{t.collecteReactiver}</Button>
        ) : (
          <>
            <Button platform="mobile" full icon="share-2">{t.collectePartager}</Button>
            <Button platform="mobile" full variant="outline" icon="copy">{t.collecteCopier}</Button>
          </>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>{t.langue === "fr" ? "Ce qui est revenu" : "What came back"}</SectionLabel>
        {reponses && !revoque ? (
          <button type="button" onClick={() => onOpen && onOpen("valider")}
            className="lehno-focusable" style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
              display: "flex", alignItems: "center", gap: 10, marginTop: 8,
              padding: "13px 0", minHeight: "var(--touch-min)",
              borderTop: "1px solid var(--border-hairline)"
            }}>
            <span style={{ flex: 1, fontSize: 14.5 }}>{t.collecteRecu(reponses)}</span>
            <Icon name="chevron-right" size={15} color="var(--text-mention)" />
          </button>
        ) : (
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-mention)" }}>
            {t.collecteAucune}
          </p>
        )}
      </div>

      {revoque ? null : (
        <Button platform="mobile" full variant="text" style={{ marginTop: 20 }}>
          {t.collecteRevoquer}
        </Button>
      )}
    </div>
  );
}
