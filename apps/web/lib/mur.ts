import { publicWallSchema, type PublicWall } from "@lehno/contracts";

/**
 * Ce qu'on sait d'un Mur, et ce qu'on n'en sait pas.
 *
 * Trois issues, pas deux. « Inconnu » et « indisponible » ne se confondent
 * pas : la première dit que ce Mur n'existe pas — c'est une information —, la
 * seconde que nous n'avons pas pu répondre. Rendre la 404 du site sur une
 * panne dirait à un visiteur que son amie n'a pas de Mur, ce qui est faux et
 * définitif pour lui.
 */
export type EtatMur =
  | { etat: "trouve"; mur: PublicWall }
  | { etat: "inconnu" }
  | { etat: "indisponible" };

export async function chargerMur(pseudo: string, revalidate: number): Promise<EtatMur> {
  const base = process.env["API_URL"];
  if (!base) return { etat: "indisponible" };

  try {
    const reponse = await fetch(
      `${base}/v1/public/walls/${encodeURIComponent(pseudo)}`,
      { next: { revalidate } },
    );

    /* 404 vaut « ce Mur n'existe pas », et le serveur le rend AUSSI pour un Mur
       non publié ou un pseudo mal formé (§9.3 : jamais 403). La page n'a donc
       aucune règle à connaître — et surtout, elle ne peut pas dire qui a un
       compte. */
    if (reponse.status === 404) return { etat: "inconnu" };
    if (!reponse.ok) return { etat: "indisponible" };

    const analyse = publicWallSchema.safeParse(await reponse.json());
    /* Une réponse valide mais d'une autre forme — un déploiement à moitié
       passé — n'est pas un Mur absent : on le dit indisponible plutôt que de
       rendre une page à trous. */
    return analyse.success ? { etat: "trouve", mur: analyse.data } : { etat: "indisponible" };
  } catch {
    return { etat: "indisponible" };
  }
}
