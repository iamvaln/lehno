import React from "react";
import { Button } from "../core/Button.jsx";
import { SectionLabel } from "../core/SectionLabel.jsx";
import { CreditIndicator } from "../content/CreditIndicator.jsx";

/* Aucune chaîne ici : la feuille est la confirmation de toute action payante,
   donc elle doit parler les deux langues. Elle reçoit « t » et le transmet à
   l'indicateur de crédits, qui en dépend aussi. */
export function PaidActionSheet({
  t, titre, resultat, cout = 1, solde = 0,
  onConfirmer, onRecharger, onAnnuler, style, ...rest
}) {
  const suffisant = solde >= cout;
  return (
    <div role="dialog" aria-modal="true" aria-label={titre} style={{
      background: "var(--surface-card)",
      borderTop: "1px solid var(--border-object)",
      borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0",
      padding: "22px 18px 18px", fontFamily: "var(--font-body)", ...style
    }} {...rest}>
      <div style={{
        width: 44, height: 4, borderRadius: 3, background: "var(--border-object)",
        margin: "-10px auto 16px"
      }} />
      <SectionLabel>{t.feuilleCout}</SectionLabel>
      <h2 className="lehno-display" style={{ fontSize: 21, margin: "8px 0 6px", fontWeight: 500 }}>{titre}</h2>
      <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-secondary)", maxWidth: "40ch" }}>{resultat}</p>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        margin: "18px 0 4px", paddingTop: 14, borderTop: "1px solid var(--border-hairline)"
      }}>
        <span className="lehno-display" style={{ fontSize: 19, fontWeight: 500 }}>
          {t.creditUnite(cout)}
        </span>
        <CreditIndicator t={t} solde={solde} />
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
        {suffisant ? (
          <Button platform="mobile" full onClick={onConfirmer}>{t.feuilleLancer}</Button>
        ) : (
          <Button platform="mobile" full onClick={onRecharger}>{t.feuilleRecharger}</Button>
        )}
        <Button platform="mobile" full variant="text" onClick={onAnnuler}>{t.feuillePasMaintenant}</Button>
      </div>
    </div>
  );
}
