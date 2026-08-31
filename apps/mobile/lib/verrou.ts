/* Un seul essai à la fois, partagé par tous ceux qui l'attendent.
 *
 * Le besoin vient du renouvellement de session : le serveur fait TOURNER le
 * jeton de rafraîchissement — chaque usage rend une paire neuve et brûle
 * l'ancienne. Deux appels lancés ensemble expirent ensemble, et chacun
 * repartait avec le même jeton ; le second passait pour un rejeu, et la
 * session tombait pour de bon.
 *
 * Ce verrou vit à part du client HTTP pour être éprouvé : `lib/api.ts` importe
 * `react-native`, typé en Flow, qu'aucun de nos outils de test ne sait lire.
 */
export function unSeulALaFois<T>(fabrique: () => Promise<T>): () => Promise<T> {
  let enCours: Promise<T> | null = null;
  return () => {
    /* Le relâchement se fait dans `finally` : sur un échec aussi. Le garder
       pris aurait rendu le même refus à tous les appels suivants, et une
       coupure de réseau d'une seconde aurait condamné la session. */
    enCours ??= fabrique().finally(() => { enCours = null; });
    return enCours;
  };
}
