/**
 * Le barème d'un canal, appliqué à un montant.
 *
 * Sans base ni serveur, à dessein : c'est le morceau qui décide de ce qu'un
 * client verse et de ce qu'on attend sur le compte, il changera plus souvent
 * que le reste, et son erreur ne se voit pas. Un montant attendu faux fait
 * constater un écart qui n'existe pas — ou en cache un qui existe.
 */

/** Ce qu'on lit d'un `PaymentChannel` pour calculer. Rien d'autre. */
export type Bareme = {
  feePercent: number;
  feeFixed: number;
  feeMin: number | null;
  feeMax: number | null;
  /**
   * Qui supporte les frais.
   *
   * `payer` — le client verse le montant **plus** les frais, et le service
   * reçoit le montant plein. C'est le mobile money : un palier à 1 000 fait
   * verser 1 020, et il en arrive 1 000. L'écart attendu sur le compte est donc
   * nul, et tout manque est un vrai écart — pas le fonctionnement de
   * l'opérateur.
   *
   * `payee` — les frais sont **prélevés** sur le versement, et le service
   * reçoit moins que ce que le client a envoyé. C'est la carte : le client est
   * débité de 1 000, le service en reçoit 980.
   */
  feeBorneBy: "payer" | "payee";
};

export type Frais = {
  /** Ce que l'opérateur prend. */
  frais: number;
  /** Ce que le client compose sur son téléphone. */
  aVerser: number;
  /** Ce qu'on doit voir arriver. C'est à celui-ci qu'on compare le reçu. */
  attenduSurLeCompte: number;
};

export function fraisDe(bareme: Bareme, montant: number): Frais {
  if (montant < 0) throw new Error("un montant négatif n'est pas un achat");

  // Un montant nul n'est pas un achat : on ne prélève pas de frais fixes sur
  // rien.
  if (montant === 0) return { frais: 0, aVerser: 0, attenduSurLeCompte: 0 };

  const brut = (montant * bareme.feePercent) / 100 + bareme.feeFixed;

  // Le plancher d'abord, le plafond ensuite. L'ordre ne change rien tant que
  // le plafond est au-dessus du plancher — et la base refuse l'inverse. Il
  // décide dans le seul cas qu'elle ne peut pas atteindre : un barème
  // incohérent arrivé autrement qu'en base. On fait alors gagner le plafond,
  // parce qu'un plafond est une limite dure : mieux vaut annoncer des frais
  // trop bas qu'un montant que le client refusera de verser.
  const borne = Math.min(
    bareme.feeMax ?? Number.POSITIVE_INFINITY,
    Math.max(bareme.feeMin ?? 0, brut),
  );

  // Au franc supérieur. Le mobile money ne connaît pas la fraction de franc :
  // annoncer un centime ferait composer au client un montant qu'il ne peut pas
  // saisir, et l'écart constaté serait une erreur d'arrondi qu'on prendrait
  // pour un manque.
  const frais = Math.ceil(borne);

  return bareme.feeBorneBy === "payer"
    ? { frais, aVerser: montant + frais, attenduSurLeCompte: montant }
    // Jamais négatif : des frais qui dépasseraient le montant donneraient un
    // attendu absurde, qu'on comparerait ensuite à ce qui est arrivé.
    : { frais, aVerser: montant, attenduSurLeCompte: Math.max(0, montant - frais) };
}
