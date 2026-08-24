"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Messages } from "../messages/index.js";
import { Banner, Button, Card, TextField } from "./ui/index.js";

type Etat = "saisie" | "envoi" | "envoye" | "erreur";

// Avant lancement, la landing ne vend pas une inscription : elle prend une adresse
// et promet un seul message. Le formulaire dit donc ce qu'il fait, et rien de plus.
export function FormulaireAttente({ t }: { t: Messages }): ReactNode {
  const [email, setEmail] = useState("");
  const [etat, setEtat] = useState<Etat>("saisie");
  const [leurre, setLeurre] = useState("");

  // L'instant du rendu, posé côté client après l'hydratation : le serveur
  // écarte ce qui arrive plus vite qu'on ne tape. Il n'est pas posé au rendu
  // serveur — une page mise en cache figerait l'instant pour tout le monde, et
  // la page l'est (revalidate 300).
  const rendu = useRef<number | null>(null);
  useEffect(() => { rendu.current = Date.now(); }, []);

  const envoyer = async (evenement: FormEvent<HTMLFormElement>): Promise<void> => {
    evenement.preventDefault();
    setEtat("envoi");
    const base = process.env["NEXT_PUBLIC_API_URL"] ?? "";
    try {
      const reponse = await fetch(`${base}/v1/public/waitlist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          locale: t.langue,
          website: leurre,
          ...(rendu.current === null ? {} : { renderedAt: rendu.current }),
        }),
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
      {/*
        Champ leurre. Hors du flux, hors du clavier (tabIndex -1), hors des
        lecteurs d'écran (aria-hidden) et hors du remplissage automatique du
        navigateur (autoComplete "off") : une personne ne le voit pas, ne
        l'atteint pas et ne l'entend pas. Un robot qui remplit tous les champs
        le remplit aussi, et se désigne.

        « lecture-seule » n'irait pas : cette classe cache à l'œil mais laisse
        au lecteur d'écran, ce qui ferait annoncer un champ fantôme.
      */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        {/*
          Libellé en dur, distinct de celui du vrai champ : le bloc est
          aria-hidden, donc rien ne l'annonce jamais — mais deux champs
          portant le même libellé rendraient le formulaire ambigu pour qui
          l'interroge par son libellé, tests compris.
        */}
        <label htmlFor="website">Site web</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={leurre}
          onChange={(e) => setLeurre(e.target.value)}
        />
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
