import type { ReactNode } from "react";
import { Invitation } from "../../../../components/surfaces/Invitation.js";
import { AvisCourt } from "../../../../components/surfaces/AvisCourt.js";
import { estLangue, type Langue } from "../../../../lib/langues.js";
import { chargerInvitation } from "../../../../lib/invitation.js";
import { messages } from "../../../../messages/index.js";

/* `/i/<code>` — la forme retenue par la spécification pour l'invitation, et le
 * modèle des quatre autres surfaces : une lettre, opaque, courte dans un
 * message. */

type Proprietes = { params: Promise<{ locale: string; code: string }> };

// Cinq minutes : un code d'invitation ne change pas, et sa page est ce qu'on
// partage en rafale — c'est la seule surface qu'on peut servir longtemps depuis
// le cache sans rien perdre.
const REVALIDATION = 300;

export default async function Page({ params }: Proprietes): Promise<ReactNode> {
  const { locale, code } = await params;
  const langue: Langue = estLangue(locale) ? locale : "fr";
  const t = messages(langue);

  const etat = await chargerInvitation(code, REVALIDATION);

  if (etat.etat === "indisponible") {
    return (
      <AvisCourt
        t={t} langue={langue}
        titre={t.etatIndisponibleTitre}
        texte={t.etatIndisponibleTexte}
      />
    );
  }

  /* Un code inconnu ne rend PAS la 404 du site : celui qui a suivi ce lien
     voulait installer Lehno, et le renvoyer sur une page d'erreur perdrait la
     seule chose que l'invitation avait à faire. La page paraît sans le gain. */
  return (
    <Invitation
      t={t} langue={langue}
      parrainage={etat.etat === "trouve" ? etat.donnees : null}
    />
  );
}
