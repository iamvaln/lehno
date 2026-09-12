# Traçabilité des clients — le serveur

*12 septembre 2026. Détaille `plan-tracabilite-des-clients-2026-09-12.md`. Lisez
le §3 du plan avant celui-ci : il dit ce que la clé vaut, et tout le reste en
découle.*

---

## 1. Le modèle

### `ApiClient`

```prisma
model ApiClient {
  id          String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  /// Voyage en clair dans `X-Client-Id`. Lisible, court, et il ne change JAMAIS
  /// pour un même client : c'est lui qui rend les chiffres comparables d'un
  /// trimestre à l'autre. La clé, elle, tourne.
  clientId    String        @unique @map("client_id") @db.VarChar(64)
  label       String        @db.VarChar(100)
  clientType  ApiClientType @map("client_type")
  /// L'environnement que ce client DIT servir. Un build de staging qui pointe la
  /// production se voit ici, en comparant avec `X-App-Env`.
  environment ApiClientEnv
  /// SHA-256 de la clé, jamais la clé. Voir §2 : on ne la relit pas, on la
  /// remplace — et une clé qu'on ne peut pas relire ne fuite pas par la base.
  keyHash     String        @map("key_hash") @db.VarChar(64)
  /// Coupe ce client sans le supprimer : les lignes déjà notées gardent leur
  /// référence, et l'historique reste lisible.
  isActive    Boolean       @default(true) @map("is_active")
  rotatedAt   DateTime?     @map("rotated_at") @db.Timestamptz
  createdAt   DateTime      @default(now()) @map("created_at") @db.Timestamptz

  @@index([isActive])
  @@map("api_client")
}

enum ApiClientType { mobile_ios  mobile_android  web }
enum ApiClientEnv  { dev  staging  prod }
```

**`clientType` est déclaré ici ET envoyé par le client**, et les deux doivent
concorder. Ce n'est pas une redondance : un `X-Client-Type` qui ne correspond pas
à ce qui est enregistré dit qu'une clé circule hors de son build, et c'est
exactement ce qu'on veut voir. C'est le contrôle de monjeton, et il vaut d'être
repris.

### Ce que les tables historisées gagnent

*Révisé le 12 septembre après arbitrage. La première version posait une table
d'agrégat quotidien. Elle est retirée : **ce sont des logs, du verbeux**, et ces
mêmes champs sur tout ce qui est déjà historisé. Le §5.4 du plan dit pourquoi, et
à quelle condition on y reviendrait.*

Six tables, et la règle est la même pour toutes : **une ligne qu'on relira un
jour pour comprendre ce qui s'est passé dit d'où elle vient.**

```prisma
/// Portés par login_activity, audit_log, ai_usage, action_run,
/// credit_transaction et payment.
///
/// NULLABLES POUR DE BON, et pas le temps d'une migration : les lignes d'avant
/// ce lot n'ont pas cette information, et rien ne peut l'inventer. Leur poser
/// une valeur courante serait pire qu'un trou — ce serait une donnée fausse.
clientId   String? @map("client_id")   @db.VarChar(64)
clientType String? @map("client_type") @db.VarChar(20)
appVersion String? @map("app_version") @db.VarChar(20)
osName     String? @map("os_name")     @db.VarChar(20)
osVersion  String? @map("os_version")  @db.VarChar(20)
```

`login_activity` montre déjà la forme : elle porte `ip`, `user_agent` et
`geo_approx`. Ce lot lui ajoute ce qui manquait — de quelle application, dans
quelle version.

**`osName` et `osVersion` séparés, jamais la chaîne composée.** `X-App-OS` arrive
en `ios:17.4` et se découpe **une fois, au bord**. Une lecture qui oublierait de
découper compterait `ios:17.4` et `ios:17.5` comme deux systèmes différents.

### L'IP sur les deux tables de transaction

`credit_transaction` et `payment` gagnent en plus :

