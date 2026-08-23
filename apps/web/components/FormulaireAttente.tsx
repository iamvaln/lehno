"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Messages } from "../messages";

type Etat = "saisie" | "envoi" | "envoye" | "erreur";

// Avant lancement, la landing ne vend pas une inscription : elle prend une adresse
// et promet un seul message. Le formulaire dit donc ce qu'il fait, et rien de plus.
export function FormulaireAttente({ t }: { t: Messages }): ReactNode {
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState<Etat>("saisie");

  const envoyer = async (evenement: FormEvent<HTMLFormElement>): Promise<void> => {
    evenement.preventDefault();
    setEtat("envoi");
    const base = process.env["NEXT_PUBLIC_API_URL"] ?? "";
    try {
      const reponse = await fetch(`${base}/v1/public/waitlist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, locale: t.langue }),
      });
      setEtat(reponse.ok ? "envoye" : "erreur");
    } catch {
      setEtat("erreur");
    }
  };

  if (etat === "envoye") {
    return (
      <div style={{ background: "var(--panel)", borderRadius: 12, padding: "18px 20px", maxWidth: 440 }}>
        <div className="titre" style={{ fontSize: 19, fontWeight: 500, color: "var(--violet-deep)" }}>{t.merciTitre}</div>
        <div style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>{t.merciSous}</div>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} noValidate={false}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", maxWidth: 440 }}>
        <label className="lecture-seule" htmlFor="courriel">{t.emailLabel}</label>
        <input
          id="courriel"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          style={{
            flex: "1 1 200px", minWidth: 0, fontFamily: "inherit", fontSize: 16,
            color: "var(--text)", background: "var(--card)", border: "1px solid var(--edge)",
            borderRadius: 10, padding: "14px 15px",
          }}
        />
        <button
          type="submit"
          disabled={etat === "envoi"}
          style={{
            fontFamily: "inherit", fontSize: 15, fontWeight: 600, color: "var(--on-violet)",
            background: "var(--violet)", border: "none", borderRadius: 10,
            padding: "12px 20px", cursor: "pointer", flex: "0 0 auto",
          }}
        >
          {t.cta}
        </button>
      </div>
      <div style={{ fontSize: 13, color: "var(--faint)", marginTop: 12 }}>{t.waitlist}</div>
      {etat === "erreur" && (
        <div role="alert" style={{ fontSize: 13, color: "var(--text)", marginTop: 8 }}>{t.waitlistErreur}</div>
      )}
    </form>
  );
}
