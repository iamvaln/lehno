import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Collecte } from "../../../../components/surfaces/Collecte.js";
import { AvisCourt } from "../../../../components/surfaces/AvisCourt.js";
import { estLangue, type Langue } from "../../../../lib/langues.js";
import { chargerFormulaireCollecte, chargerContributions } from "../../../../lib/collecte.js";
import { chargerConfig } from "../../../../lib/config-publique.js";
import { messages } from "../../../../messages/index.js";

/* `/c/<jeton>`, une lettre, comme `/m/`, `/v/` et l'invitation `/i/`. Ces
 * adresses arrivent par un message, pas depuis le site. */

type Proprietes = { params: Promise<{ locale: string; jeton: string }> };

// Une minute : le formulaire ne change qu'au gré du propriétaire — un nom
// corrigé, un Mur publié — et ne doit pas mettre une heure à suivre.
const REVALIDATION = 60;

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale, jeton } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);

  const etat = await chargerFormulaireCollecte(jeton, REVALIDATION);

  // Un lien révoqué, expiré ou inventé : la 404 du site.
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

  /* L'historique et la devise ne se chargent qu'ensuite : sans formulaire, il
     n'y a pas de page à composer, et deux appels de plus sur un lien mort ne
     serviraient à personne. */
  const [dejaEnvoye, config] = await Promise.all([
    chargerContributions(jeton),
    chargerConfig(REVALIDATION),
  ]);

  return (
    <Collecte
      t={t} langue={langue} jeton={jeton}
      formulaire={etat.donnees}
      devise={config.currency}
      dejaEnvoye={dejaEnvoye}
    />
  );
}
