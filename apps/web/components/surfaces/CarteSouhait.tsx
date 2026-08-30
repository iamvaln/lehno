"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PublicWish } from "@lehno/contracts";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { formaterMontant } from "../../lib/montants.js";
import { Banner, Button, Tag, TextField } from "../ui/index.js";
import { codeDuRefus } from "../../lib/refus.js";
import { jetonDeVisite } from "../../lib/jeton-visite.js";

type Etape = null | "coordonnees" | "code";
type Panne = null | "generale" | "code" | "pris" | "annulation";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Un souhait — la brique de la liste.
 *
 * **Un souhait n'est pas un titre.** L'intitulé, les précisions, le prix, le
 * lien : la carte les montre dans l'ordre où l'on décide — *qu'est-ce que
 * c'est, est-ce que je peux, où je l'achète.*
 *
 * **Ce qui n'apparaît jamais : qui a réservé.** Un souhait réservé se dit
 * réservé, et rien de plus — sauf au visiteur qui revient avec son jeton et
 * retrouve les siens. Rien n'est barré non plus : un cadeau pris n'est pas une
 * erreur.
 *
 * L'anonymat se dit **une fois**, en pied de liste, pas sur chaque carte :
 * répété quatre fois, un rappel devient du bruit.
 *
 * Le lien s'affiche **en clair** — le domaine — pour qu'on voie où l'on va
 * avant de cliquer, et il s'ouvre en isolation (§9.7).
 */
