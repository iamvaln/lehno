"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Messages } from "../../messages/index.js";
import { Banner, Button, TextField } from "../ui/index.js";

type Etat = "saisie" | "envoi" | "envoye" | "erreur" | "ferme";

/**
 * Le formulaire de dépôt d'un mot.
 *
 * Même motif que `ContactForm` et `FormulaireAttente` : état de
 * saisie/envoi/réussite/erreur, champ leurre hors du flux et du clavier,
 * instant de rendu posé **après hydratation** — jamais au rendu serveur, qui
 * figerait l'instant pour tout le monde sur une page mise en cache.
 *
 * Une seule chose lui est propre : **la fenêtre peut se refermer entre le
 * chargement et l'envoi.** Le serveur refuse alors par `wish_window_closed`, et
 * ce refus-là n'est pas une panne — le dire comme une erreur réseau
 * ferait réessayer indéfiniment quelqu'un qui n'a plus rien à réessayer.
 */
export function FormulaireVoeu({ t, jeton }: { t: Messages; jeton: string }): ReactNode {
  const [etat, setEtat] = useState<Etat>("saisie");
  const [contenu, setContenu] = useState("");
  const [signature, setSignature] = useState("");
  const [leurre, setLeurre] = useState("");

  const rendu = useRef<number | null>(null);
  useEffect(() => { rendu.current = Date.now(); }, []);

  // Même seuil que submitWishSchema : un mot non vide, une fois les espaces de
  // bord retirés.
  const complet = contenu.trim().length > 0;

  const envoyer = async (evenement: FormEvent<HTMLFormElement>): Promise<void> => {
    evenement.preventDefault();
    setEtat("envoi");
    const base = process.env["NEXT_PUBLIC_API_URL"] ?? "";
    try {
      const reponse = await fetch(`${base}/v1/public/wishes/${encodeURIComponent(jeton)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: contenu,
          ...(signature.trim() === "" ? {} : { authorName: signature }),
          website: leurre,
          ...(rendu.current === null ? {} : { renderedAt: rendu.current }),
        }),
      });
      if (reponse.ok) { setEtat("envoye"); return; }
      // 403 est le refus de fenêtre : la seule réponse que le visiteur peut
      // comprendre sans qu'on lui parle de réseau.
      setEtat(reponse.status === 403 ? "ferme" : "erreur");
    } catch {
      setEtat("erreur");
    }
  };

  /* Le mot envoyé, le formulaire DISPARAÎT. Le laisser rempli inviterait à
     renvoyer le même mot ; le laisser vide effacerait ce qu'on vient d'écrire
     sous les yeux de son auteur. */
  if (etat === "envoye") return <Banner intent="success">{t.voeuxConfirme}</Banner>;

  return (
    <form onSubmit={envoyer} style={{ display: "grid", gap: "var(--space-18)" }}>
      <TextField
        label={t.voeuxLabelMessage}
        multiline
        rows={6}
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        hint={t.voeuxAideMessage}
        maxLength={2000}
        required
      />
      <TextField
        label={t.voeuxLabelSignature}
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
        hint={t.voeuxAideSignature}
        maxLength={80}
        autoComplete="name"
      />

      <div>
        <Button type="submit" disabled={!complet || etat === "envoi"}>{t.voeuxEnvoyer}</Button>
      </div>

      {/*
        Champ leurre. Hors du flux, hors du clavier, hors des lecteurs d'écran
        et hors du remplissage automatique — même motif que ContactForm.
      */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="voeu-website">Site web</label>
        <input
          id="voeu-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={leurre}
          onChange={(e) => setLeurre(e.target.value)}
        />
      </div>

      {etat === "erreur" && <Banner intent="error">{t.voeuxErreur}</Banner>}
      {etat === "ferme" && <Banner intent="warning">{t.voeuxFermeErreur}</Banner>}
    </form>
  );
}
