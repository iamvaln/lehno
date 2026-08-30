import { sharedWishlistSchema, type SharedWishlist } from "@lehno/contracts";
import { chargerSurface, type Etat } from "./surface-publique.js";

export type EtatListe = Etat<SharedWishlist>;

/**
 * La liste partagée.
 *
 * **La réponse porte son état**, elle ne se contente pas d'un statut : un lien
 * révoqué rend `200` avec `state: "revoked"`, pas `404`. Dire « cette page
 * n'existe pas » à quelqu'un qui tient un lien qui a existé — et qui, lui, sait
 * qu'il a existé — serait une réponse fausse. Le `404`, ici, ne vaut que pour
 * un jeton qui n'a jamais rien désigné.
 *
 * Chargée sans le jeton de visite : celui-ci vit dans le navigateur, et le
 * rendu serveur est le même pour tout le monde. C'est la page qui, une fois
 * montée, redemande la liste avec son jeton pour retrouver ses réservations.
 */
export function chargerListe(jeton: string, revalidate: number): Promise<EtatListe> {
  return chargerSurface(
    `/public/wishlists/${encodeURIComponent(jeton)}`,
    sharedWishlistSchema,
    revalidate,
  );
}
