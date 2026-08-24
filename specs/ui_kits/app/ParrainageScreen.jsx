import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Illustration } from "../../components/brand/Illustration.jsx";

/* Parrainage — la cible que « Inviter un ami » attendait depuis l'écran de
   bienvenue.

   Le code est l'objet de l'écran : il se voit en grand, il se copie d'un geste.
   Le reste tient en une phrase — ce que gagnent les deux personnes. Un
   parrainage qui a besoin d'un paragraphe d'explication n'est pas un cadeau,
   c'est un contrat. */

export function ParrainageScreen({ t, etat = "nominal" }) {
  const filleuls = etat === "vide" ? 0 : 3;

  return (
    <div style={{
      padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%"
    }}>
      <div style={{ display: "grid", justifyItems: "center", marginTop: 8 }}>
        <Illustration nom="bienvenue-credits" largeur={132} />
      </div>

      <h1 className="lehno-display" style={{
        fontSize: 22, letterSpacing: "-.02em", margin: "16px 0 8px", fontWeight: 500,
        textAlign: "center"
      }}>{t.parrainageTitre}</h1>
      <p style={{
        margin: "0 auto", fontSize: 14.5, color: "var(--text-secondary)",
        maxWidth: "32ch", textAlign: "center", lineHeight: 1.5
      }}>{t.parrainageTexte}</p>

      {/* Le code est ce qu'on vient chercher : il se lit de loin. */}
      <Card surface="panel" padding={20} radius="lg" style={{ marginTop: 22, textAlign: "center" }}>
        <div className="lehno-display" style={{
          fontSize: 30, fontWeight: 500, letterSpacing: ".04em", color: "var(--text-accent)"
        }}>{t.parrainageCode}</div>
      </Card>

      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        <Button platform="mobile" full icon="share-2">{t.parrainagePartager}</Button>
        <Button platform="mobile" full variant="outline" icon="copy">{t.collecteCopier}</Button>
      </div>

      <div style={{ marginTop: 26 }}>
        <SectionLabel>{t.langue === "fr" ? "Ce que ça a donné" : "What it brought"}</SectionLabel>
        {filleuls ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginTop: 10,
            paddingTop: 12, borderTop: "1px solid var(--border-hairline)"
          }}>
            <Icon name="users" size={17} color="var(--text-mention)" />
            <span style={{ flex: 1, fontSize: 14.5 }}>{t.parrainageFilleuls(filleuls)}</span>
            <span className="lehno-display" style={{
              fontSize: 17, fontWeight: 500, color: "var(--text-accent)"
            }}>+{filleuls * 2}</span>
          </div>
        ) : (
          <p style={{ margin: "9px 0 0", fontSize: 13.5, color: "var(--text-mention)" }}>
            {t.parrainageAucun}
          </p>
        )}
      </div>
    </div>
  );
}
