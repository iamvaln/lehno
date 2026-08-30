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

/* Le jeton de visite : présenté dans `x-lehno-reservation`, il fait reconnaître
 * SES réservations, et celles-là seulement.
 *
 * Il vit dans le stockage local plutôt que dans un cookie : il ne vaut pas
 * session de compte, et un cookie partirait avec chaque appel, y compris ceux
 * qui n'ont rien à voir. Un accès au stockage peut lever — navigation privée,
 * site data bloqué —, d'où les gardes : la page doit rester juste sans lui,
 * elle montrera seulement « réservé » là où elle aurait dit « par vous ». */
const CLE_JETON = "lehno.reservation";

export function jetonDeVisite(): string | null {
  try {
    return globalThis.localStorage?.getItem(CLE_JETON) ?? null;
  } catch {
    return null;
  }
}

export function garderJetonDeVisite(jeton: string): void {
  try {
    globalThis.localStorage?.setItem(CLE_JETON, jeton);
  } catch {
    // Rien à rattraper : le visiteur perdra la marque de ses réservations au
    // rechargement, et c'est tout. La réservation, elle, est déjà prise.
  }
}
