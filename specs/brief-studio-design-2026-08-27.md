# Lehno — Le Studio du portrait, un atelier plutôt qu'un formulaire

> **Le mot a changé.** Ce document disait « l'établi ». Personne ne le
> reconnaissait sans explication — et un nom qu'il faut expliquer a déjà échoué.
> « Atelier » dit la même chose : un endroit où l'on bricole jusqu'à ce que ça
> tienne, par opposition à un formulaire qu'on remplit et qu'on valide.
>
> Le nom de la section reste **Studio du portrait**, et ses deux écrans sont
> **Réglages en service** et **Atelier**. « Studio » ne peut pas servir aux
> deux : il désigne déjà la section, et le studio de l'UTILISATEUR — celui où
> l'on règle sa propre génération — porte le même mot. Trois « studios » dans un
> même produit ne se distinguent plus.

Le Studio est la section du back-office où l'on règle **ce que le portrait propose** et **ce qu'on demande au modèle** pour le produire. C'est la section qui bougera le plus : on ajuste, on essaie, on ajuste encore.

Elle est **fermée au rôle support**, y compris en lecture.

Ce document remplace la découpe en trois entrées de `ux-admin-lehno.md` §5.9. Elle décrivait trois objets ; le travail réel est une boucle, et deux écrans suffisent à la porter.

---

## 1. Le principe qui gouverne tout

**On ne garde que ce qu'on a vu tourner.**

Prévisualiser n'est pas une option offerte après avoir réglé : c'est **le geste qui enregistre**. Tant qu'on n'a pas généré, rien n'est retenu.

Trois conséquences, et il faut les tenir toutes les trois :

- Il n'existe **jamais** de réglage enregistré que personne n'a vu produire un résultat.
- L'image affichée correspond **toujours** à l'état affiché. Elles ne peuvent pas diverger.
- La publication devient sûre par construction : ce qui part en production est ce qu'on a regardé.

> **Pourquoi c'est la règle et non un confort.** Un réglage se change en une seconde et se répercute sur des milliers d'utilisateurs. Sans cette règle, on modifie une consigne, on publie, et on découvre le dégât par le service client — sans même pouvoir dire ce qui l'a causé.

**L'exception, et elle est nette.** La règle porte sur ce que **le modèle lit**. Elle ne porte pas sur ce que **seule l'application lit** — voir §4.

---

## 2. Deux écrans, pas trois

| Écran | Ce qu'on y fait | Mode |
|---|---|---|
| **Réglages en service** | Lire ce qui tourne aujourd'hui, l'historique des publications, revenir en arrière | Lecture |
| **L'atelier** | Composer, essayer, comparer, publier | Travail |

La composition et le banc d'essai **ne sont pas deux onglets**. Un administrateur compose, essaie, recompose, réessaie — dix fois de suite. Deux onglets font payer un aller-retour à chaque tour, et surtout : au moment où il regarde le résultat, il ne voit plus ce qu'il a écrit pour l'obtenir.

---

## 3. L'atelier

Le brouillon d'un côté, le résultat de l'autre, **visibles ensemble**.

C'est la pièce maîtresse à dessiner. Tout le reste en découle.

### Ce que l'administrateur manipule

- **La consigne** donnée au modèle, et ses **garde-fous** — longueur, ton, interdits, ce qui ne doit jamais sortir.
- **Le modèle appelé**, choisi par type de production : message, illustration, traitement de photo.
- **Les champs du proche** qui partent dans la consigne : prénom d'usage, relation, ville, notes, souhaits, historique des cadeaux. L'administrateur décide ce que le gabarit a le droit de lire.
- **Le motif identitaire** employé, et l'emploi qui lui revient.

### Le geste central

Un seul bouton fait avancer : **prévisualiser**. Il génère, il affiche, il enregistre — les trois en un.

Il ne doit pas se lire comme une action secondaire à côté d'un « enregistrer ». **Il n'y a pas d'« enregistrer ».**

---

## 4. Deux familles de paramètres, deux règles

C'est la distinction la plus facile à rater, et celle qui abîmerait le reste si on la manquait.

| Famille | Exemples | Enregistrement |
|---|---|---|
| **Ce que le modèle lit** | Consigne, garde-fous, motif, modèle appelé, champs du proche retenus | **Passe par une prévisualisation** |
| **Ce que seule l'application lit** | Libellés dans les deux langues, ordre des orientations, activation d'une orientation ou d'une ambiance | Enregistrement direct |

> **Pourquoi l'exception.** Régénérer pour enregistrer un ordre d'affichage produirait **une image identique à la précédente**. On demanderait de valider un résultat qui ne prouve rien — et une validation qui ne prouve rien s'apprend très vite à cliquer sans regarder. La règle se serait usée par son propre excès de zèle, et le jour où elle compte vraiment, personne ne la lirait plus.

À l'écran, les deux familles doivent **se distinguer sans explication**. Un administrateur ne doit jamais avoir à se demander laquelle il est en train de toucher.

