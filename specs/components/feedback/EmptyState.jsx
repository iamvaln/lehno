import React from "react";
import { Icon } from "../core/Icon.jsx";
import { Button } from "../core/Button.jsx";
import { Illustration } from "../brand/Illustration.jsx";

export function EmptyState({ illustration, icone, titre, texte, action, onAction, style, ...rest }) {
  return (
    <div style={{
      display: "grid", justifyItems: "center", textAlign: "center",
      gap: 0, padding: "18px 24px 14px", fontFamily: "var(--font-body)", ...style
    }} {...rest}>
      {illustration
        ? <Illustration nom={illustration} largeur={112} style={{ marginBottom: 12 }} />
        : icone ? <Icon name={icone} size={28} color="var(--text-accent)" style={{ marginBottom: 16 }} /> : null}
      <h2 className="lehno-display" style={{
        fontSize: 20, fontWeight: 500, margin: 0, letterSpacing: "-.02em", maxWidth: "24ch"
      }}>{titre}</h2>
      {texte ? (
        <p style={{
          margin: "6px 0 0", fontSize: 14, color: "var(--text-secondary)",
          maxWidth: "32ch", lineHeight: 1.5, textWrap: "pretty"
        }}>{texte}</p>
      ) : null}
      {action ? (
        <Button platform="mobile" onClick={onAction} style={{ marginTop: 14 }}>{action}</Button>
      ) : null}
    </div>
  );
}
