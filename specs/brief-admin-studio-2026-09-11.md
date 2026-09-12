# Ce que le studio a gagné aujourd'hui, et ce que le panneau doit en faire

*11 septembre 2026. Complète `ecrans-atelier-des-textes-2026-09-11.md`, écrit le
même jour et qui décrit les écrans des trois natures de texte. Ce document-ci
dit ce qui a changé **sous** ces écrans pendant qu'ils se dessinaient.*

Il est écrit parce que deux sessions ont travaillé en parallèle sur la même
surface, et que le document voisin décrit comme des contraintes deux choses qui
n'en sont plus.

---

## 1. Ce que le document voisin tient pour vrai, et qui ne l'est plus

> « `/admin/portrait-studio/trials` n'a **aucun filtre par nature** : il rend les
> cent derniers essais, les quatre natures mêlées. »

**C'est réparé.** L'atelier des textes a maintenant ses deux gestes manquants :

| Route | Ce qu'elle fait |
|---|---|
| `GET admin/text-studio/:nature/trials` | les essais de cette nature. `?configId=` les borne à une version |
| `PATCH admin/text-studio/trials/:id` | le verdict — `kept` / `discarded` |

**Le filtre se fait sur la CONFIGURATION, pas sur une colonne.** `StudioTrial` ne
porte pas de nature : il porte `studio_config_id`, et c'est la configuration qui
dit laquelle. Ajouter une colonne aurait créé une seconde vérité à tenir
d'accord — et un essai dont la nature contredirait celle de sa configuration
serait indéchiffrable.

Demander les essais d'une configuration d'une **autre** nature par ce chemin rend
**404**, pas une liste vide : c'est une erreur d'appel, et une liste vide la
laisserait passer pour un fait.

`PATCH trials/:id` ne porte pas la nature, comme `config/publish` : il vise un
essai par son identifiant, et l'essai dit à quelle configuration il appartient.

---

## 2. Le verdict d'un texte n'accepte PAS `reference`

Celui du portrait la porte désormais. `verdictEssaiTexteSchema` ne la porte pas,
et `.strict()` **refuse** le corps qui la contient.

Ce n'est pas une omission : un essai de texte n'a pas d'image, et une ambiance ne
se représente pas par une phrase. Le champ est retiré plutôt qu'ignoré — un
administrateur qui croirait poser une vignette sur un essai de message doit
l'apprendre tout de suite, et non découvrir qu'il ne s'est rien passé.

---

## 3. Les vignettes du catalogue — un geste à dessiner

`studioChoiceSchema` porte maintenant **`previewUrl`**, nullable.

> « Un choix de rendu ne se fait pas avec des mots : personne ne sait départager
> "chaleureux" et "sobre" dans l'abstrait. »

L'application montre donc l'image qu'on aura, sur les voies d'image, les
familles d'ambiance et les compositions. **Pas sur l'orientation** — c'est le
propos, pas le rendu.

**Le panneau est le seul endroit où elle se pose**, et le geste manque à l'écran :

```
PATCH admin/portrait-studio/trials/:id   { verdict: "kept", reference: true }
```

Trois choses à savoir pour le dessiner :

- **Il n'est offert que sur un essai retenu qui a produit une image** et qui
  porte une ambiance. Les trois autres cas sont refusés en 400.
- **Il écrit un BROUILLON**, jamais la version en service. La vignette suit la
  version publiée comme le reste du catalogue : retenir un essai ne change rien
  pour les utilisateurs tant que personne n'a publié.
- **Il est gratuit.** La vignette n'entre pas dans l'empreinte — c'est ce que
  l'humain regarde, pas ce que le modèle lit —, donc il passe par
  l'enregistrement direct et ne réclame aucun nouvel essai. L'y mettre aurait
  fait retomber toute la couverture dès qu'on choisit une image.

Sans vignette publiée, `previewUrl` est nul et la grille retombe sur la
description. **C'est l'état d'un catalogue neuf**, pas une panne.

---

## 4. `photo_style` n'existe plus

Les deux voies d'image — illustration et photo — ouvrent désormais **la même
famille d'ambiances**.

Il y avait deux groupes, et le second n'a **jamais** eu d'ambiance : c'est ce qui
rendait la voie photo invisible, et ce qui obligeait à inventer « trois noms de
style de photo » que personne n'avait tranchés. Or ce sont les mêmes : nature,
animal et abstrait disent ce qu'on veut voir, et la photo ne change pas le
sujet — seulement d'où l'on part.

**Conséquence pour l'atelier du portrait** : le modèle appelé ne se déduit plus
de l'ambiance. Il se déduit de la **voie**. `StudioAtelier` le faisait — une
ambiance `photo_style` appelait `modeles.photo_style` — et c'est corrigé : un
essai éprouve toujours l'illustration.

**Ce qui reste à faire, et c'est le seul endroit où la voie photo coûte plus
qu'un champ** : éprouver la voie photo demande une **photo d'exemple**. Un profil
de simulation porte des notes et un texte libre, pas d'image. Soit l'essai en
fournit une, soit les profils en gagnent une.

