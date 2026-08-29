# Le stockage des fichiers — R2

Cinq surfaces l'attendent, et aucune n'a de code : les portraits produits, les
avatars, les images de souhaits, **les reçus de paiement** (`payment.proofKey`)
et **les archives d'export de données**.

Les décider une par une reviendrait à décider pour les quatre autres sans les
regarder. D'où ce document, écrit avant la première ligne.

---

## Pourquoi R2 plutôt qu'une plateforme média

**Parce qu'il n'y a pas que des images.** Un reçu est un fichier, une archive
d'export aussi. Une plateforme média n'en prend aucun des deux, et obligerait à
un second stockage — deux intégrations, deux jeux de clés, deux politiques de
rétention pour un seul besoin.

**Parce que les URL présignées y sont celles de S3.** R2 est compatible S3 : le
SDK standard les produit, et le jour où l'on change de fournisseur, le code ne
bouge pas. Une signature propriétaire aurait lié la forme des URL au prestataire.

**Parce que la sortie ne se facture pas.** Un portrait pèse un à deux
mégaoctets et se regarde plusieurs fois depuis un téléphone. C'est le poste qui
coûte ailleurs.

Ce que R2 ne fait pas : **aucune transformation**. On sert ce qu'on a rangé.

---

## Ce que ça oblige, et pourquoi c'est acceptable

L'écran prévoit une vignette et un agrandissement à 620 px. Il faut donc deux
variantes — et **on les écrit au dépôt**, parce qu'on contrôle la génération :
le modèle rend une image, on en range deux.

Cette réponse ne vaudrait pas si les images venaient des utilisateurs dans des
formats imprévisibles. Un seul cas s'en approche — l'avatar —, et un avatar n'a
qu'une taille.

---

## Les règles qui tiennent le reste

**Rien de public.** Pas de compartiment ouvert : le serveur rend une URL
présignée en lecture, à durée courte. Un compartiment public transformerait
chaque lien partagé une fois en lien ouvert pour toujours.

**Le dépôt se fait par URL présignée**, jamais en passant par l'API : un
portrait de deux mégaoctets qui traverse le serveur occupe une connexion pour
rien, et un reçu déposé depuis un téléphone en zone lente la tiendrait longtemps.

**Les reçus s'effacent tout seuls.** La spec est formelle — `proofKey` disparaît
une fois la demande traitée, *« le reçu ne prouve rien, c'est la réception sur
le compte qui fait foi »*. Une règle de cycle de vie s'en charge, sans qu'aucun
code n'ait à y penser.

**La clé n'est jamais devinable.** Ni `portraits/{userId}/1.png`, ni un
compteur : un identifiant aléatoire. Une clé qui se devine rend le compartiment
public par déduction, même fermé.

**Ce que la base garde, c'est la CLÉ, jamais l'URL.** Une URL présignée expire ;
la ranger en base donnerait des liens morts et lierait la donnée au fournisseur.
Les colonnes s'appellent d'ailleurs déjà `proofKey` — le nom dit ce qu'il faut y
mettre. `avatarUrl` et `imageUrl`, eux, portent un nom qui invite à l'erreur.

---

## Ce qu'il faudra fournir, le moment venu

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
```

Le jeton se crée sous *R2 → Manage API tokens*, en **Object Read & Write**,
**limité au seul compartiment**. Jamais un jeton de compte : celui-ci ne doit
pouvoir toucher qu'à ce seau.

---

## Ce que ça débloque

Le studio, d'abord. L'essai du portrait ne peut pas être éprouvé tant qu'une
image n'a nulle part où aller — et c'est le dernier morceau du découpage
message/portrait.

Puis la livraison des exports de données, les avatars, et les reçus déposés
depuis le téléphone plutôt que saisis par l'administration.
