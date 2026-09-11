/**
 * Attendre la fin d'une génération lancée.
 *
 * `lancerMessage`, `lancerIdees` et `lancerPortrait` rendent `{ execution,
 * fini }` : l'exécution part aussitôt — c'est ce que la production renvoie au
 * client, et ce que le contrat annonce — pendant que `fini` porte la promesse
 * de ce qui sera produit.
 *
 * LES TESTS, EUX, VEULENT L'ÉTAT FINAL. Attendre `fini` à chaque appel écrirait
 * `(await service.lancerIdees(…)).fini` une trentaine de fois ; cette aide le
 * dit en un mot, et elle rappelle par son nom que la production, en vrai, ne
 * l'attend pas.
 *
 * Elle rend `null` quand la génération a échoué — `enArrierePlan` rattrape et
 * rembourse plutôt que de rejeter, puisqu'en production personne n'attend cette
 * promesse. Un test qui éprouve un échec lit donc `null`, et va vérifier le
 * crédit rendu.
 */
export async function fini<T>(
  lancement: Promise<{ fini: Promise<T | null> }>,
): Promise<T> {
  const produit = await (await lancement).fini;
  /* ON LÈVE PLUTÔT QUE DE RENDRE NUL. Un cas qui attend une production et n'en
     reçoit pas doit tomber en le DISANT — sinon il continue sur `null` et
     échoue trois lignes plus loin sur « cannot read property of null », ce qui
     ne nomme pas la cause. Les cas qui éprouvent un ÉCHEC emploient `echoue`. */
  if (produit === null)
    throw new Error("la génération n'a rien produit : voir le crédit rendu et le code d'échec");
  return produit;
}

/**
 * Attendre une génération dont on éprouve l'ÉCHEC.
 *
 * C'est ce que §B change vraiment : une production qui rate ne REJETTE plus.
 * La requête est déjà partie quand elle échoue — relever ferait tomber le
 * processus Node entier. Le crédit est rendu, l'exécution porte sa raison, et
 * le client l'apprend en interrogeant.
 *
 * Un cas qui écrivait `await expect(lancer(…)).rejects.toThrow()` éprouvait le
 * comportement d'hier. Il doit maintenant vérifier ce que l'utilisateur voit :
 * son solde revenu, et le code d'échec sur l'exécution.
 */
export async function echoue(
  lancement: Promise<{ fini: Promise<unknown> }>,
): Promise<void> {
  const produit = await (await lancement).fini;
  if (produit !== null)
    throw new Error("la génération a abouti, alors que ce cas éprouve un échec");
}
