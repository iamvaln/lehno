import { publicWallSchema, type PublicWall } from "@lehno/contracts";
import { chargerSurface, type Etat } from "./surface-publique.js";

export type EtatMur = Etat<PublicWall>;

export function chargerMur(pseudo: string, revalidate: number): Promise<EtatMur> {
  return chargerSurface(
    `/public/walls/${encodeURIComponent(pseudo)}`,
    publicWallSchema,
    revalidate,
  );
}