```prisma
/// L'ORIGINE DE LA DÉCLARATION, et c'est un ÉCART ASSUMÉ à la doctrine du
/// dépôt : `auth.controller.ts` écrit que l'IP « ne sert qu'à composer la clé du
/// limiteur […] : elle n'est ni journalisée ni renvoyée ».
///
/// Une transaction n'est pas une requête ordinaire : elle SE CONTESTE. En mode
/// semi-manuel, quelqu'un déclare avoir payé, un administrateur décide, et des
/// crédits changent de main. Le jour où deux récits s'opposent, l'origine de la
/// déclaration est souvent la seule chose qui tranche — et elle ne se
/// reconstitue pas après coup. `login_activity` fait déjà ça pour les
/// connexions, avec le même raisonnement.
///
/// `Inet` comme sur `login_activity`, pas `VarChar` : le type dit ce que c'est,
/// et Postgres refuse alors ce qui n'est pas une adresse.
ip String? @db.Inet
```

**Elle se lit par `req.ip`**, dont la valeur dépend du réglage « trust proxy »
posé au démarrage. **Jamais `X-Forwarded-For` directement** : sans borne déclarée,
n'importe qui forgerait son origine — c'est ce que `common/trust-proxy.ts` évite
déjà, et il refuse d'ailleurs la valeur `true`.

**Ce qu'il faut assumer** : une transaction se garde pour la comptabilité, donc
plus longtemps qu'un journal. L'IP la suit. C'est une donnée personnelle qui vit
le temps de la pièce, et l'export comme l'effacement du compte doivent la traiter
comme telle — voir le point 4 du §7 du plan.

---

## 2. La clé, et comment on la traite

**On ne la stocke jamais en clair.** `keyHash` porte un SHA-256, et la commande
qui crée un client **l'affiche une fois** puis l'oublie. Une clé perdue ne se
récupère pas : elle se **remplace**.

> SHA-256 nu et non bcrypt/argon2, contrairement à un mot de passe. La raison est
> la longueur : une clé engendrée fait 32 octets aléatoires, donc il n'y a rien à
> deviner par force brute — le coût d'un hachage lent n'achèterait rien et
> ajouterait une dizaine de millisecondes à **chaque** requête.

**La comparaison est en temps constant** (`crypto.timingSafeEqual`). Comparer
deux chaînes avec `===` s'arrête au premier octet différent, et le temps de
réponse dit alors combien d'octets étaient justes.

**Le refus ne dit pas laquelle des deux valeurs est fausse.** `client_id` inconnu,
clé fausse, client désactivé : un seul code côté client, trois codes distincts
côté journal. Un attaquant n'apprend rien ; nous, tout.

---

## 3. Le middleware

Il s'insère **après** la corrélation — qui existe déjà — et **avant** tout le
reste, pour que chaque ligne de journal porte à la fois l'identifiant de
corrélation et l'origine.

```
1. lire les en-têtes
2. résoudre le client (avec cache, §4)
3. poser le contexte sur la requête
4. PHASE 1 : ne rien refuser — PHASE 2 : refuser si absent ou invalide
5. compter dans l'agrégat, SANS attendre (§5)
```

### Les chemins hors garde

| chemin | pourquoi |
| --- | --- |
| `/health` | l'appelant est la supervision, qui n'a pas de build |
| `/public/*` | un lien de liste s'ouvre dans le navigateur de quelqu'un qui n'a **aucune** application installée. Y poser la garde fermerait le partage, qui est le cœur du produit |
| `/v1/auth/*` ? | **à trancher.** Une application doit s'identifier avant de connecter quelqu'un — donc non exempté à mon sens. Mais ça veut dire que le tout premier appel d'un build neuf doit déjà porter ses en-têtes |

Les appels hors garde se comptent quand même, avec un client nul. Savoir combien
d'ouvertures de liens partagés on reçoit a sa valeur.

### Phase 1 : on regarde, on ne bloque pas

Un appel sans en-têtes **passe**, et se note « inconnu ». Bloquer d'emblée
couperait les applications déjà installées — et on l'apprendrait en production.

Le passage en phase 2 est **un paramètre système** (`api_client_guard_enabled`),
pas un déploiement : coupable en une minute si quelque chose dérape. C'est la
même forme que les drapeaux de fonctionnalité du dépôt.

---

