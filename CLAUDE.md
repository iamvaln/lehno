# Lehno — les règles du dépôt

**Plusieurs sessions travaillent sur ce dépôt en même temps.** C'est ce qui explique
toutes les règles qui suivent : chacune existe parce qu'un travail a déjà été
perdu, écrasé ou laissé invisible.

---

## Un document écrit se commite le jour même

**Un `.md` créé ou modifié dans `specs/` se commite avant la fin de la séance.**
Pas quand il sera fini — quand la séance s'arrête.

Un document laissé non commité dans l'arbre de travail :

- **peut être emporté** par le `git add -A` d'une autre session — c'est arrivé
  deux fois, dont une qui a emporté quinze fichiers dans un commit dont le
  message n'en annonçait qu'un ;
- **n'existe pour personne d'autre.** Une spécification mise à jour que
  l'équipe ne voit pas ne sert à rien ; celle qu'on lit à sa place est périmée,
  et personne ne le sait ;
- **disparaît** au premier `git clean` ou `git checkout` malheureux.

Un document en cours se commite quand même, avec un message qui le dit
(`specs: §6.5 en cours de rédaction`). Un commit n'est pas une publication —
c'est une sauvegarde que les autres peuvent voir.

**Corollaire** : si vous trouvez des `.md` non commités dans `specs/` qui ne
sont pas de vous, **ne les commitez pas et ne les emportez pas**. Signalez-les
à leur auteur. Nommez vos fichiers un par un plutôt que d'employer `git add -A`.

---

## On ne travaille jamais sur `develop` ni dans la copie principale

`/Users/valentine/dev/lehno` ne reçoit **aucune édition**. Seulement `git merge`
et `git push`.

Tout ce qui s'écrit se fait dans un worktree :

```
git worktree add .worktrees/<sujet> -b feature/<sujet> origin/develop
cd /Users/valentine/dev/lehno/.worktrees/<sujet>   # chemin ABSOLU, toujours
pnpm install --frozen-lockfile
```

Le chemin absolu n'est pas du zèle : un `cd` relatif renvoie le shell dans la
copie principale, où l'on se met alors à écrire sans s'en apercevoir.

**`git add -A` est interdit dans la copie principale.** Nommez les fichiers.

---

## Rien n'arrive sur `develop` sans passer par une PR

`develop` et `main` sont protégées : une poussée directe est refusée,
**administrateurs inclus**.

```
git push -u origin feature/<sujet>
gh pr create --base develop --head feature/<sujet> --title "…" --body-file <fichier>
```

**La vérification ne tourne plus avant la fusion.** Elle s'exécute sur `main`
après fusion, et surtout dans `release.yml` avant chaque déploiement — rien ne
part en production sans être vérifié.

Ce qu'on y perd est la détection précoce : un commit cassé peut dormir sur
`develop` jusqu'à la prochaine release. C'est un échange assumé contre le coût
de vingt minutes par PR, aggravé par les remises à jour en chaîne que chaque
fusion imposait aux autres.

**Conséquence pour vous : la suite tourne en local avant de pousser.** Plus
personne ne la lancera à votre place avant que le code n'atteigne `main`.

---

## Avant de commencer, se synchroniser

```
git -c rebase.autoStash=true pull --rebase origin develop
```

L'`autoStash` met de côté le travail non commité **des autres sessions**
présent dans l'arbre, et le remet après. Sans lui, le rebase refuse ou emporte.

---

## Ne jamais défaire une modification par `git checkout`

Pour éprouver une garde, on casse volontairement le code qu'elle protège et on
vérifie que le test tombe **en nommant la bonne erreur**. C'est la preuve par la
panne, et elle vaut mieux qu'un test vert dont on ignore s'il éprouve quoi que
ce soit.

Mais on **rétablit par l'édition inverse**, jamais par `git checkout <fichier>` :
cette commande restaure le dernier commit, donc efface tout ce qui n'était pas
commité dans ce fichier. Et sur un fichier **non suivi**, elle ne restaure rien
du tout — la sonde reste en place sans qu'on s'en aperçoive.

**Commitez avant de sonder.** C'est ce qui rend le rétablissement vérifiable :
`git diff --stat` doit redevenir vide.

---

## L'environnement

Node **22** : `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` avant toute
commande `pnpm`.

`.env` et `.env.local` sont **édités par le propriétaire du dépôt**, jamais par
une session. Si une variable manque, demandez-la plutôt que de l'écrire.

Le contrat publié (`docs/api/openapi.json`) est **engendré** depuis les schémas
Zod — jamais écrit à la main. Après avoir touché à `packages/contracts/` :

```
pnpm --filter @lehno/contracts openapi
```

Un test échoue si le fichier versionné est périmé.

---

## Les commentaires disent pourquoi, jamais quoi

Le code dit déjà ce qu'il fait. Un commentaire explique **le piège évité** —
pourquoi cette forme plutôt qu'une autre, et ce qui casserait si on la
« simplifiait ». En français.

Voir `apps/api/src/tenancy/tenant.repository.ts`, `apps/api/src/me/calendrier.ts`
et `packages/contracts/src/flags.ts` pour le ton.
