import React from "react";
import { Button } from "../../components/core/Button.jsx";
import { TextField } from "../../components/forms/TextField.jsx";
import { BrandMark } from "../../components/brand/BrandMark.jsx";
import { Wordmark } from "../../components/brand/Wordmark.jsx";
import { Banner } from "../../components/feedback/Banner.jsx";

export function ConnexionScreen({ t, etat = "nominal", base = "../../", onSuite }) {
  return (
    <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ display: "grid", justifyItems: "center", gap: 14, margin: "28px 0 26px" }}>
        <BrandMark base={base} size={58} />
        <Wordmark base={base} variant={t.nuit ? "blanc" : "couleur"} height={24} />
      </div>

      <h1 className="lehno-display" style={{
        fontSize: 24, letterSpacing: "-.02em", margin: "0 0 6px", fontWeight: 500, textAlign: "center"
      }}>{t.connexionTitre}</h1>
      <p style={{
        margin: "0 0 24px", fontSize: 14.5, color: "var(--text-secondary)",
        textAlign: "center", maxWidth: "34ch", marginInline: "auto"
      }}>{t.connexionTexte}</p>

      {etat === "erreur" ? (
        <Banner intent="error" style={{ margin: "0 -20px 18px" }}>{t.connexionErreur}</Banner>
      ) : null}

      <div style={{ display: "grid", gap: 10 }}>
        <Button platform="mobile" full variant="outline" onClick={onSuite}>{t.avecGoogle}</Button>
        <Button platform="mobile" full variant="outline" onClick={onSuite}>{t.avecApple}</Button>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 12, margin: "20px 0",
        color: "var(--text-mention)", fontSize: 12.5
      }}>
        <span style={{ flex: 1, height: 1, background: "var(--border-hairline)" }} />
        {t.ou}
        <span style={{ flex: 1, height: 1, background: "var(--border-hairline)" }} />
      </div>

      <TextField platform="mobile" type="email" label={t.champEmail} placeholder={t.champEmailEx} />
      <Button platform="mobile" full style={{ marginTop: 12 }} onClick={onSuite}>{t.recevoirCode}</Button>

      <p style={{
        marginTop: "auto", paddingTop: 24, fontSize: 12, color: "var(--text-mention)",
        textAlign: "center", lineHeight: 1.5
      }}>
        {t.connexionPiedAvant}
        <a href="#" style={{ color: "var(--text-accent)" }}>{t.connexionPiedCgu}</a>
        {t.connexionPiedEntre}
        <a href="#" style={{ color: "var(--text-accent)" }}>{t.connexionPiedConf}</a>
        {t.connexionPiedApres}
      </p>
    </div>
  );
}
