import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";

export function PseudoScreen({ t, etat = "nominal", onSuite }) {
  const pris = etat === "erreur";
  return (
    <div style={{ padding: "20px 20px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <h1 className="lehno-display" style={{
        fontSize: 25, letterSpacing: "-.02em", margin: "0 0 8px", fontWeight: 500
      }}>{t.pseudoTitre}</h1>
      {/* Pas de sous-titre : l'aperçu de l'adresse sous le champ montre déjà
          que le pseudo est public, et mieux qu'une phrase ne le dirait. */}
      <div style={{ height: 18 }} />

      <TextField platform="mobile" label={t.champPseudo} defaultValue="valentine"
        invalid={pris} hint={pris ? t.pseudoPris : t.pseudoAdresse} />

      <div style={{ marginTop: 18 }}>
        <TextField platform="mobile" label={t.champParrain} defaultValue="AWA-2K4"
          valide={!pris} invalid={pris}
          hint={pris ? t.parrainInvalide : t.parrainValide} />
      </div>

      {/* Les conditions sont acceptées à la connexion. Les rappeler ici ferait
          signer deux fois pour un seul engagement. */}
      <Button platform="mobile" full style={{ marginTop: "auto" }} onClick={onSuite}>{t.continuer}</Button>
    </div>
  );
}