---

## 5. ~~Les réglages de la photo — un bloc à mettre au formulaire~~ — FAIT le 12

> **Le bloc est au formulaire de l'Atelier**, en deux familles et un seul
> liséré : la consigne porte celui de « ce que le modèle lit », les trois seuils
> non.
>
> **Un défaut trouvé en l'écrivant, et corrigé d'abord.** `photo.consigne` est
> littéralement dans l'invite — `portrait.service` la passe à
> `inviteImagePortrait` dès que la voie est la photo — et
> `partieLueParLeModelePortrait` ne la portait pas. On la reformulait,
> l'empreinte ne bougeait pas, la couverture d'essai de l'ancienne restait
> valable, et **la publication s'ouvrait sur une consigne que personne n'avait
> vue**. Les trois seuils restent dehors, eux, pour la raison inverse : le
> modèle ne les voit jamais, et les compter ferait retomber la couverture pour
> vingt pixels.
>
> **Et l'absence du bloc n'est pas symétrique** — c'est ce que ce paragraphe
> demandait de savoir afficher, et c'était plus subtil qu'« afficher vide ».
> Sans rien de publié, les seuils du code s'appliquent **déjà** (512/30/12),
> tandis que la consigne n'existe pas du tout. Montrer les trois nombres sans
> le dire les ferait passer pour des réglages enregistrés.
>
> D'où la naissance du bloc : seuils depuis le semis, consigne **vide**. Et
> comme le schéma exige la consigne dans ses deux langues, toucher un seuil la
> rend obligatoire — les trois gestes qui emportent les réglages se ferment tant
> qu'elle manque.

`reglagesPortraitSchema` porte un bloc `photo`, **facultatif** :

| Champ | Ce que c'est |
|---|---|
| `consigne` | bilingue. Ce qu'on demande au modèle de faire de la photo — s'en inspirer sans reproduire les traits, rester dans l'ambiance choisie |
| `coteMin` | le plus petit côté en pixels, 256 à 4096 |
| `luminositeMin` | la luminosité moyenne, 0 à 255 |
| `nettetteMin` | l'écart-type des niveaux, 0 à 128 |

Les trois nombres sont les **seuils de refus** d'une photo déposée : trop petite,
trop sombre, trop plate. Ils se règlent au vu de ce qui arrive, et c'est
précisément pourquoi ils ne sont pas en dur — on ne livre pas pour remonter un
seuil de vingt pixels.

**Le bloc est facultatif à dessein.** Le schéma est `.strict()` : l'exiger aurait
rendu illisibles d'un coup toutes les configurations déjà en base. Un formulaire
doit donc savoir l'afficher vide, et le code retombe sur ses valeurs de départ
quand il manque.

Une précision sur `nettetteMin` : ce n'est **pas** une mesure de flou au sens
propre — celle-là demanderait un laplacien. C'est l'écart-type des niveaux, qui
s'effondre avec le contraste local. Le libellé de l'écran ne devrait pas promettre
plus que ça.

---

## 6. Ce qui manque encore, et qui décide de la suite

**Aucune production ne porte d'avis, sauf les idées.** Un portrait ne connaît que
`generated` et `approved` ; un message, `generated` / `edited` / `sent`. On peut
approuver, jamais rejeter.

**Et aucune ne dit sur quelle version elle a été produite**, sauf le portrait
(`portrait.studio_config_id`).

Les deux manquent ensemble, et il les faut ensemble : un pouce en bas sans savoir
quelle version l'a produit ne mesure rien, et une version publiée sans avis ne
dit pas si elle vaut mieux que la précédente. **C'est ce qui donnerait son sens à
tout l'atelier** — aujourd'hui on publie sans jamais savoir si on a amélioré quoi
que ce soit.

Une lecture à prévoir au panneau, une fois les deux posés : combien de pouces en
bas par version, comparée à la précédente.

---

## 7. Et le ménage du stockage, qui en dépend

Deux choses s'accumulent dans R2 sans que rien ne les distingue :

- **les images des essais d'administration** — une par essai, et une séance de
  réglage en compte trente. Elles sont rangées sous le préfixe `portraits`, **le
  même que les portraits payés**. Une règle de cycle de vie posée là effacerait
  ce que les gens ont acheté. Un préfixe `essais` réglerait ça, et c'est deux
  lignes ;
- **les portraits refaits.** « Refaire » est une nouvelle génération complète :
  chaque approbation fabrique une image et la range. Quelqu'un qui refait trois
  fois laisse trois images, et rien ne dit laquelle il voulait.

**Le second ne se purge pas sans les avis du §6.** Sans un rejet explicite, on ne
peut rien effacer sans risquer d'emporter ce que quelqu'un gardait.

Le préfixe `sources` — les photos dont le portrait s'inspire — est déjà à part,
et son contenu s'efface après usage : c'est ce que l'écran promet au dépôt.
