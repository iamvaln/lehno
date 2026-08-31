import type { ReactNode } from "react";
import type { Langue } from "../../lib/langues.js";
import type { Messages } from "../../messages/index.js";
import { interpoler } from "../../lib/texte.js";
import { AvisCourt } from "./AvisCourt.js";

/**
 * L'arrêt pour intervention.
 *
 * **Ce n'est pas une panne, et ça ne se dit pas comme une panne.** Le serveur
 * rend `503` — « la ressource existe, elle est momentanément fermée » — et le
 * contrat le souligne : un arrêt de deux heures lu comme une suppression
 * enverrait le visiteur réessayer indéfiniment, ou renoncer.
 *
 * **Deux états, parce que l'heure de retour est facultative.** Avec elle, la
 * page dit quand revenir. Sans elle, elle dit seulement qu'une mise à jour est
 * en cours — pas de « bientôt », pas d'estimation inventée.
 *
 * L'heure est mise à l'heure du LECTEUR : le serveur envoie de l'UTC et ne
 * connaît pas son fuseau. Une heure de retour affichée dans le fuseau du
 * serveur ferait attendre deux heures de trop, ou repartir trop tôt.
 */
export function Intervention(
  { t, langue, retour }: { t: Messages; langue: Langue; retour: string | null },
): ReactNode {
  const heure = retour === null ? null : new Intl.DateTimeFormat(
    langue === "en" ? "en-GB" : "fr-FR",
    { hour: "2-digit", minute: "2-digit" },
  ).format(new Date(retour));

  return (
    <AvisCourt
      t={t}
      langue={langue}
      titre={t.interventionTitre}
      texte={heure === null
        ? t.interventionSansHeure
        : interpoler(t.interventionAvecHeure, { heure })}
    />
  );
}
