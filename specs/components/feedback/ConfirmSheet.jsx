import React from "react";
import { Button } from "../core/Button.jsx";

/** Demande d'un geste conséquent, montée en feuille : un titre qui pose la
 *  question, une phrase qui dit ce que le geste emporte, l'accord et le refus.
 *  Aucune chaîne ici — la feuille sert les deux langues.
 *
 *  Elle se monte au niveau de l'appareil (`PhoneFrame feuille=…`), pas dans
 *  l'écran : une feuille modale voile aussi l'en-tête, sinon le retour reste
 *  cliquable pendant la question. */
export function ConfirmSheet({
  titre, texte, confirmer, annuler, destructif = false, onConfirmer, onAnnuler
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label={titre} style={{
      background: "var(--surface-card)",
      borderTop: "1px solid var(--border-object)",
      borderRadius: "var(--radius-2xl) var(--radius-2xl) 0 0",
      padding: "22px 18px 18px", fontFamily: "var(--font-body)"
    }}>
      <div style={{
        width: 44, height: 4, borderRadius: 3, background: "var(--border-object)",
        margin: "-10px auto 16px"
      }} />
      <h2 className="lehno-display" style={{
        fontSize: 21, margin: "0 0 8px", fontWeight: 500
      }}>{titre}</h2>
      <p style={{
        margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "var(--text-secondary)"
      }}>{texte}</p>
      <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
        <Button platform="mobile" full onClick={onConfirmer}
          variant={destructif ? "destructive" : "primary"}
          icon={destructif ? "trash-2" : undefined}>{confirmer}</Button>
        <Button platform="mobile" full variant="text" onClick={onAnnuler}>{annuler}</Button>
      </div>
    </div>
  );
}