## 4. Le cache, et pourquoi il n'est pas facultatif

Sans lui, **une lecture en base par requête** pour un objet qui change une fois
par trimestre.

monjeton met en cache soixante secondes, **y compris les échecs** — sinon un
`client_id` inconnu, répété, ferait une lecture à chaque fois : c'est
précisément le profil d'un script qui tâtonne, donc le cas où le cache sert le
plus.

On reprend les deux, avec la même invalidation explicite quand l'admin coupe ou
tourne une clé : soixante secondes d'attente pour révoquer une clé compromise,
c'est cinquante-neuf de trop.

---

## 5. Rien de tout ça ne ralentit la requête

La ligne de journal s'écrit sur la sortie standard : coût négligeable, et aucune
écriture en base.

**Les six champs sur les tables historisées ne coûtent rien non plus**, et c'est
le point : ces lignes s'écrivent déjà. On ajoute des colonnes à un `insert` qui
a lieu de toute façon, on n'en provoque aucun.

C'est précisément ce que la première version de cette spec perdait de vue en
proposant un agrégat : elle ajoutait une écriture par requête pour une question
qu'un `grep` résout. Voir le §5.4 du plan.

### Le contexte se pose une fois

Le middleware range ce qu'il a lu sur la requête. Tout ce qui écrit ensuite —
`login_activity`, `ai_usage`, `action_run`, `payment` — le relit de là.

**Le lire deux fois serait la porte ouverte à deux lectures qui divergent** : un
service qui découperait `X-App-OS` à sa façon, un autre qui prendrait l'en-tête
brut. Un point de lecture, un point de découpe.

## 6. L'administration

- `GET admin/api-clients` — la liste, avec le dernier jour vu.
- `POST admin/api-clients` — crée une paire. **La clé s'affiche une fois**, et
  jamais plus.
- `POST admin/api-clients/{id}/rotate` — une clé neuve, l'identifiant inchangé.
- `PATCH admin/api-clients/{id}` — activer, désactiver.
Pas de route de lecture des versions : il n'y a pas d'agrégat à lire. La question
« quelles versions nous appellent » se pose au journal, et c'est suffisant tant
qu'elle se pose de temps en temps.

Les trois écritures passent par le motif d'audit, comme le reste de
l'administration : couper un client coupe une application entière, et personne ne
doit pouvoir le faire sans laisser son nom.

---

## 7. Les phases, côté serveur

**Phase 1** — `ApiClient`, le middleware en mode observation, les six champs
dans la ligne de journal, l'origine sur les six tables historisées, et l'IP sur
les deux tables de transaction. Rien ne refuse rien.

**Phase 2** — la garde derrière son paramètre. À n'allumer que quand l'agrégat
montre que les appels portent leurs en-têtes.

**Phase 3** — `MobileVersionPolicy` : `min_supported` et `latest` par plateforme,
**426** en dessous du minimum avec le lien du magasin, en-tête de suggestion
au-dessus. Repris de monjeton presque tel quel.

**Il n'y a pas de phase 4.** La première version en prévoyait une pour un écran
au-dessus de l'agrégat. L'agrégat n'est plus au plan, donc l'écran non plus.

---

## 8. Ce qui est à trancher avant d'écrire

1. **`/v1/auth/*` sous garde ou non** (§3). J'incline vers « sous garde », mais
   c'est un choix qui se voit tout de suite.
2. **L'IP sur les transactions et l'effacement du compte** (§1). Une pièce
   comptable ne s'efface pas ; son IP peut se retirer. À décider avec ce que
   l'export de données doit en montrer.
3. **`X-App-Env` comparé au client, ou seulement noté ?** Refuser un build de
   staging qui pointe la production est tentant — mais c'est aussi le moyen le
   plus sûr de se couper un jour d'urgence. **Proposé** : on le note et on le
   signale, on ne refuse pas.
4. **`audit_log` porte-t-il aussi l'IP ?** Un geste d'administration se conteste
   autant qu'un paiement. Je ne l'ai pas mis pour ne pas élargir sans qu'on en
   parle, mais l'argument du §1 vaut à l'identique.
