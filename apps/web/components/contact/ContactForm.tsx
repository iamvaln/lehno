"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Messages } from "../../messages/index.js";
import { Banner, Button, TextField } from "../ui/index.js";

type Etat = "saisie" | "envoi" | "envoye" | "erreur";

// Les six clés de CONTACT_SUBJECTS (packages/contracts/src/public.ts), dans
// le même ordre que t.contactSujets ci-dessous : c'est cet ordre qui les
// apparie, la clé n'apparaissant jamais à l'écran — seul son libellé traduit
// s'affiche, seule la clé part au serveur.
const SUJET_CLES = [
  "question_app",
  "probleme_technique",
  "credits_paiements",
  "signaler_contenu",
  "demande_donnees",
  "autre",
] as const;

// Même règle qu'en JSX de la maquette (ContactPage.jsx du paquet de
// passation) : une adresse a une arobase, un point après, rien de vide.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Le formulaire de contact. Même motif que FormulaireAttente.tsx : état de
// saisie/envoi/réussite/erreur, champ leurre hors du flux et du clavier,
// instant de rendu posé après hydratation (jamais au rendu serveur, qui
// figerait l'instant pour tout le monde sur une page mise en cache).
export function ContactForm({ t }: { t: Messages }): ReactNode {
  const [etat, setEtat] = useState<Etat>("saisie");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [sujet, setSujet] = useState<string>(SUJET_CLES[0]);
  const [message, setMessage] = useState("");
  const [leurre, setLeurre] = useState("");

  const rendu = useRef<number | null>(null);
  useEffect(() => { rendu.current = Date.now(); }, []);

  const emailInvalide = email.length > 0 && !EMAIL_RE.test(email);
  // >9 caractères une fois les espaces de bord retirés : même seuil que
  // contactSendSchema côté serveur (packages/contracts/src/public.ts).
  const complet = nom.trim().length > 0 && email.length > 0 && !emailInvalide && message.trim().length > 9;

  const envoyer = async (evenement: FormEvent<HTMLFormElement>): Promise<void> => {
    evenement.preventDefault();
    setEtat("envoi");
    const base = process.env["NEXT_PUBLIC_API_URL"] ?? "";
    try {
      const reponse = await fetch(`${base}/v1/public/contact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: nom,
          email,
          subject: sujet,
          message,
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
    return <Banner intent="success">{t.contactConfirme}</Banner>;
  }

  return (
    <form onSubmit={envoyer} style={{ display: "grid", gap: "var(--space-18)" }}>
      <TextField
        label={t.contactLabelNom}
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        autoComplete="name"
        required
      />
      <TextField
        label={t.contactLabelEmail}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        invalid={emailInvalide}
        autoComplete="email"
        required
        {...(emailInvalide ? { hint: t.contactEmailErreur } : {})}
      />

      <div style={{ display: "grid", gap: "var(--space-6)", fontFamily: "var(--font-body)" }}>
        <label htmlFor="contact-sujet" style={{ fontSize: "var(--text-body-xs)", color: "var(--text-secondary)" }}>
          {t.contactLabelSujet}
        </label>
        <select
          id="contact-sujet"
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          style={{
            boxSizing: "border-box", width: "100%", fontFamily: "var(--font-body)",
            fontSize: "var(--text-body-m)", color: "var(--text-body)",
            background: "var(--surface-card)", border: "var(--border-width) solid var(--border-object)",
            borderRadius: "var(--radius-sm)", padding: "var(--space-14) var(--space-16)",
          }}
        >
          {SUJET_CLES.map((cle, index) => (
            <option key={cle} value={cle}>{t.contactSujets[index]}</option>
          ))}
        </select>
      </div>

      <TextField
        label={t.contactLabelMessage}
        multiline
        rows={6}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        hint={t.contactAideMessage}
        required
      />

      <div style={{ display: "flex", gap: "var(--space-14)", alignItems: "center", flexWrap: "wrap" }}>
        <Button type="submit" disabled={!complet || etat === "envoi"}>{t.contactEnvoyer}</Button>
        <span style={{ fontSize: "var(--text-mention-s)", color: "var(--text-mention)" }}>{t.contactDelai}</span>
      </div>

      {/*
        Champ leurre. Hors du flux (position absolue hors écran), hors du
        clavier (tabIndex -1), hors des lecteurs d'écran (aria-hidden) et hors
        du remplissage automatique (autoComplete "off") — voir
        FormulaireAttente.tsx, même motif. Libellé en dur, distinct de celui
        des vrais champs.
      */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="contact-website">Site web</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={leurre}
          onChange={(e) => setLeurre(e.target.value)}
        />
      </div>

      {etat === "erreur" && <Banner intent="error">{t.contactEnvoiErreur}</Banner>}
    </form>
  );
}
