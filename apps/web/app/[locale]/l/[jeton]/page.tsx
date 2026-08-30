import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ListePartagee } from "../../../../components/surfaces/ListePartagee.js";
import { AvisCourt } from "../../../../components/surfaces/AvisCourt.js";
import { estLangue, type Langue } from "../../../../lib/langues.js";
import { chargerListe } from "../../../../lib/liste.js";
import { joursEntre } from "../../../../lib/dates.js";
import { messages } from "../../../../messages/index.js";

/* `/l/<jeton>`, une lettre, comme `/m/`, `/c/`, `/v/` et l'invitation `/i/`. */

type Proprietes = { params: Promise<{ locale: string; jeton: string }> };

/* Dix secondes. Un souhait réservé doit cesser d'être proposé vite : deux
   visiteurs sur la même liste au même moment, c'est le cas ordinaire d'un lien
   qu'on partage à un groupe. */
const REVALIDATION = 10;

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale, jeton } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);

  const etat = await chargerListe(jeton, REVALIDATION);

  // Un jeton qui n'a jamais rien désigné. Trente-deux caractères tirés au
  // hasard ne s'énumèrent pas : c'est ce qui rend tenable de distinguer ce cas
  // du lien révoqué ci-dessous.
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

  /* Le lien a existé et ne mène plus. Répondre « cette page n'existe pas » à
     quelqu'un qui tient un lien qui a existé — et qui, lui, sait qu'il a
     existé — serait une réponse fausse. */
  if (etat.donnees.state === "revoked") {
    return (
      <AvisCourt
        t={t} langue={langue}
        titre={t.listeRevoqueTitre}
        texte={t.listeRevoqueTexte}
      />
    );
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <ListePartagee
      t={t} langue={langue} jeton={jeton}
      liste={etat.donnees}
      joursRestants={joursEntre(aujourdhui, etat.donnees.occasionDate)}
    />
  );
}
