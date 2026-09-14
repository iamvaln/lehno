# Le registre des versions — déclasser une version, forcer une mise à jour

*12 septembre 2026. Phase 3 de
`plan-tracabilite-des-clients-2026-09-12.md`, dont elle remplace le paragraphe
d'origine. La phase 1 — savoir qui appelle — est livrée (#215).*

**Rien n'est implémenté.** Ce document existe pour être discuté avant de l'être.

---

## 1. Ce qu'on veut pouvoir faire

Trois choses, et la troisième est celle qui compte :

1. **Savoir quelles versions existent** — une release publiée est une release
   enregistrée.
2. **Déclasser une version** qu'on ne veut plus servir.
3. **Forcer une mise à jour** quand une release introduit une rupture. Sans ça,
   un changement de contrat casse en silence tous les téléphones qui ne se
   mettent pas à jour — et on l'apprend par les avis du magasin.

---

## 2. Une liste blanche, et le piège qu'elle tend

La demande est : **« on n'accepte pas les requêtes d'une version inconnue »**.

C'est une liste blanche, et elle est plus sévère qu'un plancher de version.
monjeton a délibérément pris le plancher — `min_supported_version` — et il faut
dire pourquoi avant de choisir autrement.

> **Si un build part au magasin sans être enregistré, tous ses utilisateurs sont
> bloqués.** CI qui échoue après la soumission, étape oubliée, release faite à la
> main un dimanche : la panne est totale, elle touche exactement les gens qui
> viennent de mettre à jour, et elle ne se voit qu'à leurs plaintes.

Le plancher n'a pas ce défaut : une version inconnue mais récente passe.

**Ce qu'on propose, qui garde la liste blanche sans le piège** : une version
inconnue ne reçoit pas un refus sec, elle reçoit **« mettez à jour »** — le même
**426** qu'une version déclassée, avec le lien du magasin.

C'est le seul geste sensé pour un client qu'on ne reconnaît pas, et ça change
tout : l'utilisateur voit un écran actionnable au lieu d'une porte close, et le
pire cas d'un oubli d'enregistrement devient « on invite à réinstaller » plutôt
que « l'application ne marche plus ».

**Et l'ordre des opérations le rend rare** : le script d'enregistrement tourne
**avant** la soumission au magasin (§6), jamais après.

---

## 3. Le `buildNumber` ne fait pas que s'ajouter — il sert à comparer

**Comparer des `semver` en chaînes est fautif.** `"1.10.0" < "1.9.0"` est vrai en
tri lexicographique, et c'est exactement le genre de défaut qui ne se voit qu'au
dixième correctif mineur — au moment où l'on en a le plus besoin.

Chaque plateforme a déjà un entier **monotone**, et c'est lui qui doit décider :

| plateforme | ce qui fait foi | ce que c'est |
| --- | --- | --- |
| iOS | `CFBundleVersion` | l'entier que le magasin exige croissant |
| Android | `versionCode` | idem, exigé par Play |
| web | un entier de compilation | posé par la CI, incrémenté à chaque déploiement |

**La version reste**, parce que c'est ce qu'un humain lit — dans un avis, dans un
signalement, dans le panneau. Mais **« plus ancien que » se décide sur le
`buildNumber`**, jamais sur la chaîne.

L'identité d'un build est donc **(plateforme, buildNumber)**. La version est un
libellé attaché, pas une clé.

**Conséquence pour le client** : un en-tête de plus, `x-app-build`. Quand il n'y
a pas de build — développement, Expo Go, diffusion interne —, **on omet
l'en-tête** : ni chaîne vide, ni valeur convenue comme `dev`. L'absence est
honnête ; une chaîne magique devrait se traiter à part partout, et une chaîne
vide ne se distingue pas d'un bug. Le serveur n'accepte que des entiers, et toute
autre valeur vaut « pas de build ».

Cette absence n'atteint jamais la décision, puisque les builds sans numéro sont
hors production, donc exemptés (§5 bis).

---

## 4. Le modèle

