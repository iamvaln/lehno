import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Mur } from "../../../../components/surfaces/Mur.js";
import { AvisCourt } from "../../../../components/surfaces/AvisCourt.js";
import { estLangue, type Langue } from "../../../../lib/langues.js";
import { chargerMur } from "../../../../lib/mur.js";
import { messages } from "../../../../messages/index.js";

/* `/m/` et non `/mur/` ni `/wall/`.
 *
 * Un lien de Mur se partage : il traverse les langues. Les pages légales
 * portent un chemin traduit — `/fr/conditions`, `/en/terms` — parce qu'on y
 * arrive depuis le site ; celui-ci arrive par un message. Un mot français dans
 * la barre d'adresse d'un lecteur anglophone, ou l'inverse, se lirait comme une
 * erreur. La spécification a déjà tranché ainsi pour l'invitation
 * (`lehno.app/i/<code>`) : une lettre, opaque, courte dans un message. */

type Proprietes = { params: Promise<{ locale: string; pseudo: string }> };

// Une minute : un Mur change rarement, mais un mot d'accueil corrigé ne doit
// pas mettre une heure à paraître pour celui qui vient de l'écrire.
const REVALIDATION = 60;

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale, pseudo } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);

  const etat = await chargerMur(pseudo, REVALIDATION);

  /* La 404 du SITE, la même que pour n'importe quelle adresse inconnue. Un Mur
     non publié la rend aussi : distinguer « pas de Mur » de « Mur privé »
     dirait qui a un compte (§9.3 — 404, jamais 403). */
  if (etat.etat === "inconnu") notFound();

  if (etat.etat === "indisponible") {
    return (
      <AvisCourt
        t={t} langue={langue}
        titre={t.etatIndisponibleTitre}
        texte={t.etatIndisponibleTexte}
      />
    );
  }

  return <Mur t={t} langue={langue} mur={etat.mur} />;
}
