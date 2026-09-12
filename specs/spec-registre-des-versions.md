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

**Conséquence pour le client** : un en-tête de plus, `x-app-build`. Un appel qui
porte une version sans build ne peut pas être comparé — il est traité comme
inconnu (§2), donc invité à se mettre à jour.

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
1. la plateforme vient de `x-client-type`
2. le build vient de `x-app-build`
3. si le build est absent ou inconnu du registre  → 426
4. si le build est `is_retired`                   → 426
5. soit P = le plus grand buildNumber non retiré de cette plateforme
   qui porte `forcesUpdate`
   si le build < P                                → 426
6. sinon, si un build plus récent existe          → en-tête de suggestion
7. sinon                                          → rien
```

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

### 7.1 Les clients API — livré (#215), à dessiner

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

**Ce que l'écran doit montrer avant de le poser** : combien d'appareils seraient
concernés. La phase 1 ne le sait pas — elle journalise, elle ne compte pas. C'est
l'argument qui ferait revenir l'agrégat écarté au §5.4 du plan, et il vaut mieux
que celui d'origine : on ne veut pas « savoir quelles versions appellent », on
veut **savoir qui l'on s'apprête à bloquer**.

> **À trancher.** Sans ce compteur, `forcesUpdate` se pose à l'aveugle. Faut-il
> le construire avec ce lot, ou poser le drapeau sans filet en attendant ?

### 7.3 Ce que le panneau ne doit PAS offrir

**Pas de suppression de version.** Une version supprimée redevient inconnue,
donc ses utilisateurs passent du « mettez à jour » à… « mettez à jour » — mais on
perd la trace de ce qui a existé. `isRetired` dit la même chose et se relit.

---

## 8. Ce qui reste à trancher

1. **Le compteur d'appareils avant de forcer** (§7.2). C'est le point qui décide
   si ce lot embarque un agrégat.
2. **Le web est-il concerné ?** Un site se recharge tout seul : le 426 n'y a de
   sens que pour une application installée. **Proposé** : le registre couvre le
   web pour la traçabilité, mais `forcesUpdate` n'y déclenche qu'un rechargement
   forcé, pas un écran de magasin.
3. **Que faire d'un build inconnu en phase de rodage ?** Le §2 propose le 426
   d'emblée. Un réglage « on note, on ne bloque pas » — comme la phase 1 — serait
   plus prudent les premières semaines. **Proposé** : le même paramètre système
   que la garde, pour que les deux s'allument ensemble ou séparément.
4. **L'entier de compilation du web.** Un compteur de CI, ou le nombre de commits
   sur `main` ? Le second ne demande rien à personne et est monotone.
