# Passer le code à l'anglais — plan de normalisation

*12 septembre 2026. À poser, pas à exécuter : ce chantier attend qu'il n'y ait
plus de travail en cours. Le §7 dit ce qu'on peut commencer avant.*

## Pourquoi

Le dépôt nomme en français jusqu'à la plomberie — `basculeDeTri`,
`cheminDeLecture`, `unSeulALaFois`. Ce n'est pas du vocabulaire métier : c'est
de la technique traduite, et l'écosystème autour est anglais, si bien que chaque
appel mélange déjà les deux langues.

La version défendable de ce choix existe — garder la langue du métier pour les
**termes du métier** et l'anglais pour la mécanique — mais ce n'est pas ce que
le dépôt fait. Il a tout francisé.

**Ce document ne rouvre pas la décision, il la chiffre et l'ordonne.**

---

## 1. L'inventaire, mesuré le 12 septembre

| Surface | Volume | Renommage |
|---|---|---|
| `packages/contracts/src` | 743 symboles exportés | mécanique |
| `apps/mobile/lib` + écrans | 483 symboles | mécanique |
| `apps/api/src` | 294 symboles | mécanique |
| `packages/ui-native/src` | 211 symboles | mécanique |
| `apps/admin/src` | 181 symboles | mécanique |
| clés de libellés | 867 (mobile) + 44 (admin) | mécanique — les **clés**, pas les textes |
| noms de fichiers | ~25 | mécanique, mais casse l'historique |
| **commentaires** | **27 230 lignes, 478 fichiers** | **au jugement** |

**Ce qui est DÉJÀ en anglais, et n'a rien à faire dans ce chantier :**

- **Le schéma de base.** `Notification`, `CreditTransaction`, `OtpCode`, et des
  `@map("accepted_at")` partout. **Aucune migration n'est nécessaire** — c'est
  la meilleure nouvelle de cet inventaire, parce que c'était le seul risque
  irréversible.
- **Le fil.** Les champs que le serveur et le client échangent : `briefText`,
  `contentShort`, `failureReason`, `isSelf`. Le contrat est déjà une interface
  publique anglaise.
- **Les noms de composants du kit.** `Avatar`, `Banner`, `EventCard`,
  `LoadingState`… Seules leurs **props** sont mélangées (§5).

---

## 2. Les deux chantiers n'ont pas le même coût, et c'est ce qui commande tout

C'est la seule chose à comprendre avant de lire l'ordre.

> **Les identifiants sont mécaniques.** Le compilateur vérifie chaque renommage.
> Une passe qui compile est une passe qui est juste.
>
> **Les commentaires sont au jugement.** 27 230 lignes, souvent longues, qui
> portent le *pourquoi* d'une décision. Les traduire mal, c'est perdre ce qui
> fait leur valeur — et aucun test ne tombera.

Ils se conduisent donc à l'opposé l'un de l'autre :

| | Identifiants | Commentaires |
|---|---|---|
| Vérification | le compilateur | la relecture humaine |
| Découpage | **une seule passe** | fichier par fichier |
| Gel du dépôt | **indispensable** | inutile |
| Si on s'arrête au milieu | le dépôt ne compile pas | rien de cassé |
| Durée | une demi-journée | des semaines, en fond |

**Une seule passe pour les identifiants, et c'est contre-intuitif.** On voudrait
découper par paquet ; ce serait plus cher et plus risqué. Un renommage vérifié
par le compilateur n'a pas besoin d'états intermédiaires — et cinq passes
créeraient cinq états où le dépôt ne compile pas, cinq occasions de conflit, et
feraient toucher deux fois les fichiers qui consomment deux paquets.

---

## 3. Les dépendances, et pourquoi elles comptent moins qu'il n'y paraît

```
tokens ──► ui-native ──┐
                       ├──► mobile
contracts ─────────────┤
                       ├──► admin
                       └──► api
```

En temps normal cet ordre dicterait tout : on renomme une feuille, on remonte.
**Pour une passe atomique, il ne dicte rien** — tout change en même temps, et le
compilateur lit le graphe à notre place.

Il commande en revanche **l'ordre de RELECTURE**, qui est l'inverse de l'ordre
d'exécution : on relit d'abord ce dont tout dépend.

1. `packages/contracts` — le plus gros, et le plus lu par les autres
2. `packages/ui-native` — la surface du designer (§5)
3. `apps/api` — le serveur
4. `apps/mobile` — le plus gros consommateur
5. `apps/admin`

---

## 4. Le protocole de gel

**C'est la partie qui coûte, et elle est humaine, pas technique.**