export function CarteSouhait(
  { t, langue, souhait, reservable, onReserve, onAnnule }: {
    t: Messages; langue: Langue; souhait: PublicWish;
    /** Faux quand l'occasion est passée : la liste s'affiche, sans accepter de
     *  réservation. C'est le SERVEUR qui tranche — le client ne compare pas la
     *  date lui-même, deux versions du parc et deux fuseaux donneraient deux
     *  réponses. */
    reservable: boolean;
    /** Appelé une fois la réservation confirmée, avec le jeton de visite : la
     *  liste s'en sert pour redemander l'état et retrouver les siens. */
    onReserve: (jetonDeVisite: string) => void;
    /** Appelé une fois le cadeau rendu à la liste. */
    onAnnule: () => void;
  },
): ReactNode {
  const [etape, setEtape] = useState<Etape>(null);
  const [panne, setPanne] = useState<Panne>(null);
  const [attente, setAttente] = useState(false);
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [connu, setConnu] = useState(false);
  const [code, setCode] = useState("");
  const [leurre, setLeurre] = useState("");

  const rendu = useRef<number | null>(null);
  useEffect(() => { rendu.current = Date.now(); }, []);

  const base = process.env["NEXT_PUBLIC_API_URL"] ?? "";
  const emailValide = EMAIL_RE.test(email.trim());

  const demander = async (): Promise<void> => {
    setAttente(true);
    setPanne(null);
    try {
      const reponse = await fetch(`${base}/v1/public/owner-wishes/${souhait.id}/reserve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          // Le nom ne part QUE si le visiteur s'est nommé : le retenir sans lui
          // serait garder une donnée dont on s'est engagé à ne rien faire.
          ...(connu && nom.trim() !== "" ? { displayName: nom.trim(), showIdentity: true } : {}),
          locale: langue,
          website: leurre,
          ...(rendu.current === null ? {} : { renderedAt: rendu.current }),
        }),
      });
      /* `conflict` — quelqu'un a été plus rapide. Reconnu à son code, comme
         partout : c'est le contrat, et lui seul, qui dit ce qui s'est passé. */
      if (!reponse.ok) {
        setPanne(await codeDuRefus(reponse) === "conflict" ? "pris" : "generale");
        return;
      }

      const issue = await reponse.json() as
        | { state: "code_sent" }
        | { state: "confirmed"; sessionToken: string };
      /* `confirmed` n'arrive qu'à un visiteur déjà connecté, dont l'adresse est
         vérifiée par son compte : il réserve en un geste, et il n'y a pas de
         code à demander. */
      if (issue.state === "confirmed") { onReserve(issue.sessionToken); return; }
      setEtape("code");
    } catch {
      setPanne("generale");
    } finally {
      setAttente(false);
    }
  };

  const confirmer = async (): Promise<void> => {
    setAttente(true);
    setPanne(null);
    try {
      const reponse = await fetch(`${base}/v1/public/owner-wishes/${souhait.id}/reserve/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // L'adresse ACCOMPAGNE le code : c'est elle qui fait l'identité. Sans
        // elle, un code à six chiffres se rejouerait contre toutes les demandes
        // en attente sur ce cadeau.
        body: JSON.stringify({ email: email.trim(), code }),
      });
      if (!reponse.ok) { setPanne("code"); return; }
      const { sessionToken } = await reponse.json() as { sessionToken: string };
      onReserve(sessionToken);
    } catch {
      setPanne("generale");
    } finally {
      setAttente(false);
    }
  };

  /* Le lien d'annulation n'est offert QUE sur ce qu'on a soi-même réservé
     (`reservedByMe`), et le serveur revérifie l'identité de son côté : la page
     ne décide de rien, elle propose ce que le serveur accepterait. */
  const annuler = async (): Promise<void> => {
    setAttente(true);
    setPanne(null);
    try {
      const visite = jetonDeVisite();
      const reponse = await fetch(`${base}/v1/public/owner-wishes/${souhait.id}/reserve`, {
        method: "DELETE",
        ...(visite === null ? {} : { headers: { "x-lehno-reservation": visite } }),
      });
      if (!reponse.ok) { setPanne("annulation"); return; }
      onAnnule();
    } catch {
      setPanne("annulation");
    } finally {
      setAttente(false);
    }
  };

  const domaine = (url: string): string => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  };

  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "var(--border-width) solid var(--border-object)",
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-16)",
        // Un souhait offert s'éteint, il ne se barre pas.
        opacity: souhait.isFulfilled ? 0.62 : 1,
      }}
    >
      <div style={{ display: "flex", gap: "var(--space-14)", alignItems: "flex-start" }}>
        {/* Sans photo, ça reste un objet : pas de cadre gris ni d'icône
            d'appareil photo. Le vide ne se signale pas, il se compose. */}
        {souhait.imageUrl ? (
          <img
            src={souhait.imageUrl}
            alt=""
            style={{
              width: 68, height: 68, flex: "none", objectFit: "cover",
              borderRadius: "var(--radius-md)", background: "var(--surface-panel)",
            }}
          />
        ) : null}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: "var(--space-10)", alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontWeight: "var(--font-body-semibold)" }}>{souhait.label}</span>
            {/* Le prix informe, il ne classe pas : texte secondaire, jamais un
                tri ni une mise en avant. */}
            {souhait.price !== null && souhait.currency !== null ? (
              <span
                className="titre"
                style={{
                  fontWeight: "var(--font-display-medium)",
                  fontSize: "var(--text-body-s)",
                  color: "var(--text-accent)", whiteSpace: "nowrap",
                }}
              >
                {formaterMontant(souhait.price, souhait.currency, langue)}
              </span>
            ) : null}
          </div>

          {souhait.details ? (
            <p style={{ margin: "var(--space-6) 0 0", color: "var(--text-secondary)", textWrap: "pretty" }}>
              {souhait.details}
            </p>
          ) : null}

          {souhait.link ? (
            <a
              href={souhait.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: "var(--space-8)", wordBreak: "break-all" }}
            >
              {domaine(souhait.link)}
            </a>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: "var(--space-14)", paddingTop: "var(--space-12)",
          borderTop: "var(--border-width) solid var(--border-hairline)",
          display: "flex", gap: "var(--space-10)", alignItems: "center", flexWrap: "wrap",
        }}
      >
        {souhait.isFulfilled ? (
          <Tag>{t.souhaitOffert}</Tag>
        ) : souhait.reservedByMe ? (
          <>
            <Tag tone="quiet">{t.souhaitMien}</Tag>
            {/* Se raviser doit rester possible, et discret : c'est un retour en
                arrière, pas une action qu'on met en avant. */}
            <Button variant="text" onClick={annuler} disabled={attente}>
              {t.souhaitAnnuler}
            </Button>
          </>
        ) : souhait.isReserved ? (
          <>
            <Tag>{t.souhaitReserve}</Tag>
            <span style={{ fontSize: "var(--text-mention-m)", color: "var(--text-mention)" }}>
              {t.souhaitReserveAide}
            </span>
          </>
        ) : reservable && etape === null ? (
          <Button variant="outline" onClick={() => setEtape("coordonnees")}>
            {t.souhaitReserver}
          </Button>
        ) : null}
      </div>

      {etape === "coordonnees" ? (
        <div style={{ marginTop: "var(--space-14)", display: "grid", gap: "var(--space-14)" }}>
          {/* On dit AVANT la première saisie qu'il n'y a pas de compte à
              créer — pas après, quand le visiteur a déjà donné son adresse. */}
          <p style={{ margin: 0, color: "var(--text-secondary)", textWrap: "pretty" }}>
            {t.souhaitPourquoiAdresse}
          </p>
          <TextField
            label={t.souhaitLabelEmail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {/* Anonyme par défaut : se faire connaître est une case, pas une
              question. */}
          <label style={{ display: "flex", gap: "var(--space-10)", alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={connu}
              onChange={(e) => setConnu(e.target.checked)}
              style={{ marginTop: 3, accentColor: "var(--action)" }}
            />
            <span style={{ textWrap: "pretty" }}>{t.souhaitSeFaireConnaitre}</span>
          </label>
          {connu ? (
            <TextField
              label={t.souhaitLabelNom}
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              autoComplete="name"
            />
          ) : null}
          <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap" }}>
            <Button disabled={!emailValide || attente} onClick={demander}>{t.souhaitContinuer}</Button>
            <Button variant="text" onClick={() => setEtape(null)}>{t.souhaitAnnulerGeste}</Button>
          </div>
        </div>
      ) : null}

      {etape === "code" ? (
        <div style={{ marginTop: "var(--space-14)", display: "grid", gap: "var(--space-14)" }}>
          <p style={{ margin: 0, color: "var(--text-secondary)", textWrap: "pretty" }}>
            {t.souhaitCodeEnvoye}
          </p>
          <TextField
            label={t.souhaitLabelCode}
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <div style={{ display: "flex", gap: "var(--space-8)", flexWrap: "wrap" }}>
            <Button disabled={code.length < 6 || attente} onClick={confirmer}>{t.souhaitConfirmer}</Button>
            <Button variant="text" onClick={() => setEtape(null)}>{t.souhaitAnnulerGeste}</Button>
          </div>
        </div>
      ) : null}

      {/* Champ leurre, même motif que les autres formulaires publics. */}
      {etape !== null ? (
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor={`souhait-website-${souhait.id}`}>Site web</label>
          <input
            id={`souhait-website-${souhait.id}`}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={leurre}
            onChange={(e) => setLeurre(e.target.value)}
          />
        </div>
      ) : null}

      {panne === "generale" ? <Banner intent="error">{t.souhaitErreur}</Banner> : null}
      {panne === "code" ? <Banner intent="error">{t.souhaitCodeFaux}</Banner> : null}
      {/* Pris entre-temps : ce n'est pas une panne, c'est une nouvelle. */}
      {panne === "pris" ? <Banner intent="warning">{t.souhaitDejaPris}</Banner> : null}
      {panne === "annulation" ? <Banner intent="error">{t.souhaitAnnulerErreur}</Banner> : null}
    </div>
  );
}
