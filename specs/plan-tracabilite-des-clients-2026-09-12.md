# Savoir qui nous appelle, et avec quelle version

*12 septembre 2026. Le plan. Les trois documents qui suivent le détaillent par
surface : `spec-backend-tracabilite-clients.md`,
`spec-mobile-tracabilite-clients.md`, `spec-web-tracabilite-clients.md`.*

**Rien n'est implémenté.** Ce document existe pour être discuté avant de l'être.

---

## 1. Ce qu'on cherche

Quand un incident arrive — un appel qui coûte cher, une erreur qui ne se
reproduit pas, un comportement qu'on ne comprend pas —, la première question est
toujours la même : **qui appelait, depuis quelle application, dans quelle
version ?**

Aujourd'hui on ne peut y répondre pour aucune requête. Lehno n'a que deux
journaux : `login_activity`, qui note les connexions, et `audit_log`, qui note
les gestes d'administration. Entre les deux, les milliers d'appels ordinaires ne
laissent aucune trace de leur origine.

Le second besoin découle du premier : **savoir quelles versions parlent encore au
serveur**. C'est ce qui décide quand on peut retirer un chemin, changer une
forme, ou forcer une mise à jour.

---

## 2. Ce que monjeton a déjà, et ce qu'on en reprend

*Lu le 12 septembre dans `/Users/valentine/dev/monjeton`.*

| | monjeton | ce qu'on en fait |
| --- | --- | --- |
| `ApiClient` — `client_id`, `name`, `client_type`, `is_active` | ✅ | **repris**, avec une clé en plus (§3) |
| Garde en middleware, 403 si inconnu ou désactivé | ✅ | **repris** |
| Cache 60 s du client, invalidé par l'admin | ✅ | **repris** — sans lui, une lecture en base par requête |
| `X-Client-Id`, `X-Client-Type`, `X-App-Version`, `X-App-OS`, `X-App-Env` | ✅ | **mêmes noms**, et c'est délibéré (§4) |
| `MobileVersionPolicy` — min/latest par plateforme, **426** en dessous | ✅ | **repris**, mais en phase 3 |
| `client_type` et `api_client_id` sur le journal des appels IA | ✅ | **élargi** — voir §5 |
| Une **clé secrète** par client | ❌ absent | ajoutée, mais lisez le §3 avant |

**Ce que monjeton fait et qu'on ne reprend pas** : il n'a pas de journal par
requête. Il attache l'origine aux lignes qui persistent déjà — les appels IA. On
fait pareil, et on ajoute un agrégat (§5).

---

## 3. La clé : ce qu'elle achète, et ce qu'elle n'achète pas

Vous demandez une paire `client-id` / `api-key` par build. Elle est dans le plan.
Mais il faut écrire noir sur blanc ce qu'elle vaut, sinon quelqu'un s'y fiera un
jour comme à une authentification.

> **Une clé livrée dans un binaire mobile ou un paquet web n'est pas un secret.**
> Elle s'extrait d'un `.ipa`, d'un `.apk`, ou d'un `Ctrl-U` sur le site. Tout
> client public est, par construction, un client dont le secret est public.

Ce qu'elle apporte quand même, et qui n'est pas rien :

- **Elle se révoque sans changer l'identifiant.** Une clé compromise se tourne ;
  le `client_id` reste, donc les statistiques restent comparables dans le temps.
  C'est le vrai gain, et monjeton ne l'a pas.
- **Elle relève la barre.** Un script qui veut passer doit d'abord extraire la
  clé du binaire. Ça n'arrête pas quelqu'un de déterminé ; ça arrête le reste.
- **Elle sépare les builds.** Une clé par build permet de couper *une* version
  sans couper les autres — un build de test, un build interne, un build dont on
  découvre qu'il envoie n'importe quoi.

Ce qu'elle **n'apporte pas**, et qu'il ne faut pas lui demander :

- ce n'est **pas** une frontière de sécurité. La frontière reste le jeton de
  l'utilisateur ;
- elle ne prouve **pas** qu'une requête vient bien de notre application ;
- elle ne remplace **pas** la limitation de débit, qui reste sur l'IP et le
  compte.

**Conséquences de conception** (détaillées dans la spec backend) : la clé est
**stockée hachée**, jamais en clair ; elle se compare en temps constant ; et le
refus ne dit pas laquelle des deux valeurs est fausse.

---

## 4. Les noms d'en-têtes : les mêmes que monjeton

```
X-Client-Id      l'identifiant du build
X-Client-Key     la clé appariée
X-Client-Type    MOBILE_IOS | MOBILE_ANDROID | WEB
X-App-Version    semver simple — 1.4.2
X-App-OS         ios:17.4  /  android:14
X-App-Env        dev | staging | prod
```

**Reprendre les noms de monjeton est une décision, pas de la paresse.** Les deux
produits vivent sur la même machine et se regardent avec les mêmes outils ; des
noms différents pour la même chose obligeraient à tenir deux jeux de requêtes,
deux tableaux de bord et deux habitudes. Le seul ajout est `X-Client-Key`, qui
n'existe pas là-bas.

`X-App-OS` porte deux informations en une chaîne, ce qui n'est pas élégant. On le
garde tel quel pour la même raison — et le serveur le découpe à l'entrée, une
fois, plutôt que de laisser chaque lecture le refaire.

