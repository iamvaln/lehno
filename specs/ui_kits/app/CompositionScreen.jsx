import React from "react";
import { Card } from "../../components/core/Card.jsx";
import { Button } from "../../components/core/Button.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Tag } from "../../components/core/Tag.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";

/* Composition du portrait (3.7, étape 2) — l'écran qui manquait.

   Sans lui, « régénérer » ne veut rien dire : on relance à l'identique. Ici on
   choisit ce qui entre dans le portrait — la plage de notes, le ton, la
   longueur — et c'est ce choix qui rend un second crédit justifiable.

   Les mots-clés ne se règlent pas : ils montrent ce sur quoi l'écriture
   s'appuie. Leur nombre change avec la plage retenue, ce qui rend le réglage
   lisible sans l'expliquer. */

const MOTS = {
  fr: {
    tout: ["vinyles", "rando", "café de spécialité", "minuit", "sans alcool", "moulin à café", "été dernier", "concerts", "marché"],
    an: ["vinyles", "café de spécialité", "moulin à café", "été dernier", "concerts"],
    occasion: ["moulin à café", "café de spécialité"]
  },
  en: {
    tout: ["records", "hiking", "specialty coffee", "midnight", "no alcohol", "coffee grinder", "last summer", "gigs", "the market"],
    an: ["records", "specialty coffee", "coffee grinder", "last summer", "gigs"],
    occasion: ["coffee grinder", "specialty coffee"]
  }
};

const NOTES = { tout: 9, an: 5, occasion: 2 };

export function CompositionScreen({ t, etat = "nominal", solde = 4, onLancer, onOpen }) {
  const langue = t.langue === "fr" ? "fr" : "en";
  const [plage, setPlage] = React.useState("tout");
  const [ton, setTon] = React.useState("registreAmical");
  const [longueur, setLongueur] = React.useState("compoMoyen");
  const insuffisant = etat === "solde";
  const dispo = insuffisant ? 0 : solde;

  const Choix = ({ options, valeur, onSet }) => (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
      {options.map(([k, l]) => {
        const actif = valeur === k;
        return (
          <button key={k} type="button" onClick={() => onSet(k)} aria-pressed={actif}
            className="lehno-focusable" style={{
              fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
              padding: "8px 14px", minHeight: 38, borderRadius: "var(--radius-pill)",
              cursor: "pointer",
              border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
              background: actif ? "var(--action)" : "transparent",
              color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
            }}>{l}</button>
        );
      })}
    </div>
  );

  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <h1 className="lehno-display" style={{
        fontSize: 21, letterSpacing: "-.02em", margin: "4px 0 0", fontWeight: 500
      }}>{t.compoTitre}</h1>

      {/* Les mots-clés se regardent, ils ne se règlent pas : leur nombre suit
          la plage choisie, ce qui montre l'effet du réglage sans le décrire. */}
      <div style={{ marginTop: 18 }}>
        <SectionLabel>{t.compoMots}</SectionLabel>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
          {MOTS[langue][plage].map((m) => (
            <Tag key={m} style={{ fontSize: 12.5, padding: "4px 10px" }}>{m}</Tag>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.compoPlage}</SectionLabel>
        <Choix valeur={plage} onSet={setPlage} options={[
          ["tout", t.compoPlageTout], ["an", t.compoPlageAn], ["occasion", t.compoPlageOccasion]
        ]} />
        <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "var(--text-mention)" }}>
          {t.compoPlageAide(NOTES[plage])}
        </p>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.compoTon}</SectionLabel>
        <Choix valeur={ton} onSet={setTon} options={[
          ["registreAmical", t.registreAmical], ["registreFamilial", t.registreFamilial],
          ["registreRespectueux", t.registreRespectueux], ["registreComplice", t.registreComplice]
        ]} />
        <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "var(--text-mention)" }}>
          {t.compoTonAide}
        </p>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionLabel>{t.compoLongueur}</SectionLabel>
        <Choix valeur={longueur} onSet={setLongueur} options={[
          ["compoCourt", t.compoCourt], ["compoMoyen", t.compoMoyen], ["compoLong", t.compoLong]
        ]} />
      </div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <CreditIndicator t={t} cout={1} solde={dispo}
          onRecharger={() => onOpen && onOpen("recharge")} style={{ marginBottom: 10 }} />
        <Button platform="mobile" full onClick={() => onLancer && onLancer("portrait")}>
          {t.compoLancer}
        </Button>
      </div>
    </div>
  );
}
