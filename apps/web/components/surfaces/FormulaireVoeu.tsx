"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Messages } from "../../messages/index.js";
import { Banner, Button } from "../ui/index.js";
import { codeDuRefus } from "../../lib/refus.js";

type Etat = "saisie" | "envoi" | "erreur" | "ferme";

/**
 * Écrire un mot en trente secondes, debout, sur son téléphone.
 *
 * **Le champ de message EST la page** : une carte qu'on écrit, la signature en
 * pied du même bloc. Pas de libellé au-dessus, pas d'aide sous le champ — un
 * formulaire à étiquettes ralentit précisément le geste qu'on veut rapide. Les
 * libellés restent posés pour les lecteurs d'écran (`aria-label`, `<label>`),
 * mais l'œil n'a qu'une chose à faire : écrire.
 *
 * Pour le reste, même motif que `ContactForm` : champ leurre hors du flux et du
 * clavier, instant de rendu posé **après hydratation** — jamais au rendu
 * serveur, qui figerait l'instant pour tout le monde sur une page mise en cache.
 */
export function FormulaireVoeu(
  { t, jeton, onEnvoye }: { t: Messages; jeton: string; onEnvoye: () => void },
): ReactNode {
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
      if (reponse.ok) { onEnvoye(); return; }
      /* La fenêtre a pu se refermer entre le chargement et l'envoi. Ce refus-là
         n'est pas une panne : le dire comme une erreur réseau ferait réessayer
         indéfiniment quelqu'un qui n'a plus rien à réessayer.
         On le reconnaît à son CODE, pas à son statut : `wish_window_closed`
         n'a pas d'entrée dans la table de `common/errors.ts` et tombe donc sur
         le 422 des règles métier — pas sur le 403 qu'on lui prêterait. */
      setEtat(await codeDuRefus(reponse) === "wish_window_closed" ? "ferme" : "erreur");
    } catch {
      setEtat("erreur");
    }
  };

  return (
    <form onSubmit={envoyer}>
      <div
        style={{
          background: "var(--surface-card)",
          border: "var(--border-width) solid var(--border-object)",
          borderRadius: "var(--radius-2xl)",
          padding: "var(--space-6) var(--space-6) 0",
          overflow: "hidden",
        }}
      >
        <textarea
          aria-label={t.voeuxLabelMessage}
          placeholder={t.voeuxPlaceholderMessage}
          rows={9}
          maxLength={2000}
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          required
          style={{
            display: "block", width: "100%", boxSizing: "border-box", border: "none",
            background: "transparent", resize: "vertical",
            fontFamily: "var(--font-body)", fontSize: "var(--text-body-m)",
            lineHeight: "var(--leading-body)", color: "var(--text-body)",
            padding: "var(--space-16) var(--space-16) var(--space-8)", outlineOffset: 2,
          }}
        />
        {/* La signature vit dans le pied du billet, séparée par un filet : on
            signe après avoir écrit, pas avant. */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: "var(--space-10)", flexWrap: "wrap",
            borderTop: "var(--border-width) solid var(--border-hairline)",
            margin: "0 calc(-1 * var(--space-6))",
            padding: "var(--space-10) var(--space-22) var(--space-12)",
          }}
        >
          <label htmlFor="voeu-signature" style={{ fontSize: "var(--text-mention-m)", color: "var(--text-mention)" }}>
            {t.voeuxLabelSignature}
          </label>
          <input
            id="voeu-signature"
            placeholder={t.voeuxPlaceholderSignature}
            maxLength={80}
            autoComplete="name"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            /* Les remises à zéro sont NOMMÉES, jamais `all: unset`.
               `all: unset` est une déclaration en ligne pour *toutes* les
               propriétés, y compris `outline` — elle bat donc la règle
               `:focus-visible` de la feuille de styles, et le champ perd son
               anneau au clavier sans que rien ne le signale. */
            style={{
              flex: "1 1 160px", minWidth: 0, boxSizing: "border-box",
              border: "none", background: "transparent", margin: 0,
              fontFamily: "var(--font-body)", fontSize: "var(--text-body-s)",
              color: "var(--text-body)", padding: "var(--space-6) 0",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex", gap: "var(--space-14)", alignItems: "center",
          flexWrap: "wrap", marginTop: "var(--space-18)",
        }}
      >
        <Button type="submit" disabled={!complet || etat === "envoi"}>{t.voeuxEnvoyer}</Button>
        <span
          style={{
            fontSize: "var(--text-mention-s)", color: "var(--text-mention)",
            flex: "1 1 200px", textWrap: "pretty",
          }}
        >
          {t.voeuxMention}
        </span>
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
