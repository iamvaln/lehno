# L'avis, le statut, et six surfaces que le serveur offre sans preneur

*12 septembre 2026. Écrit pour la session mobile. Tout ce qui suit est **livré
et fusionné sur `develop`**, déclaré au contrat, et `docs/api/openapi.json` est à
jour — vérifié en le régénérant, il ne bouge pas.*

Ce document dit ce qu'il y a à câbler. Il ne dessine pas les écrans : quand une
décision de forme se pose, elle est nommée comme telle et laissée au mobile.

---

## 1. Deux axes, et c'est la seule chose à comprendre avant de lire le reste

> **Le statut** dit ce qu'on **fait** de l'objet.
> **L'avis** dit ce qu'on en **pense**, et c'est un pas de plus.

On peut garder sans jamais dire qu'on a aimé — c'est même le cas ordinaire,
donner un avis est un geste qu'on ne franchit pas forcément. Et on peut garder
**sans** aimer : une image qu'on ne trouve pas réussie mais qu'on garde quand
même dit quelque chose de précis, que ni l'un ni l'autre ne porterait seul.

Les fondre à l'écran — un seul bouton « j'aime » qui vaudrait aussi
conservation — détruirait la distinction, et avec elle la seule mesure qui dise
si l'atelier progresse.

**Conséquence de dessin** : ce sont deux gestes, et ils ne se ressemblent pas.
Garder ou écarter engage l'objet ; le pouce est un commentaire.

---

## 2. Le portrait a maintenant quatre moments

| statut | ce qu'il dit | ce que l'écran a à montrer |
| --- | --- | --- |
| `generated` | le brief seul, **aucune image** | le texte, et « Composer l'image » |
| `composed` | **l'image existe, aucun verdict** | l'image, et les gestes |
| `approved` | « je garde celle-ci » | l'image, le verdict porté |
| `rejected` | « je ne garde pas celle-ci » | l'image **reste visible** |

**`composed` est un état terminal légitime**, et la plupart des portraits y
resteront. *Refaire n'est pas rejeter* : quelqu'un peut produire cinq portraits
en changeant les réglages et **les garder tous**. Un écran qui pousserait à
trancher à chaque fois se tromperait sur l'usage.

### Ce qui change dans les appels

```
POST /me/portraits/{id}/compose    fabrique l'image        → composed
POST /me/portraits/{id}/approve    « je garde »            → approved
POST /me/portraits/{id}/reject     « je ne garde pas »     → rejected
PATCH /me/portraits/{id}/feedback  { feedback: up|down|null }
PATCH /me/portraits/{id}           { senderNote: string|null }
```

**`/approve` a changé de sens.** Elle fabriquait l'image *et* valait
acceptation ; elle ne fait plus que le second. C'est `/compose` qui fabrique — ce
que le bouton de l'écran disait déjà.

- Les deux verdicts **ne portent que sur une image composée**. Sur un portrait
  encore `generated`, ils rendent **409** : juger un brief mesurerait la qualité
  du texte en laissant croire qu'il mesure celle du portrait.
- Ils sont **facultatifs et réversibles dans les deux sens** — rien ne se
  détruit, l'image reste quel que soit le verdict, et changer d'idée ne coûte
  rien.
- Ils sont **idempotents**.

### `lib/portrait.ts` est déjà à jour

`etatDuPortrait`, `composition()` et `verdict(portrait, "approved" | "rejected")`
existent et sont éprouvés. **Aucun écran ne les appelle encore** — c'est le
travail.

Le pouce, lui, n'a **rien** côté mobile : ni fonction, ni appel.

---

## 3. Le message aussi

```
PATCH /me/messages/{id}           { content?, markSent?, markRejected? }
PATCH /me/messages/{id}/feedback  { feedback: up|down|null }
```

`rejected` est **distinct d'`edited`** : « je l'ai arrangé » n'est pas « il ne va
pas », et les confondre mesurerait la retouche au lieu du ratage. Un message
**déjà envoyé** ne se rejette pas — ce qui est parti a manifestement convenu ; la
route rend **409**.

`markRejected` ne se combine à rien, ni à une correction ni à un envoi : deux
gestes contradictoires décideraient sinon par leur ordre d'application.

**Rien de tout ça n'est câblé.**

---

## 4. Les idées : l'avis existe au serveur depuis le premier jour

```
PATCH /me/ideas/{id}/feedback   { feedback: up|down|null }
POST  /me/ideas/{id}/accept
```

**Vérifié le 12 septembre : le mobile n'appelle aucune des deux.** Les seules
occurrences de « feedback » dans `apps/mobile` sont des noms de couleurs
(`feedbackSuccess`, `feedbackError`).

Le schéma le dit depuis le début, et ça vaut pour les trois surfaces :

> « **Noter et retenir sont deux gestes distincts**, et les confondre détruirait
> le signal qu'on vient chercher. Quelqu'un peut trouver une idée excellente et
> ne pas la retenir — budget, déjà offerte l'an dernier, pas pour cette
> personne-là. »

---

## 5. Ce qui manque au pouce, et qui n'est pas de votre côté

**Un « je n'aime pas » sans raison ne dit pas quoi corriger.** C'est pourtant la
seule chose qu'on vient chercher.

