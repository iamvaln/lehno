/**
 * La réduction d'un palier, DÉDUITE des montants qu'elle résume.
 *
 * Sans base ni serveur, comme `frais.ts` et pour la même raison : c'est un
 * chiffre qu'un client lit avant de payer, il changera plus souvent que le
 * reste, et son erreur ne se voit pas.
 *
 * ELLE ÉTAIT SAISIE À LA MAIN. `credit_bundle.bonus_percent` était un
 * `smallint` tapé au panneau, que rien ne rattachait aux montants qu'il
 * résume : un palier pouvait annoncer 20 % quand son rapport prix/crédits en
 * valait cinq, et aucun test ne tombait — il n'y avait rien à comparer.
 *
 * AUCUNE VALEUR STOCKÉE NE FAIT PLUS AUTORITÉ, et c'est ce qui rend le montage
 * sûr : la question du recalcul en cascade quand `credit_unit_price` change ne
 * se pose plus. Rien à invalider, rien qui pourrisse en silence, rien qu'une
 * modification directe en base puisse rendre menteur. La source de vérité est
 * structurellement la configuration.
 *
 * UNE SEULE IMPLANTATION, partagée par l'aperçu du panneau et par ce que le
 * mobile reçoit. Deux implantations dériveraient, et le panneau montrerait un
 * chiffre pendant que l'application en afficherait un autre — sur le même
 * palier, au même instant.
 */

/**
 * Ce que vaut la remise d'un palier, en pourcentage entier, ou `null`.
 *
 * `null` quand il n'y en a pas — et pas `0`. La distinction porte : le contrat
 * dit que la ligne « ne doit alors pas exister plutôt qu'afficher +0 % », et un
 * zéro rendu comme un nombre ferait afficher une étiquette vide sur les petits
 * paliers.
 *
 * ARRONDI VERS LE BAS, délibérément. C'est une annonce commerciale : mieux vaut
 * en promettre un peu moins que ce qu'on donne. `Math.round` ferait annoncer
 * 10 % pour 9,6 % — soit un dixième de point de plus que ce que la personne
 * reçoit réellement, sur un chiffre qui décide de son achat.
 *
 * @param prixUnitaire ce que coûte UN crédit acheté seul (`credit_unit_price`).
 * @param montant ce que le palier coûte.
 * @param credits combien de crédits il donne.
 */
export function remiseDe(
  prixUnitaire: number,
  montant: number,
  credits: number,
): number | null {
  /* Les entrées viennent de la base — d'une colonne `Decimal` et d'un
     `system_parameter` en texte libre. Un paramètre effacé, mal saisi ou remis
     à zéro donnerait `NaN` ou une division par zéro, et le pourcentage
     traverserait toute la chaîne jusqu'à l'écran. On rend `null` : « pas de
     remise à annoncer » est toujours une réponse défendable, un `NaN` jamais. */
  if (!Number.isFinite(prixUnitaire) || !Number.isFinite(montant) || !Number.isFinite(credits)) return null;
  if (prixUnitaire <= 0 || credits <= 0 || montant < 0) return null;

  const pleinTarif = credits * prixUnitaire;
  const gain = pleinTarif - montant;

  /* Un palier PLUS CHER que le plein tarif ne rend pas une remise négative :
     il n'y a rien à annoncer. Le cas n'est pas théorique — il suffit de baisser
     `credit_unit_price` sans revoir les paliers, et c'est exactement le genre
     de réglage qu'on fait un vendredi soir. Le silence est le bon
     comportement ; une « remise de −12 % » affichée au client ne l'est pas. */
  if (gain <= 0) return null;

  const pourcentage = Math.floor((gain / pleinTarif) * 100);

  /* Sous le point de pourcentage, on n'annonce rien. « −0 % » n'est pas une
     offre, et la ligne ne doit pas exister. */
  return pourcentage > 0 ? pourcentage : null;
}
