import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { SectionLabel } from "../../components/core/SectionLabel.jsx";
import { Avatar } from "../../components/core/Avatar.jsx";
import { Provenance } from "../../components/content/Provenance.jsx";

/* Modifier l'identité d'un proche (3.18) — depuis la fiche.

   Quatre champs seulement, et l'intro dit pourquoi ils existent : ils orientent
   ce que Lehno écrit. Sans cette phrase, le registre passerait pour un
   classement administratif.

   Le registre est un choix visible, pas une liste déroulante : il n'a que
   quatre valeurs, et c'est le champ qui change le plus le résultat.

   La suppression vit en bas, en rouge de contour et non en rouge plein : elle
   doit être trouvable sans être offerte. */

const REGISTRES = ["registreAmical", "registreFamilial", "registreRespectueux", "registreComplice"];

export function IdentiteScreen({ t, etat = "nominal", onEnregistrer }) {
  const [registre, setRegistre] = React.useState("registreAmical");
  const venueDeCollecte = etat === "collecte";

  return (
    <div style={{ padding: "0 16px 18px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 13, margin: "6px 0 18px" }}>
        <Avatar name="Valery Bah" size={52} />
        <div>
          <div className="lehno-display" style={{ fontSize: 20 }}>{t.identiteTitre}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 1 }}>
            {t.identiteIntro}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <TextField platform="mobile" label={t.champNom} defaultValue="Valery Bah" />
        <TextField platform="mobile" label={t.champLien} defaultValue={t.langue === "fr" ? "Ami" : "Friend"} />
      </div>

      <div style={{ marginTop: 20 }}>
        <SectionLabel>{t.champRegistre}</SectionLabel>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 9 }}>
          {REGISTRES.map((r) => {
            const actif = registre === r;
            return (
              <button key={r} type="button" onClick={() => setRegistre(r)} aria-pressed={actif}
                className="lehno-focusable" style={{
                  fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
                  padding: "8px 14px", minHeight: 38, borderRadius: "var(--radius-pill)",
                  cursor: "pointer",
                  border: "1px solid " + (actif ? "transparent" : "var(--border-object)"),
                  background: actif ? "var(--action)" : "transparent",
                  color: actif ? "var(--text-on-accent)" : "var(--text-secondary)"
                }}>{t[r]}</button>
            );
          })}
        </div>
        <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "var(--text-mention)" }}>
          {t.identiteRegistreAide}
        </p>
      </div>

      {/* Une fiche née d'une collecte garde la trace de qui l'a renseignée :
          l'indice de relation vient du répondant, et reste corrigeable. */}
      {venueDeCollecte ? (
        <Provenance origin={t.langue === "fr" ? "renseigné par Valery" : "filled in by Valery"}
          date={t.langue === "fr" ? "en mars" : "in March"} />
      ) : null}

      <div style={{ marginTop: 20 }}>
        <TextField platform="mobile" label={t.champLangueProche}
          defaultValue={t.langue === "fr" ? "Français" : "English"} />
      </div>

      <Button platform="mobile" full style={{ marginTop: 24 }} onClick={onEnregistrer}>
        {t.enregistrer}
      </Button>

      <div style={{
        marginTop: "auto", paddingTop: 28, borderTop: "1px solid var(--border-hairline)"
      }}>
        <Button platform="mobile" full variant="destructive-outline" icon="trash-2">
          {t.identiteSupprimer}
        </Button>
        <p style={{
          margin: "8px 0 0", fontSize: 12, color: "var(--text-mention)", textAlign: "center"
        }}>{t.identiteSupprimerAide}</p>
      </div>
    </div>
  );
}
