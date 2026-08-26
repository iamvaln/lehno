/* Les décisions du fournisseur de drapeaux, séparées de ce qui les exécute.
 *
 * Elles tiennent en deux questions : faut-il redemander la liste, et que
 * montrer quand on ne l'a pas. Ni l'une ni l'autre ne demande le réseau.
 */

/* Le retour au premier plan est fréquent — on ouvre l'application, on répond à
   un message, on revient. Redemander à chaque fois harcèlerait le serveur sans
   rien apprendre de neuf. Une minute suit l'administration d'assez près : une
   fonctionnalité éteinte atteint un téléphone resté ouvert dans la minute. */
export const DELAI_DE_GRACE = 60_000;

export function doitRecharger(dernierAppel: number | null, maintenant: number): boolean {
  if (dernierAppel === null) return true;
  // L'horloge d'un téléphone peut reculer — fuseau, correction réseau. Un écart
  // négatif ne doit pas figer la liste pour toujours.
  const ecart = maintenant - dernierAppel;
  return ecart < 0 || ecart >= DELAI_DE_GRACE;
}

/* « Si l'appel échoue au démarrage, l'application s'ouvre sur le socle plutôt
   que vide. » Une liste vide dit exactement cela : `estActive` tient le socle
   pour toujours actif, et rien d'autre ne paraît.

   Montrer TOUT en cas d'échec serait pire que de ne rien montrer : on
   ouvrirait des écrans que le serveur refuse ensuite, et l'application
   paraîtrait cassée là où elle est seulement mal renseignée. */
export function etatDeRepli(): readonly string[] {
  return [];
}
