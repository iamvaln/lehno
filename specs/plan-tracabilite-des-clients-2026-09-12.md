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

## 5. Où la trace se pose

*Révisé le 12 septembre après arbitrage. La première version faisait d'un
agrégat quotidien la pièce centrale. Ce n'est pas ce qu'on cherche : **ce sont
des logs, du verbeux** — et ces mêmes champs sur tout ce qui est déjà historisé.*

### 5.1 La ligne de journal, à chaque requête

Ce que le serveur écrit déjà sur sa sortie standard gagne les champs des
en-têtes : `clientId`, `clientType`, `appVersion`, `osName`, `osVersion`, `env`.

Coût nul en base. C'est ce qu'on lit pendant un incident, à côté de
l'identifiant de corrélation qui existe déjà — et les deux ensemble suffisent à
suivre un appel de bout en bout.

**C'est le cœur du lot.** Le reste en découle.

### 5.2 Tout ce qui est historisé porte l'origine

La règle, et elle est simple : **une ligne qu'on relira un jour pour comprendre
ce qui s'est passé dit d'où elle vient.**

| table | ce qu'elle garde | ce qu'elle gagne |
| --- | --- | --- |
| `login_activity` | les connexions — porte déjà `ip` et `user_agent` | le client, le type, la version |
| `audit_log` | les gestes d'administration | idem — quelle version du panneau. **Pas l'IP** : voir le §8.4 de la spec backend |
| `ai_usage` | ce qu'un appel de modèle a coûté | idem — quel build a déclenché la dépense |
| `action_run` | ce qui a été payé en crédits | idem |
| `credit_transaction` | les mouvements de crédit | idem **+ l'IP** (§5.3) |
| `payment` | les paiements | idem **+ l'IP** (§5.3) |

`login_activity` montre la forme à suivre : elle porte déjà `ip`, `user_agent` et
`geo_approx`. Ce lot lui ajoute simplement ce qui manquait — de quelle
application, dans quelle version.

### 5.3 L'IP sur les transactions, et pourquoi c'est un écart assumé

**Le dépôt a une doctrine sur l'IP, et elle est explicite.** `auth.controller.ts`
l'écrit :

> « Cette IP ne sert qu'à composer la clé du limiteur […] : elle n'est ni
> journalisée ni renvoyée ici. »

La poser sur `credit_transaction` et `payment` est donc un écart, et il se
justifie plutôt qu'il ne se glisse.

**Une transaction n'est pas une requête ordinaire.** Elle se conteste. En mode
semi-manuel, quelqu'un déclare avoir payé, un administrateur décide, et des
crédits changent de main. Le jour où deux récits s'opposent, l'origine de la
déclaration est souvent la seule chose qui tranche — et elle ne se reconstitue
pas après coup.

`login_activity` fait déjà exactement ça pour les connexions, avec le même
raisonnement : ce sont les gestes qu'on relit quand quelque chose cloche.

**Ce que ça implique, et qu'il faut assumer** : une transaction se garde pour la
comptabilité, donc plus longtemps qu'un journal. L'IP la suit. C'est une donnée
personnelle qui vit le temps de la pièce comptable, et l'export comme
l'effacement du compte doivent la traiter comme telle.

L'IP se lit par `req.ip`, dont la valeur dépend du réglage « trust proxy » déjà
posé au démarrage. **Jamais `X-Forwarded-For` directement** : sans borne, chacun
forgerait son origine.

### 5.4 Ce qu'on ne fait PAS

**Pas de journal par requête en base.** La ligne de journal suffit, et une table
qui grossirait sans borne pour répondre à « quelles versions nous appellent »
coûterait cent fois ce que la question vaut.

Si un jour cette question se pose assez souvent pour mériter mieux qu'un `grep`,
un **agrégat quotidien** — une ligne par (jour, client, version, système), avec un
compteur — la résout en quelques dizaines de lignes par jour. **Ce n'est pas dans
ce lot**, et il ne faut pas le préparer « au cas où » : le journal répond déjà, et
une table qu'on remplit sans la lire est une table qu'on finit par croire.

*À savoir si on y vient un jour* : gabee compte en **appareils** et non en
appels — une ligne par appareil, `upsert` sur son identifiant, avec `lastSeen`.
C'est la bonne unité pour « combien d'appareils sont restés sur l'ancienne
version », qui est la question qui décide d'une mise à jour forcée. Dix appels
d'un même téléphone ressemblent à dix dans un compteur d'appels.

## 6. Les phases

**Phase 1 — la trace, sans rien bloquer.** Le modèle `ApiClient`, la lecture des
en-têtes, les six champs dans la ligne de journal, et l'origine sur les six
tables historisées — IP comprise sur les deux tables de transaction. **Le
middleware n'interdit rien** : un appel sans en-têtes passe et se note
« inconnu ».

C'est délibéré. Bloquer d'emblée couperait les applications déjà installées, qui
n'envoient rien — et on découvrirait la panne en production. On commence par
regarder.

**Phase 2 — la garde.** Une fois que le journal montre que tous les appels
portent leurs en-têtes, on refuse ceux qui n'en ont pas : 403, avec un code
distinct par cause. Le passage de la phase 1 à la phase 2 est **un réglage**, pas
un déploiement — un paramètre système, coupable en une minute si quelque chose
dérape.

**Phase 3 — la politique de version.** `min_supported` et `latest` par
plateforme, **426** en dessous du minimum, et un en-tête de suggestion au-dessus.
C'est ce qui permet de retirer un chemin sans casser les téléphones qui ne se
mettent pas à jour.

**Il n'y a pas de phase 4.** La première version de ce plan en prévoyait une pour
un écran d'administration au-dessus d'un agrégat. L'agrégat n'est plus au plan
(§5.4), donc l'écran non plus.

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

4. **L'IP sur les transactions et l'effacement du compte.** Elle vit le temps de
   la pièce comptable, donc plus longtemps que le reste. **À confirmer** : ce que
   l'export de données en montre, et ce que l'effacement d'un compte en fait —
   une pièce comptable ne s'efface pas, mais son IP peut se retirer.

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
