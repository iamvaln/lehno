import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { CreditIndicator } from "../../components/content/CreditIndicator.jsx";

/* Cadrage des idées cadeaux (3.7) — l'écran qui précède la recherche.

   Deux champs, tous deux facultatifs, et c'est le point : on peut lancer sans
   rien dire. Mais un budget change tout ce qui suit, et un détail que les notes
   ignorent — « cadeau commun avec Awa » — évite une liste hors sujet. Les
   demander après aurait coûté un second crédit.

   Le budget est libre, par paliers proposés : une fourchette imposée obligerait
   à choisir une tranche qui ne correspond à rien. */

const PALIERS = ["5 000 F", "15 000 F", "30 000 F"];

export function CadrageIdeesScreen({ t, etat = "nominal", solde = 4, onLancer, onOpen }) {
  const [budget, setBudget] = React.useState("");
  const insuffisant = etat === "solde";
  const dispo = insuffisant ? 0 : solde;

  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <h1 className="lehno-display" style={{
        fontSize: 21, letterSpacing: "-.02em", margin: "4px 0 18px", fontWeight: 500
      }}>{t.cadrageTitre}</h1>

      <TextField platform="mobile" label={t.cadrageBudget} value={budget}
        onChange={(e) => setBudget(e.target.value)} hint={t.cadrageBudgetAide} />

      {/* Des paliers, pas une fourchette imposée : ils remplissent le champ,
          qui reste libre. */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
        {PALIERS.map((p) => (
          <button key={p} type="button" onClick={() => setBudget(p)} aria-pressed={budget === p}
            className="lehno-focusable" style={{
              fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
              padding: "8px 14px", minHeight: 38, borderRadius: "var(--radius-pill)",
              cursor: "pointer",
              border: "1px solid " + (budget === p ? "transparent" : "var(--border-object)"),
              background: budget === p ? "var(--action)" : "transparent",
              color: budget === p ? "var(--text-on-accent)" : "var(--text-secondary)"
            }}>{p}</button>
        ))}
      </div>

      <div style={{ marginTop: 22 }}>
        <TextField platform="mobile" multiline rows={3} label={t.cadrageNote}
          placeholder={t.cadrageNotePlaceholder} />
      </div>

      <div style={{ marginTop: "auto", paddingTop: 24 }}>
        <CreditIndicator t={t} cout={1} solde={dispo}
          onRecharger={() => onOpen && onOpen("recharge")} style={{ marginBottom: 10 }} />
        <Button platform="mobile" full onClick={() => onLancer && onLancer("idees")}>
          {t.cadrageLancer}
        </Button>
      </div>
    </div>
  );
}
