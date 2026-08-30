import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { DepotVoeu } from "../../../../components/surfaces/DepotVoeu.js";
import { AvisCourt } from "../../../../components/surfaces/AvisCourt.js";
import { estLangue, type Langue } from "../../../../lib/langues.js";
import { chargerFormulaireVoeux } from "../../../../lib/voeux.js";
import { messages } from "../../../../messages/index.js";

/* `/v/<jeton>`, une lettre, comme `/m/` et comme l'invitation `/i/`. Ces
 * adresses arrivent par un message, pas depuis le site : un mot français dans
 * la barre d'adresse d'un lecteur anglophone se lirait comme une erreur. */

type Proprietes = { params: Promise<{ locale: string; jeton: string }> };

/* Dix secondes. `isOpen` bascule sur une frontière de jour, et la page ouverte
   ou fermée n'est pas la même page : servir la version d'hier au premier
   visiteur du matin lui montrerait un formulaire que le serveur refusera. */
const REVALIDATION = 10;

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale, jeton } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);

  const etat = await chargerFormulaireVoeux(jeton, REVALIDATION);

  // Un lien révoqué, une occasion supprimée, un jeton inventé : la 404 du
  // site, la même que pour n'importe quelle adresse inconnue.
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

  return <DepotVoeu t={t} langue={langue} jeton={jeton} formulaire={etat.donnees} />;
}
