/* SAVOIR QU'ON EST HORS CONNEXION — et ne pas le confondre avec un échec.
 *
 * Les deux se ressemblent au point d'échec et ne se répondent pas pareil : un
 * serveur en panne, un jeton expiré et un avion en vol produisent tous les
 * trois une requête qui ne revient pas. Déduire « hors connexion » d'un échec
 * ferait promettre « ça repartira au retour du réseau » à quelqu'un dont le
 * compte est simplement fermé — et rien ne repartirait jamais.
 *
 * On lit donc l'état du réseau à la source, et l'échec ne sert qu'à échouer.
 *
 * DEUX CONDITIONS, PAS UNE. `isConnected` dit qu'une interface est montée ;
 * `isInternetReachable` dit que quelque chose répond au bout. Un téléphone
 * accroché à un portail Wi-Fi captif — un hôtel, un aéroport — a la première
 * sans la seconde, et c'est exactement le cas où l'on croit être en ligne et
 * où rien ne passe.
 *
 * TROIS VALEURS, PAS DEUX. `expo-network` rend `undefined` quand la plateforme
 * ne sait pas répondre, et `null` quand la mesure n'est pas encore faite. Les
 * deux disent « ON NE SAIT PAS », et se traitent donc pareil : on laisse
 * passer. Seul un `false` franc retient quelque chose.
 *
 * C'est le sens qui compte, pas la valeur : retenir une action sur une absence
 * de mesure ferait attendre quelqu'un dont le réseau va parfaitement — et la
 * toute première action d'une session tombe précisément dans cette fenêtre.
 */
export interface EtatDuReseau {
  isConnected?: boolean | null | undefined;
  isInternetReachable?: boolean | null | undefined;
}

export function horsConnexion(etat: EtatDuReseau | null): boolean {
  // Aucune mesure encore : on ne retient rien. Voir ci-dessus.
  if (etat === null) return false;
  if (etat.isConnected === false) return true;
  return etat.isInternetReachable === false;
}

/* L'ÉTAT COURANT, lisible HORS DE REACT.
 *
 * `appel` n'est pas un composant : il ne peut pas lire un contexte, et c'est
 * pourtant lui qui doit savoir s'il faut se replier sur le cache. Le provider
 * est l'unique écrivain — un second ferait deux vérités, et celle qui reste en
 * arrière déciderait de se replier alors que le réseau est revenu.
 *
 * Par DÉFAUT en ligne : au tout premier appel, avant la moindre mesure, il vaut
 * mieux essayer le réseau et échouer que se replier sur un cache vide en
 * annonçant une panne qui n'existe pas.
 */
let courant: EtatDuReseau | null = null;

export function poseLEtatDuReseau(etat: EtatDuReseau | null): void {
  courant = etat;
}

export function estHorsConnexion(): boolean {
  return horsConnexion(courant);
}
