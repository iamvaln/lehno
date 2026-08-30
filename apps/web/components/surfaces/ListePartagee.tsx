"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { SharedWishlist } from "@lehno/contracts";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { dateEnToutesLettres } from "../../lib/dates.js";
import { garderJetonDeVisite, jetonDeVisite } from "../../lib/jeton-visite.js";
import { interpoler } from "../../lib/texte.js";
import { PublicShell } from "../PublicShell.js";
import { Avatar, Banner, Countdown } from "../ui/index.js";
import { CarteSouhait } from "./CarteSouhait.js";

type Ouverte = Extract<SharedWishlist, { state: "ok" }>;

/* Au-delà de six souhaits, la grille ; en dessous, des cartes larges. Trois
   souhaits dans une grille de vingt paraissent trois fois vides — la
   composition suit la liste, elle ne l'impose pas. */
const SEUIL_GRILLE = 6;

/**
 * La liste partagée d'une personne.
 *
 * **La personne avant les objets.** L'en-tête accueille — prénom, occasion,
 * date, décompte — et le titre est à la première personne, comme sur le Mur :
 * « Voilà ce qui me ferait plaisir ». En romain, pas en italique : c'est le
 * titre de la page, pas une citation. Une page qui ouvre sur une grille
 * ressemble à un catalogue, et le lien n'était pas un catalogue.
 *
 * **L'invitation vient après le geste**, dans la page. Quelqu'un qui vient de
 * réserver a compris à quoi ça sert ; avant, un bandeau permanent demanderait
 * à un invité de penser à lui-même au moment où il pense à quelqu'un d'autre.
 * D'où `acquisition={false}` sur la coquille, dans les deux temps.
 */
