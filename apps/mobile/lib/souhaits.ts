import {
  createOwnerWishSchema, updateOwnerWishSchema,
  type CreateOwnerWishInput, type OwnerWish, type UpdateOwnerWishInput,
} from "@lehno/contracts";

/* Les souhaits d'une liste — §3.19.
 *
 * UNE LISTE VIDE NE SE PARTAGE PAS. Sans cet écran, on pouvait créer une
 * wishlist et jamais la remplir — donc jamais la partager, puisque le partage
 * exige au moins un souhait. C'est le chaînon qui manquait.
 */

export type EtatDuSouhait = "libre" | "reserve" | "offert";

/* CE QU'UN SOUHAIT EST DEVENU.
 *
 * `reserved` NE S'ÉCRIT PAS À LA MAIN : « le laisser poser permettrait de
 * déclarer pris un cadeau que personne n'a réservé, donc de le retirer de la
 * liste partagée sans qu'aucune réservation ne l'explique ». Il découle d'une
 * réservation confirmée, et de rien d'autre.
 *
 * `fulfilled` reste la décision du propriétaire — « c'est lui qui sait ce qu'il
 * a reçu ».
 */
export function etatDuSouhait(souhait: OwnerWish): EtatDuSouhait {
  if (souhait.status === "fulfilled") return "offert";
  if (souhait.status === "reserved") return "reserve";
  return "libre";
}

/* CE QUE LE PROPRIÉTAIRE PEUT ÉCRIRE : libre ou offert, jamais réservé. La
   bascule proposée est donc l'inverse de l'un des deux — et sur un souhait
   RÉSERVÉ, elle mène à « offert », ce qui est le geste attendu : quelqu'un l'a
   pris, on le marque reçu le jour venu. */
export function marqueSuivante(souhait: OwnerWish): "available" | "fulfilled" {
  return etatDuSouhait(souhait) === "offert" ? "available" : "fulfilled";
}

/* QUI A RÉSERVÉ, QUAND ON LE SAIT — et le silence n'est pas une absence.
 *
 * « Nul ne veut pas dire *personne n'a réservé* — le souhait peut être
 * `reserved` sans nom —, mais *aucun nom n'a été donné*. » Confondre les deux
 * ferait dire à l'écran que rien n'est pris alors que si, et quelqu'un
 * rachèterait le même cadeau.
 */
export function nomDuReserveur(souhait: OwnerWish): string | null {
  return etatDuSouhait(souhait) === "reserve" ? souhait.reservedByName : null;
}

export interface SaisieDeSouhait {
  intitule: string;
  lien: string;
  details: string;
  prix: string;
  devise: string;
  public: boolean;
}

/* UN PRIX PORTE SA DEVISE. Le contrat refuse l'un sans l'autre, et il a
   raison : « 12 000 » ne dit rien sans dire de quoi. On omet donc les deux
   quand le prix n'est pas saisi, plutôt que d'en envoyer un seul.
   
   Les champs facultatifs sont OMIS et non envoyés vides : le schéma est strict
   et refuse une chaîne vide là où il attend une URL ou un texte. */
export function corpsDeCreation(saisie: SaisieDeSouhait): CreateOwnerWishInput {
  const prix = Number.parseFloat(saisie.prix.replace(",", "."));
  const chiffre = saisie.prix.trim() !== "" && Number.isFinite(prix) && prix >= 0;
  const lien = saisie.lien.trim();
  const details = saisie.details.trim();

  return createOwnerWishSchema.parse({
    label: saisie.intitule.trim(),
    ...(lien ? { link: lien } : {}),
    ...(details ? { details } : {}),
    ...(chiffre ? { price: prix, currency: saisie.devise } : {}),
    isPublic: saisie.public,
  });
}

/* Rendre un souhait privé, ou le remettre sur la liste partagée. « Un souhait
   peut rester à soi » — et il naît public, parce que « la liste existe pour
   être partagée, et un souhait qui naîtrait privé demanderait un geste de plus
   pour faire ce qu'on attendait ». */
export function corpsDeVisibilite(souhait: OwnerWish): UpdateOwnerWishInput {
  return updateOwnerWishSchema.parse({ isPublic: !souhait.isPublic });
}

export function corpsDeMarque(souhait: OwnerWish): UpdateOwnerWishInput {
  return updateOwnerWishSchema.parse({ status: marqueSuivante(souhait) });
}

/* CE QUI PARAÎT SUR LA LISTE PARTAGÉE, et donc ce qui compte pour le partage.
   Un souhait privé ne se voit pas : une liste qui n'en aurait que des privés
   se partagerait vide. */
export function souhaitsVisibles(souhaits: readonly OwnerWish[]): OwnerWish[] {
  return souhaits.filter((s) => s.isPublic);
}
