# Lehno — les ambiances : ce qu'il faut ajouter au Studio

Le lot d'administration du 28 août est bon, et son vocabulaire est déjà le bon —
« Atelier », « primaire », « secondaire ». Ce document ne le remet pas en cause :
il ajoute **un écran** et **retire une responsabilité** à l'Atelier.

---

## 1. Le manque, et il est structurel

Dans le lot, l'ambiance vit **uniquement** dans le panneau *« Ce que seule
l'application lit »* : son libellé, son ordre, son activation.

**Sa consigne n'a aucun champ.** Or c'est elle qui donne le ton du portrait, et
le contrat la marque explicitement comme lue par le modèle.

Ce n'est pas un écran oublié : c'est un désaccord sur la nature de l'objet. Le
lot traite l'ambiance comme un **libellé**, le serveur comme une **consigne**.

---

## 2. Pourquoi un écran à part, et pas un champ de plus dans l'Atelier

Une décision de modèle vient d'être prise, et elle rend l'édition sur place
intenable.

**Ce qui part en service n'est plus une configuration mais une combinaison** :
une ambiance, un modèle, un rang. Chaque combinaison doit avoir été **éprouvée** —
essayée et réussie — avant de servir. Trois ambiances × deux rangs = six
combinaisons, six essais.

**Conséquence** : modifier la consigne d'une ambiance invalide **les deux rangs
de cette ambiance**. Si on l'édite au même endroit qu'on choisit les modèles et
les rangs, on tourne en rond — chaque retouche du ton casse les essais qu'on
vient de faire.

D'où **deux temps**, et c'est le cœur de ce brief :

| | |
|---|---|
| **1. Arrêter les ambiances** | Nom, description, consigne. On essaie, on ajuste, on converge. **Rien n'est appairé** — donc rien ne se casse en boucle |
| **2. Construire les combinaisons** | Avec les ambiances retenues : pour chacune, un primaire et un secours, sur **deux modèles différents**, chacun éprouvé |

---

## 3. L'écran à dessiner — « Les ambiances »

Dans la famille **Studio du portrait**, à côté de l'Atelier, des essais et des
réglages en service.

**Ce qu'on y règle, par ambiance**

- Le **nom**, dans les deux langues.
- La **description** — ce que l'utilisateur lit sous le nom, s'il y en a une.
- La **consigne** — ce qui donne le ton, lue par le modèle. C'est le champ
  central de cet écran, et il doit avoir la place qui va avec.
- Le **groupe** : famille d'illustration, ou style de photo.
- L'**activation**.

**Ce qu'on peut y faire, et qui n'existe nulle part ailleurs**

**Essayer une consigne d'ambiance seule**, sans engager de rang ni de
publication. C'est la raison d'être de l'écran : converger sur le ton avant de
l'appairer à quoi que ce soit.

L'essai appelle un modèle et coûte donc un appel — le même avertissement que sur
l'Atelier s'applique, et **le liséré d'action** aussi : un changement de consigne
demande un nouvel essai.

**Ce qu'on ne peut PAS y faire** : publier. Cet écran arrête un ton ; c'est
l'Atelier qui met en service.

**Les états à dessiner**

| État | Ce qui le rend délicat |
|---|---|
| **Aucune ambiance** *(premier réglage)* | Le Studio ne peut rien publier tant qu'aucune n'existe. L'écran doit le dire, et mener à la création |
| **Une ambiance jamais essayée** | Elle ne peut entrer dans aucune combinaison. Distinguer « écrite » de « éprouvée » |
| **Une consigne modifiée depuis son essai** | Le liséré d'action, comme sur l'Atelier |
| **Une ambiance en service** | La modifier invalidera ses deux rangs. **Le dire avant, pas après** — c'est le seul avertissement de cet écran qui compte |
| **Une ambiance désactivée** | Elle disparaît de l'application sans livraison, mais ses combinaisons restent en base |

---

## 4. Ce qui change dans l'Atelier

**Il cesse de proposer l'édition des ambiances.** Il les **choisit** parmi celles
qui sont arrêtées.

Le panneau *« ce que seule l'application lit »* garde donc les orientations —
libellé, ordre, activation — et perd l'onglet des ambiances. À la place, un
sélecteur : *pour quelle ambiance compose-t-on ?*

**Une combinaison se compose donc pour une ambiance donnée.** L'Atelier ne règle
plus « le Studio » en bloc : il règle une case de la grille.

---

## 5. Ce qui change dans la publication

Le lot porte déjà `rang1` / `rang2`, avec *« appelée d'abord »* et *« appelée si
le premier rang échoue »*. Le vocabulaire est juste et ne bouge pas.

**Deux ajouts, et un déplacement.**

**Le rang appartient à une ambiance**, pas au Studio. « Y est aujourd'hui : {quoi} »
doit donc dire *quoi, pour cette ambiance-là*.

**Le second rang doit employer un modèle différent du premier**, et l'écran doit
le refuser plutôt que de le signaler. Deux rangs sur le même modèle ne survivent
pas à une panne de ce modèle — le secours n'en est alors pas un.

**Le rang n'est pas « ce que le modèle lit ».** Le lot le range dans ce panneau ;
il n'a rien à y faire. Le rang est un **ordre d'essai** : il ne change pas une
virgule à ce que le modèle reçoit. L'y laisser ferait qu'échanger primaire et
secours invaliderait deux essais parfaitement valables.

---

## 6. Le tableau de bord du Studio, qui manque aussi

Avec six combinaisons, « qu'est-ce qui tourne » ne tient plus dans une ligne.

**Une grille** : les ambiances en lignes, les deux rangs en colonnes. Chaque case
dit le modèle et l'état — en service, éprouvée mais non publiée, jamais essayée,
vide.

C'est ce qui rend visible d'un coup d'œil **le trou qui coûte cher** : une
ambiance dont le second rang est vide, ou dont les deux rangs partagent un
modèle. Une liste ne le montrerait pas.

Sa place naturelle est *Réglages en service*, qui pose déjà la question *« qu'est-ce
qui tourne, et est-ce que ça marche »*.

---

## 7. Ce qui reste à trancher, et qui n'est pas pour le serveur

**Les trois noms.** La §7 de la spec portrait dit que les trois noms de style de
photo ne sont pas arrêtés. Ils vivent en base, donc rien ne bloque le serveur —
mais l'écran ne peut pas s'ouvrir sans eux, et c'est le premier geste de ce
chantier.

Les trois familles d'illustration, elles, sont nommées : nature, animal,
abstrait.

---

## 8. Les trois points d'accessibilité du lot, non corrigés

Ils sont relevés dans son propre README, et ils comptent :

- **Le message du portrait rendu à 7,8 px**, sa signature à 6,9 px. On ne peut
  pas juger un rendu qu'on ne peut pas lire — c'est pourtant ce que l'Atelier
  prétend permettre. Il manque un agrandissement.
- **Deux listes sans nom rattaché** — « Modèle » et « Profil d'essai » portent un
  `<strong>` au-dessus, pas un `<label for>`.
- **Les flèches d'ordonnancement à 18 × 14 px.** C'est un outil de bureau, donc
  44 px n'est pas la règle absolue ; 14 px de haut pour réordonner une liste, si.

---

## Le fil

Le lot a raison sur presque tout, et son intuition du rang était juste avant
qu'on la spécifie. Ce qui lui manque tient en une phrase : **on ne peut pas
régler un ton et l'appairer à un modèle au même endroit**, parce que régler le
ton défait l'appairage.
