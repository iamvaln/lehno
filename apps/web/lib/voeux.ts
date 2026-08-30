import { publicWishFormSchema, type PublicWishForm } from "@lehno/contracts";
import { chargerSurface, type Etat } from "./surface-publique.js";

export type EtatVoeux = Etat<PublicWishForm>;

/* La page s'ouvre MÊME HORS FENÊTRE, et rend alors les bornes : c'est le dépôt
   qui refuse, pas la lecture. Une page qui refuserait de se charger ne pourrait
   pas dire quand revenir. */
export function chargerFormulaireVoeux(jeton: string, revalidate: number): Promise<EtatVoeux> {
  return chargerSurface(
    `/public/wishes/${encodeURIComponent(jeton)}`,
    publicWishFormSchema,
    revalidate,
  );
}