Au 12 septembre : **48 branches distantes non fusionnées, 50 commits sur
`develop` en vingt-quatre heures.** Plusieurs sessions écrivent ce dépôt en
parallèle — un renommage global entrerait en conflit avec tout ce qui est en
vol, et chaque branche devrait se rebaser sur un diff qui touche tous ses
fichiers.

1. **Vider les branches.** Fusionner ou fermer. Une branche en vol pendant la
   passe est une branche à réécrire à la main.
2. **Annoncer le gel**, et l'écrire dans `CLAUDE.md` le temps qu'il dure.
3. **Une session, une passe, un seul jour.** Pas de travail parallèle.
4. **Une PR unique**, énorme et illisible — c'est voulu. Elle ne se relit pas
   ligne à ligne : elle se relit par ce qui la vérifie (§8).
5. **Fusionner le jour même.** Une PR de renommage qui dort une nuit est une PR
   à refaire.

---

## 5. Ce que le designer doit savoir, et faire

`packages/ui-native` est sa surface, et c'est **la plus mélangée du dépôt** : les
composants portent des noms anglais, leurs props sont à moitié françaises.

```
Banner, EventCard, LoadingState, PaidActionSheet   ← anglais, ne bougent pas
  actionLabel, dismissLabel, icon, duration        ← anglais, ne bougent pas
  annuler, confirmer, cout, coutLibelle,           ← à renommer
  destructif, effacable, premier
```

**Ce qui change pour lui :**

- **Les noms de composants ne bougent pas.** Ses planches, ses cartes
  (`specs/components/*.card.html`) et ses maquettes continuent de les nommer
  pareil.
- **Les props changent.** `cout` → `cost`, `coutLibelle` → `costLabel`,
  `annuler` → `cancelLabel`, `confirmer` → `confirmLabel`, `destructif` →
  `destructive`, `effacable` → `dismissible`, `premier` → `first`.
- **Les fichiers de démonstration du kit** (`specs/react-native/app/*.js`,
  `specs/components/*.card.html`) emploient ces props et doivent suivre dans la
  même passe — sinon les cartes montrent un kit qui n'existe plus.

**Ce qu'on lui demande, et c'est le vrai travail de design là-dedans :**

> Arrêter une convention de nommage des props, et l'écrire. Le kit en a besoin
> indépendamment de ce chantier : `actionLabel` et `coutLibelle` cohabitent
> aujourd'hui sans qu'aucune règle ne dise laquelle est la bonne forme.

Une convention qui a fait ses preuves ailleurs : `<chose>` pour une valeur,
`<chose>Label` pour son libellé, `on<Chose>` pour un geste, adjectif nu pour un
booléen (`destructive`, `dismissible`, `first`). À trancher par lui, pas par le
code.

**Ce qui ne change pas : les textes eux-mêmes.** Le produit est bilingue —
`messages/fr.ts` et `messages/en.ts` portent les deux langues, et le client
reçoit la sienne. Seules les **clés** changent
(`portraitAttenteQuitter` → `portraitWaitLeave`) ; les deux phrases qu'elles
portent ne bougent pas d'un caractère.

---

## 6. Ce que les specs doivent devenir

**Les specs restent en français.** Ce sont des documents de conception, lus par
l'équipe, et leur prose porte le vocabulaire du métier. C'est le seul endroit du
dépôt où le français reste la règle — les textes du produit, eux, ne sont pas
« en français » : ils sont dans les deux langues, et le client reçoit la sienne.

Sept d'entre elles citent des symboles du code entre accents graves —
`composeLAccueil`, `apresLeChoix`, `groupesAtteignables`. Ces citations
deviennent fausses le jour de la passe.

**Ce qu'il faut faire, dans la même PR :**

1. **Balayer `specs/*.md`** pour les identifiants cités, et les mettre à jour.
   Une citation périmée est pire qu'absente : elle envoie chercher un symbole
   qui n'existe plus.
2. **Ajouter la règle à `CLAUDE.md`**, qui aujourd'hui n'impose que le français
   des commentaires. Elle devient :

   > **Le code s'écrit en anglais** — identifiants, noms de fichiers, clés de
   > libellés, commentaires. **Les textes affichés restent en français** : c'est
   > la langue du produit. **Les specs restent en français** : c'est la langue
   > de la conception.

3. **Retirer de `CLAUDE.md` la règle des commentaires en français**, et garder
   son raisonnement — *« les commentaires disent pourquoi, jamais quoi »* — qui
   ne dépend pas de la langue.

---

## 7. Ce qu'on peut commencer AVANT le gel

**Une seule chose, et elle ne coûte rien : tout fichier NEUF s'écrit en
anglais**, identifiants et commentaires compris.

- Un fichier est **entièrement** dans une langue ou dans l'autre, jamais
  mélangé. C'est ce qui rend la règle relisible.