export function ListePartagee(
  { t, langue, jeton, liste, joursRestants }: {
    t: Messages; langue: Langue; jeton: string;
    liste: Ouverte;
    joursRestants: number;
  },
): ReactNode {
  const [etat, setEtat] = useState<Ouverte>(liste);
  const [reserve, setReserve] = useState(false);

  /* Le rendu serveur ne connaît pas le jeton de visite — il vit dans le
     navigateur, et la page est la même pour tout le monde. Une fois montée,
     elle redemande la liste avec son jeton : c'est ce qui fait apparaître
     « vous vous en occupez » là où le premier rendu disait « déjà pris ». */
  const relire = async (): Promise<void> => {
    const visite = jetonDeVisite();
    if (visite === null) return;
    const base = process.env["NEXT_PUBLIC_API_URL"] ?? "";
    try {
      const reponse = await fetch(`${base}/v1/public/wishlists/${encodeURIComponent(jeton)}`, {
        headers: { "x-lehno-reservation": visite },
        cache: "no-store",
      });
      if (!reponse.ok) return;
      /* On ne repasse PAS la réponse par le schéma Zod ici.
         Le premier rendu, lui, l'a fait — c'est le serveur qui parle à un tiers.
         Celui-ci relit la même route, sur la même API, une charge déjà validée
         une fois : embarquer Zod au navigateur pour la revérifier coûtait 29 ko
         de JS sur la page publique la plus visitée, vue par des gens qui ne
         connaissent pas encore Lehno et souvent sur un forfait compté. On
         vérifie donc le discriminant, qui est tout ce dont dépend la suite.

         Une liste révoquée entre-temps ne se substitue pas à celle qu'on lit :
         la page a déjà été rendue, et la remplacer par un vide sous les yeux du
         visiteur serait pire que de la laisser telle quelle. */
      const charge = await reponse.json() as SharedWishlist;
      if (charge?.state === "ok" && Array.isArray(charge.wishes)) setEtat(charge);
    } catch {
      // Le premier rendu reste juste : il dit « déjà pris » au lieu de « par
      // vous ». C'est une nuance perdue, pas une page fausse.
    }
  };

  useEffect(() => { void relire(); }, []);

  /* Le cadeau rendu se remet à l'écran TOUT DE SUITE, sans attendre la
     relecture. Celle-ci ne part que si le jeton de visite est lisible — et il
     ne l'est pas toujours (navigation privée, stockage bloqué). S'en remettre à
     elle laisserait la carte dire « vous vous en occupez » après une annulation
     réussie : le visiteur croirait avoir échoué et recommencerait. */
  const apresAnnulation = (souhaitId: string): void => {
    setEtat((vue) => ({
      ...vue,
      wishes: vue.wishes.map((s) =>
        s.id === souhaitId ? { ...s, isReserved: false, reservedByMe: false } : s),
    }));
    void relire();
  };

  const apresReservation = (jetonRendu: string): void => {
    garderJetonDeVisite(jetonRendu);
    setReserve(true);
    void relire();
  };

  const grille = etat.wishes.length > SEUIL_GRILLE;

  return (
    <PublicShell t={t} langue={langue} acquisition={false}>
      <section
        style={{
          maxWidth: "var(--page-max)", margin: "0 auto",
          padding: "clamp(40px,7vw,72px) var(--page-gutter)",
        }}
      >
        <header style={{ marginBottom: "var(--space-32)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
            <Avatar
              name={etat.ownerFirstName}
              {...(etat.ownerAvatarUrl ? { src: etat.ownerAvatarUrl } : {})}
              size={48}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: "var(--font-body-semibold)" }}>{etat.ownerFirstName}</div>
              <div style={{ fontSize: "var(--text-mention-m)", color: "var(--text-mention)" }}>
                {interpoler(t.listeOccasion, {
                  occasion: etat.occasionLabel ?? "",
                  date: dateEnToutesLettres(etat.occasionDate, langue),
                })}
              </div>
            </div>
            {joursRestants >= 0 ? (
              <div style={{ marginLeft: "auto" }}>
                <Countdown days={joursRestants} locale={langue} size="s" />
              </div>
            ) : null}
          </div>

          <h1
            className="titre"
            style={{
              margin: "var(--space-20) 0 0",
              fontWeight: "var(--font-display-regular)",
              fontSize: "clamp(27px,3.6vw,37px)",
              lineHeight: "var(--leading-display)",
              letterSpacing: "var(--tracking-display)",
              textWrap: "balance",
            }}
          >
            {t.listeTitre}
          </h1>

          {/* Faux quand l'occasion est passée : la liste s'affiche, sans
              accepter de réservation. Le client ne compare pas la date
              lui-même — deux versions du parc, deux fuseaux, deux réponses. */}
          {etat.acceptsReservations ? null : (
            <p style={{ margin: "var(--space-14) 0 0", color: "var(--text-secondary)" }}>
              {t.listeFermee}
            </p>
          )}
        </header>

        {etat.wishes.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t.listeVide}</p>
        ) : (
          <div
            style={{
              display: "grid", gap: "var(--space-16)",
              ...(grille
                ? { gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }
                : { maxWidth: "40rem" }),
            }}
          >
            {etat.wishes.map((souhait) => (
              <CarteSouhait
                key={souhait.id}
                t={t} langue={langue} souhait={souhait}
                reservable={etat.acceptsReservations}
                onReserve={apresReservation}
                onAnnule={() => apresAnnulation(souhait.id)}
              />
            ))}
          </div>
        )}

        {/* L'anonymat se dit une fois, en pied de liste. */}
        {etat.wishes.length > 0 ? (
          <p style={{ marginTop: "var(--space-24)", fontSize: "var(--text-mention-m)", color: "var(--text-mention)" }}>
            {t.listeAnonymat}
          </p>
        ) : null}

        {reserve ? (
          <div style={{ marginTop: "var(--space-32)" }}>
            <Banner intent="info">
              <strong>{t.listeFaireMaPart}</strong> {t.listeFaireMaPartTexte}{" "}
              <a href={`/${langue}`}>{t.listeFaireMaPartAction}</a>
            </Banner>
          </div>
        ) : null}
      </section>
    </PublicShell>
  );
}
