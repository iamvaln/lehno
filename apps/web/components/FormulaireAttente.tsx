"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Messages } from "../messages/index.js";
import { Banner, Button, Card, TextField } from "./ui/index.js";

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
      <Card surface="panel" radius="lg" style={{ maxWidth: 440 }}>
        <div className="titre" style={{ fontSize: "var(--text-display-xs)", fontWeight: "var(--font-display-medium)", color: "var(--text-accent)" }}>
          {t.merciTitre}
        </div>
        <div style={{ fontSize: "var(--text-body-s)", color: "var(--text-secondary)", marginTop: "var(--space-4)" }}>{t.merciSous}</div>
      </Card>
    );
  }

  return (
    <form onSubmit={envoyer} noValidate={false}>
      <div style={{ display: "flex", gap: "var(--space-10)", flexWrap: "wrap", maxWidth: 460, alignItems: "flex-start" }}>
        <label className="lecture-seule" htmlFor="courriel">{t.emailLabel}</label>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <TextField
            id="courriel"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
          />
        </div>
        <Button type="submit" disabled={etat === "envoi"} style={{ minHeight: 50 }}>
          {t.cta}
        </Button>
      </div>
      <div style={{ fontSize: "var(--text-mention-s)", color: "var(--text-mention)", marginTop: "var(--space-12)" }}>{t.waitlist}</div>
      {etat === "erreur" && (
        <div style={{ marginTop: "var(--space-8)" }}>
          <Banner intent="error">{t.waitlistErreur}</Banner>
        </div>
      )}
    </form>
  );
}
