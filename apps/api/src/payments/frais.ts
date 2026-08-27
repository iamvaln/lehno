/* Le calcul des frais d'un canal — UNE seule fonction, appelée par l'aperçu et
 * par la création.
 *
 * Deux calculs séparés divergeraient un jour, et le client verrait un montant à
 * l'aperçu et un autre sur sa demande — l'écart se découvrant devant
 * l'application de son opérateur, au pire moment.
 *
 * Elle est PURE et sans dépendance : c'est ce qui permet de l'éprouver au
 * centime sans base ni serveur. */

export type Bareme = {
  readonly feePercent: number;
  readonly feeFixed: number;
  readonly feeMin: number | null;
  readonly feeMax: number | null;
  // Qui supporte les frais. Voir plus bas : ça change le SENS du calcul.
  readonly feeBorneBy: "payer" | "payee";
};

export type Frais = {
  /** Le prix du palier. */
  readonly prix: number;
  /** Ce que le canal prélève. */
  readonly frais: number;
  /** Ce que le client doit envoyer depuis son application d'opérateur. */
  readonly aVerser: number;
  /** Ce qu'on doit voir arriver sur le compte de collecte. */
  readonly attenduSurLeCompte: number;
};

/* Les montants sont en unité monétaire entière (le franc CFA n'a pas de
   centime), arrondis au supérieur. Arrondir au plus proche ferait manquer une
   unité sur le compte, et un manque d'une unité est un écart à traiter — pour
   un centime que personne n'a volé. */
const arrondir = (x: number): number => Math.ceil(x - 1e-9);

export function calculerFrais(prix: number, bareme: Bareme): Frais {
  /* L'ordre compte : part proportionnelle, puis part fixe, PUIS le plancher et
     le plafond. Borner avant d'ajouter la part fixe donnerait un total qui
     dépasse le plafond annoncé — et le plafond est ce que le client a lu. */
  const brut = (prix * bareme.feePercent) / 100 + bareme.feeFixed;
  let frais = brut;
  if (bareme.feeMin !== null) frais = Math.max(frais, bareme.feeMin);
  if (bareme.feeMax !== null) frais = Math.min(frais, bareme.feeMax);
  frais = arrondir(frais);

  /* LE point qu'on ne peut pas se permettre d'inverser.
   *
   * `payer` — le mobile money. Le client paie les frais EN PLUS : un palier à
   * 1 000 fait verser 1 020, et il en arrive 1 000. Le montant attendu est donc
   * le prix du palier, et tout manque constaté est un VRAI écart, pas le
   * fonctionnement de l'opérateur.
   *
   * `payee` — la carte, le jour où elle arrivera. Le prestataire prélève sa
   * part sur ce qu'il reverse : le client paie 1 000, il en arrive 980.
   *
   * S'en tromper fait rejeter des paiements corrects, ou en accepter
   * d'incomplets — et ni l'un ni l'autre ne se voit sans relire le barème. */
  return bareme.feeBorneBy === "payer"
    ? { prix, frais, aVerser: prix + frais, attenduSurLeCompte: prix }
    : { prix, frais, aVerser: prix, attenduSurLeCompte: prix - frais };
}