---

## 5. Le comparatif

Le second panneau sert à répondre à une seule question : **est-ce que ce que je viens de faire vaut mieux que ce qui existe ?**

C'est un **sélecteur**, pas un panneau figé. Il a deux états dans le temps, et le passage de l'un à l'autre doit se faire **tout seul** — l'administrateur ne configure jamais son comparatif, il découvre qu'il a maintenant quelque chose à comparer.

**Premier réglage — rien n'est publié.** Le panneau de droite est vide. Il doit se lire comme *« il n'y a encore rien en face »*, jamais comme une panne ni comme un chargement qui n'aboutit pas. C'est un état normal, pas un manque.

**Régime établi — une version tourne.** Le face-à-face par défaut devient *brouillon contre ce qui est en service*, sur le même profil. Sans l'imposer : on peut lui substituer un autre essai quand c'est deux brouillons qu'on cherche à départager.

---

## 6. Les profils de simulation

Ce ne sont pas des fiches réelles. L'administrateur les compose et les conserve.

**Ce n'est pas une liste, c'est une couverture.** Ce qui doit être couvert :

| Ce qu'il faut | Pourquoi |
|---|---|
| Une fiche **riche** et une fiche **pauvre** *(deux notes suffisent)* | Un gabarit qui tient sur du matériau abondant peut s'effondrer sur du maigre |
| Un **nom court** et un **nom long** | La mise en page casse sur les extrêmes |
| **Les deux langues** | |
| Une relation **familiale** et une **professionnelle** | Le ton n'est pas le même |
| **Au moins un cas sensible** | C'est celui qui révèle si un gabarit dérape |

L'écran doit montrer **ce qui manque**, pas des rangs à lire un par un. *« Sept profils · aucun cas sensible »* vaut mieux que sept lignes.

---

## 7. Le journal du jour

Un coin de l'atelier, pas une page.

**Chaque ligne dit ce qui a changé, pas ce qui s'est passé.** *« Modèle 2 · garde-fou raccourci »*, jamais *« 10 h 51 — appel modèle 2 »*. Un horodatage n'apprend rien et, au bout de trente essais, ne fait que du bruit.

**Chaque ligne est cliquable** et recharge cet état dans le brouillon. C'est ce qui lui donne sa raison d'être : dans une séance de réglage, le geste qui manque toujours est *« remets-moi celui d'il y a trois essais, il était mieux que les deux derniers »*.

Chaque ligne porte **son auteur** — la journalisation le fournit déjà.

> Ce n'est pas un nouvel objet : puisque chaque prévisualisation est le point d'enregistrement, la trace du jour **existe déjà**. C'est l'historique, filtré sur aujourd'hui.

---

## 8. Ce qui ne doit PAS être à l'écran

**Aucun compteur de dépense.** Pas de plafond qui se découvre en le heurtant, pas de cumul du jour dans un coin, pas de budget qui descend pendant qu'on travaille.

Chaque appel au modèle est journalisé — qui, quand, quel modèle, dans quel contexte — et la dépense se lit **ailleurs**, après coup, par quelqu'un dont c'est le travail. L'administrateur qui règle un portrait règle un portrait.

**Le prix estimé reste**, mais comme **fiche technique du modèle** : à côté du sélecteur, au même titre que son nom. Une information pour choisir quel modèle appeler, pas un décompte qui freine.

> Seul le coût d'entrée est connu avant l'appel ; la sortie ne l'est pas. Ce sera donc une fourchette, ou une estimation sur le plafond de sortie — à formuler pour que ça ne se lise pas comme un prix ferme.

---

## 9. Réglages en service

L'écran de lecture. Ce qui tourne aujourd'hui, et rien d'autre.

- Le modèle appelé pour chaque production, les orientations actives et leur ordre, les ambiances, le motif retenu.
- **L'historique des publications** — auteur, date, ce que chacune changeait.
- **Le retour arrière**, qui republie une version antérieure sans la reconstruire. Il ne vise **que les états publiés** : revenir sur un essai abandonné n'a pas de sens.

### Le taux de régénération, remonté

`ux-admin-lehno.md` §5.9 le mentionne en bas de section, parmi les statistiques. **Il doit remonter près de la version publiée.**

C'est la seule mesure qui dise *« ta publication d'hier a empiré les choses »* : un contenu qu'on relance aussitôt est un contenu manqué. L'essai protège du dérapage qu'on peut voir avant ; celui-ci révèle celui qui ne se montre qu'en production, sur des milliers de fiches qu'aucun profil de simulation ne représente.

À dessiner comme une **comparaison**, pas comme un chiffre :

> *Publiée il y a deux jours · régénération 31 %, contre 12 % avant*

C'est le déclencheur naturel du retour arrière, et il doit être à portée de main depuis là.

---

## 10. La publication

**Elle se fait depuis l'atelier**, jamais depuis un écran de réglage : on publie après avoir vu un résultat, pas après avoir tapé un texte.