```prisma
model AppVersion {
  id          String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  platform    ApiClientType
  /// Ce qu'un humain lit — « 1.4.2 ». Pas une clé : deux builds peuvent porter
  /// la même version, et c'est le cas ordinaire d'un correctif recompilé.
  version     String        @db.VarChar(20)
  /// L'ENTIER MONOTONE, et c'est LUI qui décide de « plus ancien que ».
  /// `CFBundleVersion` sur iOS, `versionCode` sur Android, un compteur de CI
  /// sur le web. Comparer les `semver` en chaînes rendrait « 1.10.0 » plus
  /// ancien que « 1.9.0 ».
  buildNumber Int           @map("build_number")
  /// « À partir d'ici, ce qui précède ne marche plus. » Posé sur la release qui
  /// introduit la rupture, et non sur un plancher qu'il faudrait penser à
  /// relever : c'est au moment où l'on casse quelque chose qu'on le sait.
  forcesUpdate Boolean      @default(false) @map("forces_update")
  /// Déclassée : on ne la sert plus, même si elle est plus récente que le
  /// dernier `forcesUpdate`. Sert à retirer une version fautive qu'on a publiée.
  isRetired   Boolean       @default(false) @map("is_retired")
  /// Ce que l'écran de mise à jour ouvre. Nul pour le web, qui se recharge.
  storeUrl    String?       @map("store_url")
  notes       String?
  publishedAt DateTime      @default(now()) @map("published_at") @db.Timestamptz

  /// Un build par plateforme, et pas deux : c'est la clé d'identité.
  @@unique([platform, buildNumber])
  @@index([platform, buildNumber])
  @@map("app_version")
}
```

---

## 5. La décision, à chaque requête

```
0. si le client n'est pas RECONNU                 → rien (on ne juge pas)
1. si son environnement ENREGISTRÉ n'est pas prod → rien (§5 bis)
2. la plateforme vient de la PAIRE, pas de l'en-tête
3. le build vient de `x-app-build`
4. si le build est absent ou inconnu du registre  → 426
5. si le build est `is_retired`                   → 426
6. soit P = le plus grand buildNumber non retiré de cette plateforme
   qui porte `forcesUpdate`
   si le build < P                                → 426
7. sinon, si un build plus récent existe          → en-tête de suggestion
8. sinon                                          → rien
```

### §5 bis — hors production, le registre ne s'applique pas

*Ajouté le 13 septembre. Ce document ne mentionnait `x-app-env` nulle part, et
c'était un blocage : la session mobile l'a signalé avant que la garde ne
s'allume.*

**Les builds de développement n'ont pas de numéro de build.** `eas.json` porte
`appVersionSource: "remote"` : le numéro n'existe que dans les binaires produits
par EAS. En Expo Go, en build de développement, en diffusion interne, il n'y a
rien à envoyer.

Sans exemption, le §5 les traite comme inconnus et leur rend **426** — donc,
le jour où la garde s'allume, **toute l'équipe et tous les testeurs se font
mettre dehors**, avec un « mettez à jour » qu'aucun magasin ne peut satisfaire.

**L'exemption se décide sur l'environnement du client ENREGISTRÉ, jamais sur
`x-app-env`.** Un build de production qui déclarerait `dev` ne s'exempterait de
rien : c'est la paire présentée qui tranche, et elle est en base.

C'est la raison d'être des six paires — trois plateformes × **deux
environnements**. L'environnement fait partie de l'identité du client, pas de ce
qu'il raconte. `x-app-env` reste lu et journalisé : son ÉCART avec
l'environnement enregistré dit qu'un build de recette pointe la production, et
c'est précisément l'incident qu'on veut voir.

**Et sans client reconnu, on ne juge pas non plus.** Le type et l'environnement
viennent de la paire ; décider sur une déclaration reviendrait à laisser le
client choisir s'il veut être jugé. Conséquence assumée : **la garde des versions
n'a d'effet que sur un client qui présente une paire valide** — ce qui est de
toute façon l'ordre dans lequel on allume les deux.

**Le 426 porte le lien du magasin et la version attendue.** Un écran qui dit
« mettez à jour » sans dire où aller n'est pas un écran, c'est un mur.

### Pourquoi `forcesUpdate` sur la release et non un plancher

Un plancher — `min_supported_version` — demande qu'on pense à le relever, et on y
pense toujours **après**. Le drapeau se pose **au moment où l'on casse quelque
chose**, c'est-à-dire au seul moment où l'on sait qu'on l'a cassé.

