import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { Illustration } from "../../components/brand/Illustration.jsx";

/* C'est le premier écran d'un compte qui vient de naître : il appelle la
   personne par son nom. Le solde s'y détaille — cadeau de bienvenue et bonus
   de parrainage sont deux gestes distincts, et l'un des deux se mérite : le
   confondre dans un total efface la raison d'inviter quelqu'un. D'où le second
   bouton.

   « Inviter un ami » doit ouvrir l'écran de parrainage (spec 3.9, phase 4),
   qui n'est pas encore dessiné. En attendant, les deux vues le renvoient vers
   Moi, où vivent les crédits et le Mur. */

function Ligne({ libelle, valeur, accent }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 12, padding: "11px 0",
      borderTop: "1px solid var(--border-hairline)", width: "100%", textAlign: "left"
    }}>
      <span style={{ fontSize: 14.5, color: "var(--text-secondary)", flex: 1 }}>{libelle}</span>
      <span className="lehno-display" style={{
        fontSize: 17, fontWeight: 500,
        color: accent ? "var(--text-accent)" : "var(--text-body)"
      }}>{valeur}</span>
    </div>
  );
}

export function BienvenueScreen({
  t, prenom = "Valentine", cadeau = 5, parrainage = 2, onSuite, onInviter
}) {
  return (
    <div style={{
      padding: "20px", display: "flex", flexDirection: "column",
      alignItems: "center", textAlign: "center", minHeight: "100%"
    }}>
      <Illustration nom="bienvenue-credits" largeur={148} style={{ marginTop: 10 }} />

      <h1 className="lehno-display" style={{
        fontSize: 26, letterSpacing: "-.025em", margin: "18px 0 8px", fontWeight: 500, maxWidth: "22ch"
      }}>{t.bienvenueTitre(prenom)}</h1>
      <p style={{
        margin: 0, fontSize: 15, color: "var(--text-secondary)", maxWidth: "32ch", lineHeight: 1.5
      }}>{t.bienvenueTexte}</p>

      {/* Le détail plutôt qu'un total : deux gestes, deux lignes. */}
      <div style={{ width: "100%", margin: "22px 0 0" }}>
        <Ligne libelle={t.bienvenueCadeau} valeur={t.bienvenueCredits(cadeau)} />
        {parrainage ? (
          <Ligne libelle={t.bienvenueParrainage} valeur={t.bienvenueCredits(parrainage)} accent />
        ) : null}
      </div>

      <div style={{ width: "100%", display: "grid", gap: 8, marginTop: "auto", paddingTop: 24 }}>
        <Button platform="mobile" full onClick={onSuite}>{t.commencer}</Button>
        <Button platform="mobile" full variant="text" icon="user-plus"
          onClick={onInviter}>{t.inviterAmi}</Button>
      </div>
    </div>
  );
}
