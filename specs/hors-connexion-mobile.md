# Hors connexion — ce que l'application tient quand le réseau lâche

La copie promet **deux** choses, et ce sont deux chantiers différents :

> « Hors connexion. **Vos notes et vos dates restent consultables.** »
> « Hors connexion. **3 actions repartiront** au retour du réseau. »

La première est un **cache de lecture**. La seconde est une **file d'écritures**.
Aujourd'hui ni l'une ni l'autre n'existe : une requête qui échoue faute de réseau
affiche une erreur générique, et rien n'est consultable.

---

## 1. Savoir qu'on est hors connexion

`expo-network` plutôt que `@react-native-community/netinfo` : même famille que
le reste de la pile, pas de module natif de plus à tenir à jour à chaque montée
de SDK.

**Hors connexion n'est pas « la requête a échoué ».** Les deux se confondent
facilement et il ne faut pas : un serveur en panne, un jeton expiré et un avion
en vol se ressemblent au point d'échec, et se répondent différemment. On lit
l'état du réseau, on ne le déduit pas d'un échec.

---

## 2. Le cache de lecture

**Ce qu'on garde** : les réponses des `GET`, telles que le serveur les a
rendues — le corps BRUT, jamais l'objet déjà analysé.

*Pourquoi le brut* : on le repasse par le schéma à la relecture. Un corps mis en
cache par une version précédente de l'application, que le contrat ne décrit plus,
**tombe alors au parsage et se jette** au lieu de remonter en objet malformé
jusqu'à l'écran. Stocker l'objet analysé ferait sauter cette garde exactement le
jour où elle sert.

**Ce qu'on ne garde pas** : tout ce qui n'est pas un `GET`, et tout ce qui porte
un solde ou un montant. Un solde de crédits vieux d'une journée montré sans
mention est pire qu'un solde absent — on décide d'acheter sur un chiffre faux.

**Quand ça part** : à la déconnexion, **entièrement**. Le cache contient des
noms, des dates de naissance et des notes intimes. Un compte quitté sur un
téléphone prêté ne doit rien laisser derrière lui. C'est la seule règle de ce
document qui ne souffre aucune exception.

**Ce que l'écran dit** : la bannière `OfflineBanner`, et rien de plus — pas de
date de fraîcheur par ligne. « Vos notes restent consultables » suffit à
expliquer pourquoi la liste ne bouge pas ; dater chaque élément apprendrait à
se méfier de tout, y compris de ce qui est juste.

---

## 3. La file d'écritures — et la contrainte qui la façonne

**Deux points d'écriture sur trente-quatre acceptent une clé d'idempotence** :
la génération et le démarrage d'un paiement. Partout ailleurs, rejouer un `POST`
crée un second objet.

C'est ce qui décide de l'architecture, et non l'inverse.

### La règle : on ne met en file que ce qui n'est jamais parti

Si l'appareil est **su hors connexion avant l'envoi**, la requête n'a pas quitté
le téléphone : le serveur ne l'a pas vue, la rejouer ne peut rien dupliquer.
C'est sûr sans rien changer au serveur.

Si la requête est **partie et que l'issue est inconnue** — délai dépassé,
réponse perdue — elle **ne va pas en file**. Le serveur l'a peut-être exécutée.
La rejouer créerait la deuxième note, la deuxième fiche, le deuxième souhait. On
le dit à la personne, qui décidera.

Cette règle dit exactement ce que la copie promet : « 3 actions repartiront »
compte les actions **retenues**, pas les actions douteuses.

### Ce qui ne va JAMAIS en file, même retenu

- **Déclarer un versement** et tout ce qui touche à l'argent. Rejouer un
  versement des heures plus tard, sans personne devant l'écran, engage une somme
  que personne ne revoit partir.
- **Fermer son compte**, et le code qui le confirme. Un geste irréversible ne
  se différe pas.
- **Se déconnecter.** Elle doit aboutir tout de suite, localement, sans
  attendre le réseau — c'est déjà le cas et ça ne change pas.

### L'ordre, et l'arrêt

FIFO strict. Une action qui échoue au rejeu **arrête la file** au lieu d'être
sautée : une note adressée à une fiche dont la création vient d'échouer
n'atterrirait nulle part, et la suivante non plus. Mieux vaut une file bloquée
qu'on voit qu'une file qui se vide en perdant la moitié.

---

## Ce qui reste à trancher

- **Où stocker.** `SecureStore` est plafonné (2 Ko par entrée sur Android) :
  inutilisable pour un cache. `AsyncStorage` ou `expo-file-system` — une
  dépendance de plus dans les deux cas. Le sandbox du système protège déjà le
  répertoire de l'application ; un chiffrement au repos par-dessus se discute.
- **Combien de temps garder.** Une durée trop courte vide le cache avant qu'il
  serve, trop longue montre des dates périmées. À décider par écran, pas
  globalement.
- **Une clé d'idempotence générale côté serveur** rendrait la file bien plus
  utile — elle pourrait alors rejouer aussi les envois douteux. C'est un
  chantier serveur, pas mobile, et il change ce document.
