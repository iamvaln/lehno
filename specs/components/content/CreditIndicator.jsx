import React from "react";
import { Icon } from "../core/Icon.jsx";

/* Aucune chaîne ici : les règles de pluriel diffèrent d'une langue à l'autre
   — le zéro prend le singulier en français, le pluriel en anglais — donc les
   phrases viennent du dictionnaire par « t ». */
export function CreditIndicator({ t, solde, cout, depense, variant = "inline", onRecharger, style, ...rest }) {
  /* Un solde à zéro se signale de lui-même : sans coût annoncé à côté, la
     comparaison n'a rien à comparer, et la mention resterait grise au moment
     où elle compte le plus. */
  const insuffisant = solde != null && (solde === 0 || (cout != null && solde < cout));

  if (variant === "solde") {
    return (
      <div style={{
        display: "inline-flex", alignItems: "baseline", gap: 6,
        fontFamily: "var(--font-display)", fontVariationSettings: "var(--font-display-settings)",
        ...style
      }} {...rest}>
        <span style={{ fontSize: 34, fontWeight: 400, lineHeight: 1, letterSpacing: "-.03em" }}>{solde}</span>
        <span style={{
          fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text-secondary)"
        }}>{t.creditMot(solde)}</span>
      </div>
    );
  }

  /* L'unité se répète des deux côtés : « il vous en reste 3 » seul ne dit pas
     de quoi. Et « dépensé » remplace « coût » une fois l'action passée — le
     coût annonce, la dépense constate. */
  const parts = [];
  if (depense != null) parts.push(t.creditDepense(depense));
  else if (cout != null) parts.push(t.creditUnite(cout));
  if (solde != null) parts.push(t.creditReste(solde));

  const corps = (
    <>
      <Icon name="coins" size={14} strokeWidth={2} />
      <span>{parts.join(" · ")}</span>
    </>
  );

  const base = {
    display: "inline-flex", alignItems: "center", gap: 6,
    fontFamily: "var(--font-body)", fontSize: 12.5,
    color: insuffisant ? "var(--feedback-warning)" : "var(--text-mention)",
    ...style
  };

  /* Quand le solde ne suffit plus, la mention devient le chemin vers la
     recharge : un constat sans issue ferait chercher ailleurs. */
  if (onRecharger) {
    return (
      <button type="button" onClick={onRecharger} className="lehno-focusable" style={{
        all: "unset", cursor: "pointer", ...base,
        minHeight: "var(--touch-min)", marginTop: -6, marginBottom: -6,
        textDecoration: "underline", textUnderlineOffset: 2,
        textDecorationColor: insuffisant ? "var(--feedback-warning)" : "var(--border-object)"
      }} {...rest}>
        {corps}
      </button>
    );
  }

  return <div style={base} {...rest}>{corps}</div>;
}