Et il se lit à l'envers du plancher : on cherche le plus récent qui force, et
tout ce qui est en dessous est périmé. Poser le drapeau sur 2.0.0 périme 1.x
d'un coup, sans avoir à écrire un numéro.

### Le même chemin hors garde que la phase 2

`/health` et `/public/*` n'y passent pas. Un lien de liste s'ouvre dans le
navigateur de quelqu'un qui n'a aucune application installée : lui demander de
mettre à jour n'aurait aucun sens.

---

## 6. Le script ops, et l'ordre qui compte

```
pnpm --filter @lehno/api exec tsx src/scripts/enregistrer-version.ts \
  --platform mobile_ios --version 1.4.2 --build 412 \
  --store-url https://apps.apple.com/... [--forces-update]
```

**Il tourne AVANT la soumission au magasin, jamais après.** C'est ce qui rend le
cas du §2 rare : au moment où le premier utilisateur lance la nouvelle version,
elle est déjà connue.

**Il est rejouable** : un `(plateforme, buildNumber)` déjà enregistré est mis à
jour, pas dupliqué — une CI qui rejoue une étape ne doit pas créer un doublon ni
échouer.

**`--forces-update` ne se devine pas.** C'est une décision humaine, prise en
écrivant la release : le script ne l'infère d'aucune convention de commit, parce
qu'une rupture mal détectée dans un sens bloque tout le monde, et dans l'autre
laisse casser en silence.

> Ce script attend la chaîne de publication mobile, qui n'existe pas encore. Il
> s'écrit quand même : il se lance à la main d'ici là, et c'est déjà mieux que
> rien.

---

## 7. L'administration — ce que le panneau doit offrir

*Deux surfaces : celle des clients, livrée en phase 1 et jamais décrite ici, et
celle des versions, qui vient avec ce lot.*

### 7.1 Les clients API — livré (#215), écran livré depuis

| route | ce qu'elle fait |
| --- | --- |
| `GET admin/api-clients` | les six paires, avec leur état |
| `POST admin/api-clients` | ouvrir une paire — **la clé paraît UNE FOIS** |
| `POST admin/api-clients/{id}/rotate` | tourner la clé, l'identifiant ne bouge pas |
| `PATCH admin/api-clients/{id}` | couper, rouvrir |

**Trois choses à savoir pour le dessiner** :

- **La clé ne se relit jamais.** Elle est rendue en clair à la création et à la
  rotation, et la base n'en garde que le haché. L'écran doit le **dire** au
  moment où il l'affiche : c'est le seul instant où quelqu'un peut la copier.
  Un panneau qui l'affiche comme une donnée ordinaire fera perdre des clés.
- **Tout passe par le motif d'audit.** Couper un client coupe **une application
  entière**, sur tous les appareils à la fois. Les motifs proposés sont déjà
  semés : `access_compromised`, `routine_check`, `fixing_an_error`,
  `new_contract`, `load_test`.
- **On coupe, on ne supprime pas.** Il n'y a pas de route de suppression, et
  c'est délibéré : les lignes déjà notées gardent leur référence, et
  l'historique reste lisible.

**L'écran** : `apps/admin/src/pages/ClientsApi.tsx`. L'avertissement précède le
secret dans le panneau de la clé — lu après, il arrive quand la fenêtre est déjà
fermée dans la tête de celui qui l'a copiée, ou pas copiée.

### 7.2 Les versions — ce lot

| route | ce qu'elle fait |
| --- | --- |
| `GET admin/app-versions?platform=` | le registre, du build le plus récent au plus ancien |
| `POST admin/app-versions` | enregistrer une version à la main |
| `PATCH admin/app-versions/{id}` | poser ou retirer `forcesUpdate`, déclasser, corriger le lien |

**Motif obligatoire sur les deux écritures**, et pour une raison plus forte
qu'ailleurs : **poser `forcesUpdate` met hors service tous les appareils en
dessous**. C'est le geste le plus lourd du panneau — plus lourd que couper un
client, parce qu'il ne se voit pas venir.

