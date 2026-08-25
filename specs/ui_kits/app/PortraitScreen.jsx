import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Icon } from "../../components/core/Icon.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";
import { PortraitComposition, AMBIANCES } from "../../components/brand/PortraitComposition.jsx";
import { EmptyState } from "../../components/feedback/EmptyState.jsx";

/* Aperçu et partage d'un portrait (3.22).

   Le portrait est une IMAGE, pas un texte : une composition qu'on enregistre et
   qu'on envoie comme telle. C'est ce qui change tout le bas de l'écran — on ne
   partage pas une adresse, on partage un fichier. « Retirer du web » n'a donc
   plus lieu d'être ; ce qui se retire, c'est la publication sur son Mur.

   Le fond est un motif de marque : c'est exactement l'usage prévu pour eux —
   les supports hors application, dont les images de partage. Dans l'écran,
   l'interface reste en aplats ; le motif vit dans l'image.

   La date et la plage de notes accompagnent l'image : sans elles, deux
   portraits de la même personne sont indistinguables dans sa collection. */

export function PortraitScreen({ t, etat = "nominal", qui = "Valery Bah", base = "../../", onOpen }) {
  const [avecNote, setAvecNote] = React.useState(true);
  const [voie, setVoie] = React.useState("illustration");
  const [ambiance, setAmbiance] = React.useState(t.nuit ? "encre" : "papier");
  const aValider = etat === "avalider";
  const surLeMur = etat === "partage";

  if (etat === "vide") {
    return (
      <div style={{ padding: "8px 16px 18px" }}>
        <EmptyState illustration="portrait-aucun"
          titre={t.portraitAucunTitre} texte={t.portraitAucunTexte} />
      </div>
    );
  }

  const plage = t.langue === "fr" ? "tout l'historique · 9 notes" : "everything · 9 notes";

  return (
    <div style={{ padding: "0 16px 18px" }}>
      {aValider ? (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10,
          fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600,
          letterSpacing: ".08em", textTransform: "uppercase",
          color: "var(--feedback-warning)"
        }}>
          <Icon name="eye" size={13} strokeWidth={2} /> {t.portraitAValider}
        </div>
      ) : null}

      {/* L'image telle qu'elle partira. Un seul tracé dans le projet : celui du
          design system, éprouvé sur les bornes du contenu (8 à 20 mots, nom de
          3 à 20 caractères) et sur les trois formats. */}
      <PortraitComposition
        nom={qui.split(" ")[0]}
        message={t.portraitMessage}
        note={avecNote ? t.portraitNote : undefined}
        photo="../../assets/valentine.png"
        ambiance={ambiance}
        voie={voie}
        format="carre"
        base="../../"
      />

      {/* La voie et l'ambiance sont des choix de l'utilisateur, pas des
          réglages de développement : le brief les nomme ainsi. */}
      <div style={{ marginTop: 16 }}>
        <SectionLabel>{t.portraitVoie}</SectionLabel>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
          {[["illustration", t.portraitVoieIllustration], ["photo", t.portraitVoiePhoto],
            ["aucune", t.portraitVoieAucune]].map(([k, l]) => {
            const actif = voie === k;
            return (
              <button key={k} type="button" onClick={() => setVoie(k)} aria-pressed={actif}
                className="lehno-focusable" style={{
                  all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                  minHeight: 36, padding: "0 13px", borderRadius: "var(--radius-pill)",
                  fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                  border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
                  background: actif ? "var(--action)" : "transparent",
                  color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                }}>{l}</button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <SectionLabel>{t.portraitAmbiance}</SectionLabel>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
          {["papier", "lilas", "encre"].map((k) => {
            const actif = ambiance === k;
            return (
              <button key={k} type="button" onClick={() => setAmbiance(k)} aria-pressed={actif}
                className="lehno-focusable" style={{
                  all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
                  minHeight: 36, padding: "0 13px", borderRadius: "var(--radius-pill)",
                  fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                  border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
                  background: actif ? "var(--action)" : "transparent",
                  color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                }}>{AMBIANCES[k].nom}</button>
            );
          })}
        </div>
      </div>

      <Provenance origin={t.portraitPlage(plage)}
        date={t.langue === "fr" ? "22 août" : "22 Aug"} />

      {/* On partage un fichier, pas une adresse : enregistrer d'abord, puis
          les deux destinations. */}
      <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
        {aValider ? (
          <>
            <Button platform="mobile" full icon="check">{t.portraitApprouver}</Button>
            <Button platform="mobile" full variant="outline" icon="refresh-cw"
              onClick={() => onOpen && onOpen("studio")}>{t.resRegenerer}</Button>
            <Button platform="mobile" full variant="text">{t.resJeter}</Button>
          </>
        ) : (
          <>
            <Button platform="mobile" full icon="download">{t.portraitEnregistrer}</Button>
            <Button platform="mobile" full variant="outline" icon="share-2">{t.portraitPartagerDehors}</Button>
            <Button platform="mobile" full variant="text" icon={surLeMur ? "eye-off" : "globe"}
              onClick={() => onOpen && onOpen("monmur")}>
              {surLeMur ? t.portraitRetirerDuMur : t.portraitSurMonMur}
            </Button>
          </>
        )}
      </div>

      {/* Pas de mention « Sur votre Mur » : le bouton dit déjà « Retirer de
          mon Mur », donc l'état se lit dans l'action. */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12, marginTop: 22,
        paddingTop: 16, borderTop: "1px solid var(--border-hairline)"
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5 }}>{t.portraitSignature}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-mention)", marginTop: 2 }}>
            {t.portraitSignatureAide}
          </div>
        </div>
        <button type="button" role="switch" aria-checked={avecNote}
          onClick={() => setAvecNote((v) => !v)} className="lehno-focusable"
          aria-label={t.portraitSignature} style={{
            all: "unset", cursor: "pointer", flex: "none", width: 44, height: 26,
            borderRadius: 999, padding: 3, boxSizing: "border-box",
            background: avecNote ? "var(--action)" : "var(--border-object)",
            transition: "background var(--transition-state)"
          }}>
          <span style={{
            display: "block", width: 20, height: 20, borderRadius: "50%",
            background: "var(--surface-page)",
            transform: avecNote ? "translateX(18px)" : "translateX(0)",
            transition: "transform var(--transition-state)"
          }} />
        </button>
      </div>
    </div>
  );
}