**Rien ne se publie sans essai de l'état qu'on publie.** Pas « sans essai » au sens large : l'essai qui autorise doit porter sur exactement ce qui part. Sans cette précision, la règle se contourne sans mauvaise intention — on essaie, on corrige un détail, on publie, et l'essai qui a servi de caution ne parle plus de ce qui est en production.

Le principe du §1 rend cette garantie automatique : puisque le moindre changement de ce que le modèle lit repasse par une prévisualisation, l'état courant a toujours son essai.

**Le refus doit être lisible.** Si la publication est fermée, l'écran dit ce qu'il manque et comment l'obtenir — jamais un bouton grisé sans phrase.

---

## 11. Les états à dessiner

| État | Ce qui le rend délicat |
|---|---|
| **Premier réglage**, rien en service | Le comparatif vide doit dire « il n'y a rien en face », pas « c'est cassé » |
| **Génération en cours** | Elle prend du temps réel ; l'attente doit rester habitable, et le brouillon lisible pendant |
| **Résultat affiché**, sans comparatif | |
| **Face-à-face** brouillon / en service | Deux portraits côte à côte, sur un écran d'ordinateur |
| **Journal vide** *(début de séance)* et **journal chargé** *(trentième essai)* | Le second ne doit pas noyer l'atelier |
| **Publication refusée** faute d'essai | Dire quoi faire, pas seulement que c'est fermé |
| **Retour arrière** depuis les réglages en service | Demande un motif |
| **Version publiée à l'instant**, aucun taux de régénération encore | Le rang existe mais n'a rien à dire : il ne doit pas se lire comme 0 % — un zéro sans explication se prend pour une mesure |
| **Couverture de profils incomplète** | Nommer ce qui manque |

---

## 12. Ajustements après la livraison du routage des modèles

Le catalogue, le routage par tâche et le disjoncteur existent maintenant en base
et à l'écran d'administration. Trois choses de ce brief s'en trouvent précisées.

### L'atelier n'a pas de repli — et ce n'est pas un détail d'ergonomie

Le repli automatique d'un modèle sur le suivant vaut pour **ce qui tourne sans
témoin** : les passes d'arrière-plan, et les générations lancées par un
utilisateur. Personne ne regarde, et une génération perdue est perdue pour de
bon.

**L'administration ne suit pas cette règle.** Quand on essaie une combinaison,
on essaie *celle-là*. Si le serveur bascule silencieusement sur le rang suivant
parce que le modèle demandé ne répond pas, l'administrateur regarde un résultat
produit par un modèle qu'il n'a pas choisi — et il le publie en croyant avoir vu
ce qui tournera en production.

Ce serait l'exact contraire du §1. « On ne garde que ce qu'on a vu tourner »
suppose qu'on sache **ce qu'on a vu tourner**.

Donc, à l'atelier : **le modèle demandé, ou l'échec dit franchement**, en le
nommant. Jamais un repli muet.

### L'échec d'une génération est un état à dessiner

Le §11 prévoit « génération en cours ». Il ne prévoit pas « génération
échouée », et elle arrivera : c'est un appel réseau à un tiers.

**Le brouillon ne doit pas être perdu.** Composer dix minutes de consigne, voir
le fournisseur ne pas répondre, et tout retrouver vide — c'est ce qui fait
détester un outil. L'état composé survit à l'échec ; seul l'essai a manqué.

L'écran dit lequel des trois cas s'est produit, parce qu'ils appellent trois
gestes différents :

| Ce qui s'est passé | Ce qu'on fait |
|---|---|
| Le modèle n'a pas répondu — panne, débit, délai | Réessayer, ou choisir un autre modèle |
| Le modèle a refusé la demande | Réessayer ne sert à rien : c'est la consigne qu'il faut reprendre |
| Le compte du fournisseur est à sec | Ni l'un ni l'autre : il faut recharger |

Le troisième n'est pas théorique — deux des quatre fournisseurs y étaient encore
ce matin.

### Une combinaison, c'est un couple — pas un modèle

Le §3 fait choisir « le modèle appelé ». Mais un gabarit ne vaut pas la même
chose d'un modèle à l'autre : une consigne taillée pour un modèle bavard donne
autre chose sur un modèle bref. **Ce qu'on essaie, et ce qu'on publie, c'est le
couple consigne + modèle.**

Et ce que l'administrateur retient à la fin d'une séance, ce n'est pas *un*
couple mais **deux** : celui qu'on essaie en premier, et celui qui prend le
relais s'il ne répond pas. Choisir le primaire et le secondaire est le geste qui
clôt la séance d'essais — l'atelier sert à comparer, la chaîne sert à exécuter.

**Ce que ça demande à l'écran** : après le comparatif, un geste qui range la
combinaison gagnante en premier rang et une autre en second. Pas un formulaire à
part — la suite naturelle de « celle-ci vaut mieux ».
