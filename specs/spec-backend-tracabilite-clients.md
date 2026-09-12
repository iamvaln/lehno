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

### `ClientVersionSeen` — l'agrégat

```prisma
model ClientVersionSeen {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  /// Le JOUR, pas l'instant. C'est la granularité de la question posée :
  /// « quelles versions nous appellent cette semaine ». À l'heure près, la table
  /// serait vingt-quatre fois plus grosse pour une précision dont personne n'a
  /// l'usage.
  day         DateTime @db.Date
  /// Nul pour un appel sans en-têtes — en phase 1, c'est le cas le plus fréquent,
  /// et c'est justement ce qu'on vient mesurer.
  clientId    String?  @map("client_id") @db.VarChar(64)
  clientType  String?  @map("client_type") @db.VarChar(20)
  appVersion  String?  @map("app_version") @db.VarChar(20)
  /// Découpé à l'entrée depuis `X-App-OS` : `ios:17.4` donne `ios` et `17.4`.
  /// On découpe UNE fois, au bord, plutôt que de laisser chaque lecture le
  /// refaire — et une lecture qui oublie de découper compte « ios:17.4 » et
  /// « ios:17.5 » comme deux systèmes différents.
  osName      String?  @map("os_name") @db.VarChar(20)
  osVersion   String?  @map("os_version") @db.VarChar(20)
  calls       BigInt   @default(0)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  /// LA CLÉ DE L'AGRÉGAT. C'est elle qui fait tenir la table : un `upsert` sur
  /// cette combinaison, jamais un `insert` par requête.
  @@unique([day, clientId, clientType, appVersion, osName, osVersion])
  @@index([day])
  @@map("client_version_seen")
}
```

**Postgres traite les nuls comme distincts dans un index unique.** Un appel sans
en-têtes créerait donc une ligne par requête — exactement ce qu'on voulait
éviter. Deux façons de s'en sortir, à trancher : un index unique sur des
`COALESCE(..., '')`, ou des colonnes non nulles avec `''` comme valeur
d'« inconnu ». **Proposé** : la seconde, plus simple à lire et à requêter, avec un
commentaire qui dit pourquoi `''` et non `NULL`.

### Ce que les tables existantes gagnent

`ai_usage`, `action_run` et `login_activity` reçoivent `client_id`,
`client_type`, `app_version`. Nullables, et pour de bon : les lignes d'avant ce
lot n'ont pas cette information, et rien ne peut l'inventer.

C'est ce que fait monjeton sur son journal d'appels IA. On l'élargit aux deux
autres parce que ce sont les trois tables qu'on relit quand quelque chose coûte
ou surprend.

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

## 5. L'agrégat ne ralentit pas la requête

Le comptage est un `upsert` — donc une écriture — et il ne doit **jamais** être
sur le chemin de la réponse.

**Proposé** : une file en mémoire, vidée toutes les dix secondes en un seul
`upsert` par combinaison vue. Le processus qui s'arrête perd au pire dix secondes
de compteurs, ce qui est sans conséquence sur un agrégat quotidien — et c'est le
bon échange contre une écriture par requête.

L'ordonnanceur du dépôt sait déjà faire tourner ce genre de passage.

---

## 6. L'administration

- `GET admin/api-clients` — la liste, avec le dernier jour vu.
- `POST admin/api-clients` — crée une paire. **La clé s'affiche une fois**, et
  jamais plus.
- `POST admin/api-clients/{id}/rotate` — une clé neuve, l'identifiant inchangé.
- `PATCH admin/api-clients/{id}` — activer, désactiver.
- `GET admin/client-versions?depuis=&jusqu=` — **la lecture qui justifie tout ça**.

Les trois écritures passent par le motif d'audit, comme le reste de
l'administration : couper un client coupe une application entière, et personne ne
doit pouvoir le faire sans laisser son nom.

---

## 7. Les phases, côté serveur

**Phase 1** — les deux modèles, le middleware en mode observation, les quatre
champs dans le journal, l'agrégat et son passage. Rien ne refuse rien.

**Phase 2** — la garde derrière son paramètre. À n'allumer que quand l'agrégat
montre que les appels portent leurs en-têtes.

**Phase 3** — `MobileVersionPolicy` : `min_supported` et `latest` par plateforme,
**426** en dessous du minimum avec le lien du magasin, en-tête de suggestion
au-dessus. Repris de monjeton presque tel quel.

**Phase 4** — l'écran d'administration.

---

## 8. Ce qui est à trancher avant d'écrire

1. **`/v1/auth/*` sous garde ou non** (§3). J'incline vers « sous garde », mais
   c'est un choix qui se voit tout de suite.
2. **`''` ou `NULL`** pour l'inconnu dans l'agrégat (§1). J'incline vers `''`.
3. **`X-App-Env` comparé au client, ou seulement noté ?** Refuser un build de
   staging qui pointe la production est tentant — mais c'est aussi le moyen le
   plus sûr de se couper un jour d'urgence. **Proposé** : on le note et on le
   signale, on ne refuse pas.
4. **La rétention de l'agrégat** — dix-huit mois proposés au plan.