- Aucun conflit avec les branches en vol : un fichier neuf ne collisionne avec
  rien.
- Ça **arrête la croissance** du chantier. Au rythme actuel, attendre un mois
  doublerait le volume.

**Ce qu'on ne commence PAS avant le gel**, et la raison est la même pour les
deux : le conflit.

- **Renommer dans un fichier existant.** Chaque branche en vol qui touche ce
  fichier se rebase sur un diff universel.
- **Traduire les commentaires d'un fichier existant.** On croit que c'est sans
  risque parce que rien ne casse — mais ça réécrit toutes les lignes du fichier,
  donc ça entre en conflit avec chaque hunk de chaque branche ouverte. C'est
  précisément le genre de travail qui paraît gratuit et se paie chez les autres.

---

## 8. Comment on vérifie que la passe est juste

Une PR de deux mille symboles ne se relit pas à l'œil. Elle se vérifie :

1. **`pnpm -r typecheck`** — le juge principal. Un renommage incomplet ne
   compile pas.
2. **`pnpm -r test`** — les suites ne doivent pas bouger d'un cas. Si un test
   tombe, ce n'est pas un renommage, c'est un changement de comportement.
3. **`pnpm --filter @lehno/contracts openapi` puis `git diff docs/api/openapi.json`
   VIDE.** C'est la garde la plus importante du lot : **le contrat publié ne doit
   pas bouger d'un octet.** S'il bouge, on a renommé un champ du fil, c'est-à-dire
   cassé tous les clients.
4. **Les quatre clés de stockage sont intactes** — `lehno.acces`,
   `lehno.appareil`, `lehno.lignee`, `lehno.rafraichissement`. Renommer la
   *constante* est sûr ; toucher à la *chaîne* déconnecterait tout le parc
   installé, et c'est le seul dégât irréversible de ce chantier.
5. **Aucune chaîne de la base ni du fil n'a changé** :
   `git diff --stat prisma/ docs/api/` vide.

---

## 9. Les pièges, nommés

- **Les clés de stockage** (§8.4). Le seul dégât qu'on ne peut pas défaire.
- **Les noms de fichiers.** `git mv` garde l'historique ; un `rm` + `add` le
  perd. ~25 fichiers : `carnet`, `souhait`, `jetons`, `coffre`, `verrou`,
  `drapeaux`, `apercu`, `fermeture`, `versement`, `parrainage`, `reprises`…
- **Les clés de libellés** (911). Elles sont des identifiants, donc elles
  changent — mais elles sont aussi la seule chose qui relie deux dictionnaires,
  et `messages.test.ts` garde leur parité. Il tombera au premier oubli, ce qui
  est exactement ce qu'on veut.
- **Les gardes qui lisent la source.** `proches-sans-soi.test.ts`,
  `ecrans-gouvernes.test.ts`, `surcouches.test.ts` cherchent des noms de
  fonctions **dans du texte** : le compilateur ne les corrigera pas. À traiter à
  la main, et à éprouver par la panne après la passe.
- **Les faux amis.** `apercu` n'est pas `preview` partout : c'est tantôt
  l'aperçu d'un paiement (`quote`, `estimate`), tantôt la vignette d'un
  catalogue (`preview`). Un renommage aveugle par recherche-remplacement en
  ferait un seul mot. **Le glossaire du §10 existe pour ça.**

---

## 10. Le glossaire, à compléter avant la passe

Le vrai travail de préparation. Sans lui, la passe produit de l'anglais
approximatif qu'il faudra refaire.

| Français | Anglais | Remarque |
|---|---|---|
| aperçu (d'un paiement) | `quote` | ce qu'on annonce avant de débiter |
| aperçu (d'une image) | `preview` | la vignette du catalogue |
| carnet | `contacts` | le carnet de proches |
| proche | `person` | déjà le mot du contrat |
| souhait | `wish` | déjà le mot du contrat |
| échéance | `occurrence` | déjà le mot du contrat |
| fiche | `person` / `profile` | selon qu'il s'agit d'un proche ou de soi |
| drapeau | `flag` | |
| jeton | `token` | |
| coffre | `vault` / `secureStore` | |
| verrou | `lock` | |
| reprise | `resumable` | ce qu'on a laissé en plan |
| versement | `payout` | |
| parrainage | `referral` | déjà le mot de la base |
| sas | `review` / `inbox` | à trancher — le sas des contributions |
| bascule | `toggle` | |
| geste | `action` | |

**Beaucoup de ces mots existent déjà en anglais dans le contrat et dans la
base.** C'est le meilleur point de départ : là où le fil a déjà tranché, le code
suit — et la traduction cesse d'être une question d'opinion.