Le flux n'est pas dessiné et la colonne n'existe pas encore — sa forme dépend de
lui, et se tromper coûte une migration. Le §10 de
`specs/avis-des-productions-2026-09-12.md` porte l'arbitrage à rendre : motifs
fermés, qui se comptent et se comparent entre versions, contre texte libre, qui
dit ce qu'aucune liste n'avait prévu mais que personne ne relit.

**À savoir pour le dessin** : le jour où la raison arrive, elle s'ajoutera au
corps du même `PATCH`. Prévoir que le pouce en bas puisse enchaîner sur une
question évite d'avoir à redessiner le geste.

---

## 6. Quatre autres surfaces livrées et sans preneur

### 6.1 L'échéance dit enfin de qui elle est

`occurrenceSchema` porte **`isSelf`**. Il manquait, et chaque écran devait le
redéduire en relisant le carnet pour retrouver quelle `personId` est la sienne —
un appel de plus par écran pour un booléen que le serveur connaît.

Ce qu'il coûtait, vu à l'écran le 11 : l'accueil affichait « Valentine ·
Anniversaire · J−57 » avec « Préparer » et « Marquer envoyé », et l'accusé disait
« Envoyé à Valentine » — à Valentine.

Les surfaces peuvent maintenant donner à sa propre date les gestes qui lui
vont : **préparer sa liste, la partager**.

### 6.2 Le carnet peut se passer de soi

`GET /me/persons?includeSelf=false` retire la fiche de soi, et **`total` suit le
filtre**. Elle est **incluse par défaut**, et ce n'est pas de la timidité :
« Pour qui » ne listait que les proches, on ne pouvait donc pas inscrire sa
propre date, et l'exclure d'office réinstallerait ce blocage.

Seul `false` exclut : `?includeSelf=0` rend **400** plutôt que d'être ignoré en
silence.

Le mobile filtre côté client et tient une garde (`proches-sans-soi.test.ts`) —
le paramètre rend ce filtre inutile.

### 6.3 La fiche de soi se corrige champ par champ

`PATCH /me/self`. Le `PUT` est un remplacement qui exige `displayName` : c'est ce
qui a fait **retirer** l'écriture de `language` depuis le mobile plutôt que de
risquer d'écraser le reste. Elle peut revenir.

Le `PATCH` **ne crée pas** : **404** quand la fiche n'existe pas, et l'écran
passe alors par le `PUT`. Corps vide refusé.

### 6.4 La note de l'expéditeur entre enfin dans le fichier

Elle n'y entrait pas : l'écran la montrait dans son aperçu, la spécification la
range dans la bande (§109), et **le portrait partagé n'en portait aucune trace**.
C'est réparé — elle est dessinée sous le message, et la bande grandit d'une ligne
pour l'accueillir.

**L'interrupteur ne vaut qu'avant la composition.** Après, la note est dans les
pixels : la changer ne changerait plus rien à ce qu'on partage, et le serveur
rend **409**. `lib/portrait.ts` retire donc le geste au lieu de le griser — un
interrupteur gris ne dirait pas pourquoi, un interrupteur absent ne promet rien.
C'est déjà en place.

---

## 7. Deux choses réparées que vous n'avez pas à refaire

**`PATCH /me/portraits/{id}` n'existait pas.** L'écran l'appelait pourtant depuis
le premier jour, pour approuver *et* pour basculer la signature : **les deux
échouaient en silence**. Aucun cas ne le disait — celui de l'approbation
comparait l'envoi à lui-même sans jamais regarder la méthode. La route existe, la
méthode voyage maintenant avec l'envoi, et un cas garde le chemin *et* le verbe.

**Le catalogue et le validateur parlaient deux langues** (#203). Le catalogue
servait les groupes `image` et `illustration_family`, le validateur lisait
`visual` et `illustrationFamily` : un client qui répondait à **tous** les groupes
annoncés se faisait refuser « unknown visual path », et aucun portrait n'était
produisible. Les identifiants de groupe s'exportent désormais du contrat et le
serveur lit ceux-là.

---

## 8. Un défaut du contrat, signalé et pas encore corrigé

`/me/occurrences/{id}/wishes` et `/me/occurrences/{occurrenceId}/wishes` sont
déclarés **tous les deux**, en `GET` et en `POST`, pour la même route — avec deux
noms de paramètre différents.

Un client engendré depuis `openapi.json` y trouve deux opérations concurrentes, et
l'une des deux se trompe de nom de paramètre. Ce n'est pas un problème pour un
client écrit à la main, qui appelle l'URL qu'il veut ; c'en est un pour tout ce
qui lit le contrat comme une source.

Ça se corrige au contrat, pas au mobile. C'est noté ici pour que quelqu'un le
prenne.

---

## 9. Par quoi commencer, si l'ordre compte

1. **Le portrait**, parce que tout y est déjà livré côté lib et qu'il ne manque
   que les gestes à l'écran : `composed` à traiter comme un état d'arrivée, puis
   « Garder » / « Rejeter », puis le pouce.
2. **Les idées**, parce que l'avis y est le plus ancien et le plus attendu — et
   que « noter » et « retenir » y sont deux boutons, pas un.
3. **Le message**, qui suit la même forme.
4. **`isSelf`**, qui retire un appel par écran et corrige un accusé faux.
5. Le reste — `includeSelf`, `PATCH /me/self` — quand ça arrange.

Le pouce peut attendre la décision du §5 sans bloquer le reste : garder et
écarter se câblent sans lui.
