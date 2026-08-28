# Lehno — le Studio du portrait : une seule chose à ajouter

Le lot du 28 août est juste sur presque tout, et sur deux points il avait raison
avant qu'on les spécifie : **le vocabulaire « Atelier »**, et **le rang comme
couple modèle + gabarit** — « un rang est un couple, le gabarit suit le modèle ».
C'est exactement le modèle qu'on vient d'arrêter côté serveur. Rien à y toucher.

Une seule chose manque, et elle est structurelle.

---

## Ce qui manque : la combinaison est globale, elle doit être par ambiance

L'Atelier compose **une** configuration — un primaire, un secours — et cette
configuration vaut pour **toutes** les ambiances.

Or une ambiance porte sa propre consigne, celle qui donne le ton. Deux ambiances
sur le même modèle ne produisent pas le même résultat, et **rien ne garantit
qu'on ait vu ce que donne chacune**.

Concrètement, aujourd'hui : un essai réussi ouvre la publication pour les trois
ambiances. **Deux d'entre elles partent en service sans avoir jamais été vues
tourner.** C'est ce que la règle « on ne garde que ce qu'on a vu tourner » était
censée empêcher.

**Ce qui part en service devient donc une combinaison** : une ambiance, un
modèle, un rang. Trois ambiances × deux rangs = **six combinaisons**, chacune
adossée à son propre essai réussi.

---

## Ce que ça change, écran par écran

**L'Atelier — un sélecteur en tête : pour quelle ambiance compose-t-on ?**

Le reste ne bouge pas. Le primaire et le secours restent ce qu'ils sont ; ils
appartiennent désormais à l'ambiance choisie, pas au Studio entier. Changer
d'ambiance change ce qu'on compose, comme changer de profil d'essai change ce
sur quoi on essaie.

**La publication — le rang appartient à l'ambiance.**

« Y est aujourd'hui : {quoi} » doit dire *quoi, pour cette ambiance-là*.

Et un ajout : **le second rang doit employer un modèle différent du premier**.
L'écran le refuse plutôt que de le signaler — deux rangs sur le même modèle ne
survivent pas à une panne de ce modèle, et le secours n'en est alors pas un.

**Réglages en service — une grille, plus une ligne.**

Avec six combinaisons, « qu'est-ce qui tourne » ne tient plus sur une ligne.
Les ambiances en lignes, les deux rangs en colonnes. Chaque case dit le modèle
et l'état : en service · éprouvée mais non publiée · jamais essayée · vide.

C'est ce qui rend visible d'un coup d'œil **le trou qui coûte cher** — une
ambiance dont le second rang est vide, ou dont les deux rangs partagent un
modèle. Une liste ne le montre pas.

**Les ambiances (`StudioPortraitPage`) — un avertissement de plus.**

L'écran est bon et garde son rôle : c'est là qu'on arrête les consignes.
Il lui manque une chose : **modifier la consigne d'une ambiance en service
invalidera ses deux rangs**, qui devront être ré-essayés. Le dire avant, pas
après.

---

## Trois points relevés dans son propre README, non corrigés

- **Le message du portrait rendu à 7,8 px**, sa signature à 6,9 px. On ne peut
  pas juger un rendu qu'on ne peut pas lire — et c'est précisément ce que
  l'Atelier existe pour permettre. Il manque un agrandissement.
- **Deux listes sans nom rattaché** : « Modèle » et « Profil d'essai » ont un
  `<strong>` au-dessus, pas un `<label for>`.
- **Les flèches d'ordonnancement à 18 × 14 px.** C'est un outil de bureau, donc
  44 px n'est pas la règle absolue ; 14 px de haut pour réordonner une liste, si.

---

## Une remarque du README qu'on reprend

*« Les portraits réellement produits pour les utilisateurs n'apparaissent nulle
part. »* C'est juste, et ça devient bloquant dès qu'un utilisateur réclame : le
support n'a aucun écran pour voir ce qui a été produit pour quelqu'un. À
dessiner, mais dans un lot à part — ce n'est pas du Studio, c'est de
l'assistance.

---

## Ce que ce document disait avant, et qui était faux

Une première version demandait un écran d'édition des consignes d'ambiance,
annonçait que les trois styles de photo n'étaient pas nommés, et proposait de
déplacer le rang hors de « ce que le modèle lit ».

**Les trois étaient faux.** `StudioPortraitPage` porte déjà les consignes des
orientations, des familles et des styles ; les trois styles sont nommés —
Lumière, Sérigraphie, Silhouette ; et `lu.primaire` / `lu.secondaire` ne
désignent pas un réglage envoyé au modèle mais les deux rangs de la chaîne qu'on
compose.

C'est noté ici parce que l'erreur venait d'avoir cherché « ambiance » là où le
lot dit « familles » et « photo » — et que le prochain qui lira ce kit fera la
même recherche.