---

## 5. Où la trace se pose : trois niveaux, et pas un journal par requête

**Un journal par requête est le réflexe, et c'est le mauvais.** À quelques
centaines de milliers d'appels par mois, la table grossit sans borne pour
répondre à une question — « quelles versions nous appellent » — qu'un compteur
résout en mille fois moins de place.

### Niveau 1 — la ligne de journal, à chaque requête

Ce que le serveur écrit déjà sur sa sortie standard gagne quatre champs :
`clientId`, `clientType`, `appVersion`, `appOs`. Coût nul en base, et c'est ce
qu'on lit pendant un incident, à côté de l'identifiant de corrélation qui existe
déjà.

### Niveau 2 — l'agrégat quotidien, pour la question qui se pose vraiment

Une table `client_version_seen` : une ligne par **(jour, client, plateforme,
version d'app, version d'OS)**, avec un compteur. Quelques dizaines de lignes par
jour au lieu de centaines de milliers.

Elle répond à « quelles versions parlent encore au serveur », « depuis quand
cette version a disparu », « combien d'appareils sont restés sur l'ancienne » —
sans qu'aucune requête n'écrive une ligne à elle.

### Niveau 3 — l'origine sur ce qui persiste déjà

Les lignes qu'on relit quand quelque chose coûte ou surprend gagnent le client et
la version : `ai_usage`, `action_run`, `login_activity`. C'est ce que fait
monjeton, et c'est ce qui permet de dire « cet appel à 0,40 $ vient du build
Android 1.4.2 ».

---

## 6. Les phases

**Phase 1 — la trace, sans rien bloquer.** Le modèle `ApiClient`, la lecture des
en-têtes, les quatre champs dans le journal, l'agrégat quotidien. **Le middleware
n'interdit rien** : un appel sans en-têtes passe et se note « inconnu ».

C'est délibéré. Bloquer d'emblée couperait les applications déjà installées, qui
n'envoient rien — et on découvrirait la panne en production. On commence par
regarder, et on voit ce qui arrive.

**Phase 2 — la garde.** Une fois que le journal montre que tous les appels
portent leurs en-têtes, on refuse ceux qui n'en ont pas : 403, avec un code
distinct pour chaque cause. Le passage de la phase 1 à la phase 2 est **un
réglage**, pas un déploiement — un paramètre système, coupable en une minute si
quelque chose dérape.

**Phase 3 — la politique de version.** `min_supported` et `latest` par
plateforme, **426** en dessous du minimum, et un en-tête de suggestion au-dessus.
C'est ce qui permet de retirer un chemin sans casser les téléphones qui ne se
mettent pas à jour.

**Phase 4 — la lecture au panneau.** « Quelles versions nous appellent, et
combien », par semaine. Sans elle, l'agrégat est une table que personne ne
regarde.

---

## 7. Ce qui reste à trancher

Ces points ne sont pas des détails de mise en œuvre : ils changent le travail.

1. **Les surfaces publiques.** `/public/wishlists/{token}` s'ouvre depuis un lien
   reçu, dans le navigateur de quelqu'un qui n'a aucune application installée. La
   garde ne peut pas s'y appliquer. **Proposé** : `/public/*` et `/health` sont
   hors garde, et leurs appels se notent « sans client ».

2. **Une clé par build, ou une par plateforme ?** Une par build permet de couper
   une version précise, mais demande de créer une paire à chaque publication —
   et de la porter dans la chaîne de compilation. Une par plateforme est
   nettement plus simple et suffit à répondre à « qui nous appelle ».
   **Proposé** : une par plateforme et par environnement — soit six paires
   (ios, android, web) × (staging, prod) —, la version venant de `X-App-Version`
   et non de la clé.

3. **Où vivent les clés côté client ?** Mobile : variables de compilation EAS.
   Web : variable d'environnement au moment de la construction. Dans les deux
   cas elles **se retrouvent dans le binaire livré**, ce qui est le §3. À
   confirmer : ces valeurs ne passent **pas** par `.env` du dépôt, qui n'est
   édité que par le propriétaire.

4. **La rétention de l'agrégat.** Une ligne par jour et par combinaison, ça reste
   petit — mais « petit pour toujours » n'existe pas. **Proposé** : on garde
   dix-huit mois, ce qui couvre deux cycles annuels de comparaison.

5. **`X-App-Env`.** Utile pour ne pas mêler les chiffres du staging à ceux de la
   production. Mais si chaque environnement a déjà ses propres clés (point 2),
   l'en-tête devient redondant. **Proposé** : on le garde quand même, parce qu'il
   permet de **détecter** un build de staging qui pointerait la production — et
   c'est précisément l'incident qu'on veut voir.

---

## 8. Ce que ça ne fait pas

- Ça ne remplace pas la mesure produit. Savoir qu'une version appelle ne dit pas
  ce que les gens en font.
- Ça n'identifie pas un appareil. `X-Device-Id` existe ailleurs dans le produit ;
  le mêler à ceci ferait d'un outil d'exploitation un outil de suivi, et ce n'est
  pas ce qu'on écrit ici.
- Ça ne protège de rien. Voir le §3, qui le dit plus longuement.