> **Tranché le 13 septembre.** Deux corrections, et la seconde est à ma charge.
>
> **1. Le compteur EXISTE** — contrairement à ce que ce paragraphe annonçait.
> `versionAppSchema` porte `comptesVusRecemment`, calculé par un agrégat des
> comptes distincts par build sur trente jours. L'agrégat « écarté » au §5.4 du
> plan a été construit.
>
> **2. Mais il n'éclaire PAS la décision de forcer.** `forcesUpdate` ne se pose
> pas quand le nombre le permet : il se pose quand il y a **rupture de
> compatibilité** ou **correctif de sécurité obligatoire**. Dans ces deux cas il
> faut que tout le monde passe — dix appareils ou dix mille, la décision est la
> même.
>
> Le présenter comme un critère serait même trompeur à l'envers : plus il y a
> d'appareils sur une version cassée ou vulnérable, plus il est **urgent** de
> les faire passer, jamais moins.

**À quoi il sert donc**, et c'est ce que l'écran doit en faire : dire l'**ampleur
de ce qui suit**, pas s'il faut le faire. Combien de personnes devront mettre à
jour se prépare — l'assistance en sera prévenue, une annonce se rédige — mais ce
n'est pas ce qui décide.

**Ce que l'écran doit garantir** : que la raison soit **consignée**, et que la
confirmation dise ce que le geste SIGNIFIE — « tous les appareils en dessous ne
pourront plus appeler tant qu'ils n'auront pas mis à jour ». Une phrase, et le
chiffre à côté comme contexte, jamais comme question.

### 7.3 Ce que le panneau ne doit PAS offrir

**Pas de suppression de version.** Une version supprimée redevient inconnue,
donc ses utilisateurs passent du « mettez à jour » à… « mettez à jour » — mais on
perd la trace de ce qui a existé. `isRetired` dit la même chose et se relit.

### 7.4 Où c'est

`apps/admin/src/pages/Versions.tsx`, branché sur les trois routes de
`admin/app-versions`. Ce que les épreuves de `apps/admin/test/app-versions.test.tsx`
tiennent, et qui répond point par point au §7.2 :

- la conséquence du geste est **dite**, et le compteur la **suit** — jamais à sa
  place ;
- une version déclassée n'offre **plus aucun geste** : elle n'est déjà plus
  servie, et forcer depuis elle serait un geste sans effet ;
- le filtre de plateforme part au **serveur**, pas au tableau déjà chargé ;
- le **code** du motif part avec la phrase. Le registre range les siens sous
  `app_version_register` et `app_version_update`, et le serveur refuse un geste
  dont il connaît les motifs et ne reçoit pas le code.

---

## 8. Ce qui reste à trancher

1. ~~**Le compteur d'appareils avant de forcer** (§7.2).~~ **Tranché le 13
   septembre.** Le compteur existe et il est rendu avec chaque ligne, mais il
   **n'informe pas la décision de forcer** : on force pour une rupture de
   compatibilité ou un correctif de sécurité obligatoire, et alors tout le monde
   doit passer. Il dit l'ampleur de ce qui suit. Le §7.2 porte le raisonnement.
2. **Le web est-il concerné ?** Un site se recharge tout seul : le 426 n'y a de
   sens que pour une application installée. **Proposé** : le registre couvre le
   web pour la traçabilité, mais `forcesUpdate` n'y déclenche qu'un rechargement
   forcé, pas un écran de magasin.
3. *(tranché le 13 septembre — plus une question.)* **La garde a son propre
   paramètre**, `version_guard_enabled`, distinct de celui des clients. Les deux
   s'allument séparément, et le §5 bis retire le risque qui rendait cette
   question urgente : hors production, rien n'est jugé.

   **Et « on note, on ne bloque pas » existe désormais pour de bon**, ce que ce
   point proposait sans que rien ne le porte. Le paramètre ne gouverne plus que
   le REFUS : éteint, un build périmé reçoit les en-têtes de suggestion
   (`x-app-update-available`, `x-app-update-url`) au lieu du 426. On regarde le
   parc bouger, puis on allume.

   Il était lu **en tête de garde** et coupait celle-ci entière : la suggestion
   se calculait depuis toujours et ne partait jamais, si bien que la bannière
   n'aurait pu exister qu'une fois le refus allumé. Le plus doux des deux gestes
   attendait le plus dur.
4. **L'entier de compilation du web.** Un compteur de CI, ou le nombre de commits
   sur `main` ? Le second ne demande rien à personne et est monotone.
