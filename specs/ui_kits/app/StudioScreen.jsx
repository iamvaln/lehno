import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";
import { AMBIANCES, FAMILLES } from "../../components/brand/PortraitComposition.jsx";

/* Le studio du portrait (spec §2) — ce que l'utilisateur règle avant de lancer.
 *
 * L'ORIENTATION EST LE PREMIER CHOIX, et la spec dit pourquoi : elle commande le
 * texte comme l'illustration. Douze orientations, mais elles ne se valent pas en
 * fréquence — les plus courantes viennent d'abord, et l'écran reste franchissable
 * en quelques gestes puisque chaque choix a un défaut.
 *
 * L'HOMMAGE EST À PART. Le choisir change le gabarit : abricot neutralisé,
 * palette froide, aucune illustration vive. L'écran le dit au moment du choix,
 * pas après la génération — c'est la seule orientation qui mérite un
 * avertissement, et l'y noyer parmi onze autres serait la traiter comme un
 * réglage de plus.
 *
 * LES CHAMPS SUIVENT LA VOIE. Choisir « aucune image » retire la famille, le
 * style et le texte libre : un écran qui garde des réglages sans effet apprend
 * qu'il ne faut pas lire ses réglages.
 *
 * LE TEXTE LIBRE n'est pas conservé, et l'écran le dit là où on le remplit. La
 * photo est transmise à un service tiers, et l'écran le dit au dépôt — pas dans
 * une politique de confidentialité que personne n'ouvre.
 */

const ORIENTATIONS = [
  "orRelation", "orCaractere", "orGratitude", "orFierte", "orAffection",
  "orTesProgres", "orNosProgres", "orAppris", "orVoeu", "orMotivation",
  "orSoutien", "orHommage"
];

/* Les clés viennent du composant — « FAMILLES » y est exporté. Ici seulement
   leurs libellés : deux listes des mêmes clés auraient fini par diverger. */
const LIBELLES_FAMILLE = {
  nature: ["famNature", "famNatureAide"],
  animal: ["famAnimal", "famAnimalAide"],
  abstrait: ["famAbstrait", "famAbstraitAide"]
};

const STYLES = [
  ["lumiere", "stylLumiere", "stylLumiereAide"],
  ["serigraphie", "stylSerigraphie", "stylSerigraphieAide"],
  ["silhouette", "stylSilhouette", "stylSilhouetteAide"]
];

function Pastilles({ options, valeur, onSet, t }) {
  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
      {options.map((k) => {
        const actif = valeur === k;
        return (
          <button key={k} type="button" onClick={() => onSet(k)} aria-pressed={actif}
            className="lehno-focusable" style={{
              all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center",
              minHeight: 38, padding: "0 14px", borderRadius: "var(--radius-pill)",
              fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
              border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
              background: actif ? "var(--action)" : "transparent",
              color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
            }}>{t[k]}</button>
        );
      })}
    </div>
  );
}

/* Les familles et les styles portent une description : leurs noms seuls ne
   disent pas ce qu'on obtient. */
function Cartes({ options, valeur, onSet, t }) {
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 9 }}>
      {options.map(([k, nom, aide]) => {
        const actif = valeur === k;
        return (
          <button key={k} type="button" onClick={() => onSet(k)} aria-pressed={actif}
            className="lehno-focusable" style={{
              all: "unset", boxSizing: "border-box", cursor: "pointer", width: "100%",
              minHeight: "var(--touch-min)", padding: "12px 14px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid " + (actif ? "var(--action)" : "var(--border-object)"),
              background: actif ? "var(--action-quiet-bg)" : "transparent"
            }}>
            <span style={{
              display: "block", fontFamily: "var(--font-body)", fontSize: 14.5,
              fontWeight: 600, color: actif ? "var(--text-accent)" : "var(--text-body)"
            }}>{t[nom]}</span>
            <span style={{
              display: "block", fontSize: 12.5, color: "var(--text-secondary)", marginTop: 2
            }}>{t[aide]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function StudioScreen({ t, etat = "nominal", solde = 4, onLancer, onOpen }) {
  const [orientation, setOrientation] = React.useState("orRelation");
  const [voie, setVoie] = React.useState("illustration");
  const [famille, setFamille] = React.useState("nature");
  const [stylePhoto, setStylePhoto] = React.useState("silhouette");
  const [ambiance, setAmbiance] = React.useState("papier");
  const insuffisant = etat === "solde";
  const dispo = insuffisant ? 0 : solde;
  const hommage = orientation === "orHommage";

  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <h1 className="lehno-display" style={{
        fontSize: 21, letterSpacing: "-.02em", margin: "4px 0 0", fontWeight: 500
      }}>{t.studioTitre}</h1>

      <div style={{ marginTop: 18 }}>
        <SectionLabel>{t.studioOrientation}</SectionLabel>
        <Pastilles options={ORIENTATIONS} valeur={orientation} onSet={setOrientation} t={t} />
      </div>

      {/* L'hommage change le gabarit : l'écran le dit au choix, pas après. */}
      {hommage ? (
        <Banner intent="info" style={{ margin: "14px -16px 0" }}>{t.hommageAvis}</Banner>
      ) : null}

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.studioImage}</SectionLabel>
        <Pastilles
          options={["voieIllustration", "voiePhoto", "voieAucune"]}
          valeur={"voie" + voie.charAt(0).toUpperCase() + voie.slice(1)}
          onSet={(k) => setVoie(k.replace("voie", "").toLowerCase())}
          t={t} />
      </div>

      {/* Les champs suivent la voie : aucun réglage sans effet à l'écran. */}
      {voie === "illustration" ? (
        <>
          <div style={{ marginTop: 22 }}>
            <SectionLabel>{t.studioFamille}</SectionLabel>
            <Cartes options={FAMILLES.map((k) => [k, ...LIBELLES_FAMILLE[k]])}
              valeur={famille} onSet={setFamille} t={t} />
          </div>
          <div style={{ marginTop: 20 }}>
            <TextField platform="mobile" multiline rows={3} label={t.studioLibre}
              placeholder={t.studioLibrePlaceholder} hint={t.studioLibreAide} />
          </div>
        </>
      ) : null}

      {voie === "photo" ? (
        <>
          <div style={{ marginTop: 22 }}>
            <SectionLabel>{t.studioStyle}</SectionLabel>
            <Cartes options={STYLES} valeur={stylePhoto} onSet={setStylePhoto} t={t} />
          </div>
          {/* Dit au dépôt, pas dans une politique que personne n'ouvre. */}
          <Banner intent="info" style={{ margin: "14px -16px 0" }}>{t.studioPhotoAvis}</Banner>
        </>
      ) : null}

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.studioAmbiance}</SectionLabel>
        <Pastilles
          options={Object.keys(AMBIANCES)}
          valeur={ambiance} onSet={setAmbiance}
          t={Object.keys(AMBIANCES).reduce((o, k) => ({ ...o, [k]: AMBIANCES[k].nom }), {})} />
      </div>

      <div style={{ marginTop: 20 }}>
        <TextField platform="mobile" label={t.studioNote} defaultValue={t.studioNoteDefaut} />
      </div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <CreditIndicator t={t} cout={1} solde={dispo}
          onRecharger={() => onOpen && onOpen("recharge")} style={{ marginBottom: 10 }} />
        <Button platform="mobile" full onClick={() => onLancer && onLancer("portrait")}>
          {t.studioLancer}
        </Button>
      </div>
    </div>
  );
}
