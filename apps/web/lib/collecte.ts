import {
  publicCollectFormSchema, publicSubmissionsSchema,
  type PublicCollectForm, type PublicSubmission,
} from "@lehno/contracts";
import { chargerSurface, type Etat } from "./surface-publique.js";

export type EtatCollecte = Etat<PublicCollectForm>;

export function chargerFormulaireCollecte(jeton: string, revalidate: number): Promise<EtatCollecte> {
  return chargerSurface(
    `/public/collect/${encodeURIComponent(jeton)}`,
    publicCollectFormSchema,
    revalidate,
  );
}

/**
 * Ce que CE répondant a déjà envoyé, avec le sort de chaque souhait.
 *
 * **Servi sur les seuls liens nominatifs**, et le serveur rend 404 sur un lien
 * public — un lien partagé au monde y ferait lire à n'importe quel visiteur ce
 * que tous les autres ont écrit. Cette 404-là n'est donc pas une ressource
 * absente : c'est la règle qui s'applique. On la traduit en liste vide, et la
 * page ne montre simplement pas d'historique.
 *
 * `no-store` et non un délai : cette liste est propre au détenteur du lien, et
 * la mettre en cache la servirait au suivant.
 */
export async function chargerContributions(jeton: string): Promise<PublicSubmission[]> {
  const etat = await chargerSurface(
    `/public/collect/${encodeURIComponent(jeton)}/submissions`,
    publicSubmissionsSchema,
    0,
  );
  return etat.etat === "trouve" ? etat.donnees.submissions : [];
}
