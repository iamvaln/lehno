# Lehno — Design system

Ce document rassemble les décisions visuelles arrêtées et les rend exploitables : les jetons à déclarer, les composants à construire, les règles qui les gouvernent. Il sert le paquet `tokens` du monorepo, et vaut pour les trois surfaces — application mobile, pages publiques, back-office.

Il découle du parti pris de conception (§1 de `ux-app-mobile-lehno.md`) et de la **charte d'identité visuelle**, qui fait autorité sur tout ce qui touche à la marque : logotype, signe, palettes, mouvement, fichiers livrés. En cas d'écart, la charte l'emporte.

## 1. Ce qui gouverne les choix

**L'application vise le minimalisme élégant** : peu d'éléments, chacun à sa place, beaucoup de blanc. Le produit promet de libérer l'esprit ; l'interface doit le montrer.

Sept règles en découlent, et elles tranchent les cas particuliers mieux qu'un catalogue de composants :

1. **Un écran, une intention.** Chaque écran répond à une question et lui consacre sa place.
2. **Une seule action mise en avant.** Un écran comporte au plus un bouton plein.
3. **Ce qui est rare vit ailleurs.** Un geste qu'on fait quelques fois par an ne prend pas la place d'un geste quotidien.
4. **La couleur guide, elle n'habille pas.** Le violet marque ce qui agit ; le texte courant reste sombre sur clair.
5. **La chaleur vient de la typographie.** L'écart entre un caractère à empattements souples et un texte net donne le ton, plutôt qu'un aplat de couleur.
6. **Le texte parle, l'ornement se tait.** Une phrase juste vaut mieux qu'un compteur.
7. **Le calme est une réponse.** Un écran sans rien à traiter le dit sereinement.

## 2. Couleurs

### 2.1 Le principe

Les couleurs se déclarent **par rôle**, jamais par valeur. Chaque rôle porte sa déclinaison dans les deux thèmes ; un composant nomme le rôle et ignore la valeur. Un écran écrit en hexadécimal est un écran qui ne bascule pas.

### 2.2 Les jetons

| Rôle | Clair | Sombre | Emploi |
|---|---|---|---|
| `bg` | `#FFFFFF` | `#17161F` | Le fond de l'écran |
| `surface` | `#FAF9FC` | `#1E1C29` | Un fond légèrement détaché du précédent |
| `card` | `#FFFFFF` | `#1B1928` | Le fond d'une carte posée sur `surface` |
| `panel` | `#EDEAF7` | `#2E2945` | La mise en avant : l'échéance du jour, un bloc d'accueil |
| `text` | `#221F2B` | `#F2F0F7` | Le texte courant |
| `muted` | `#4A4556` | `#B9B4C6` | Le texte secondaire : dates, précisions |
| `faint` | `#6B6579` | `#9A94A8` | Les mentions discrètes : légendes, surtitres, provenance |
| `line` | `#EDEBF2` | `#2A2836` | Les séparations à l'intérieur d'un bloc |
| `line2` | `#E2DDF0` | `#3D3757` | Le contour d'une carte |
| `edge` | `#88839A` | `#726C96` | Le contour d'un champ ou d'un bouton en retrait |
| `violet` | `#7B6BB7` | `#9C8BD8` | Ce qui agit : bouton plein, onglet actif |
| `violet-deep` | `#5A4B93` | `#C3B4EE` | Le décompte, un lien, un état appuyé |
| `on-violet` | `#FFFFFF` | `#15131D` | Le texte posé sur `violet` |
| `apricot` | `#F0CFB4` | `#F0CFB4` | L'accent chaud, rare |
| `on-apricot` | `#7A4A22` | `#3A2413` | Le texte posé sur `apricot` |
| `band` | `#221F2B` | `#41357E` | Une bande pleine, sur le web |
| `on-band` | `#FFFFFF` | `#F2F0F7` | Le texte sur cette bande |

### 2.3 Deux paires mesurées

**Le gris de mention sur panneau lilas.** `#6B6579` sur `#EDEAF7` donne **4,708:1** — au-dessus du seuil. La valeur précédente (`#726E82`) donnait 4,15 et échouait : la provenance apparaissant sur panneau, sous le brouillon, la combinaison est courante. Le gris retenu est celui du texte, ce qui évite d'ajouter une couleur ; la hiérarchie entre mention et texte secondaire tient désormais par la **taille** (11,5 contre 14 px), signal plus sûr que trois pas de gris.

**Le blanc sur violet.** `#FFFFFF` sur `#7B6BB7` donne **4,537:1** — au-dessus du seuil, de trois centièmes. On n'y touche pas : c'est le violet du logotype, et un logotype n'obéit pas à une contrainte de texte. Mais **toute retouche du violet, même d'un pas, se re-mesure avant adoption**. Si de la marge devenait nécessaire, `#7566B0` donne 4,902 pour un écart imperceptible.

### 2.4 Ce que chaque couleur a le droit de faire

- **Le violet appartient à l'action.** Un bouton, un onglet actif, un lien, un décompte. Il ne teinte jamais le texte courant : une fiche de proche se lit longuement.
- **Le lilas (`panel`) désigne ce qui compte à l'instant** — l'échéance du jour, et rien d'autre sur le même écran. Deux blocs lilas côte à côte se neutralisent.
- **L'abricot se réserve aux moments heureux** : le jour même, un crédit reçu, une bonne nouvelle. C'est sa rareté qui lui donne sa valeur ; l'employer comme couleur d'habillage la lui retire.
- **Le rouge n'appartient pas à l'identité.** Il sert l'erreur, l'action destructrice et l'état hors service, et rien d'autre (voir 11.1).

### 2.5 Le thème sombre rejoue la palette, il ne l'inverse pas

Deux couleurs changent de valeur pour rester lisibles, une troisième change de rôle. Ce qui ne bouge pas : l'abricot, qui tient sur les deux fonds, et la rareté de son emploi.

- **Le violet s'éclaircit** (`#7B6BB7` → `#9C8BD8`) : la même valeur perdrait son contraste sur fond profond.
- **Le texte du bouton plein passe à l'encre** (`#15131D`) : un blanc sur violet clair ne mesure que 2,96:1, quand l'encre donne 6,2:1 au repos.
- **Un aplat de clôture apparaît** (`#41357E`), rôle qui n'existe pas en clair : l'encre ne tranche pas sur l'encre.

**La règle d'écart.** Un même écart de clarté se voit moins dans les basses lumières. Entre le fond et le lilas, il faut **ΔL\* 10,6** en sombre pour obtenir la lisibilité que **ΔL\* 6,7** donne en clair — environ une fois et demie. **Toute alternance de fonds reprise du thème clair se re-mesure, jamais ne se transpose.**

**Aucune ombre, dans aucun thème.** La profondeur vient des filets d'un pixel. Une ombre traverse mal le passage au sombre, où elle disparaît ou salit.

## 3. Typographie

### 3.1 Les deux caractères

- **Fraunces** — titres, noms de personnes, décomptes. Empattements souples, légère irrégularité. Réglages : `SOFT` 40, `WONK` 1. Graisses 400 et 500.
- **Karla** — texte courant, libellés, boutons. Humaniste, lisible sur un écran dense. Graisses 300 à 700.

L'élégance tient à l'écart entre les deux : un titre qui a du caractère, un texte qui s'efface.

### 3.2 L'échelle

| Rôle | Taille | Caractère | Graisse | Interligne |
|---|---|---|---|---|
| Titre d'écran | 25 px | Fraunces | 500 | 1.15 |
| Titre de section | 19–22 px | Fraunces | 500 | 1.2 |
| Nom d'une personne | 17–19 px | Fraunces | 500 | 1.2 |
| Décompte | 20–24 px | Fraunces | 500 | 1 |
| Texte courant | 16 px | Karla | 400 | 1.55 |
| Texte secondaire | 14 px | Karla | 400 | 1.5 |
| Mention, légende | 12–13 px | Karla | 400 | 1.45 |
| Surtitre | 11 px | Karla | 600 | — |
| Libellé de bouton | 14–16 px | Karla | 600 | — |
| Libellé d'onglet | 10.5–11 px | Karla | 600 | — |

**Le crénage suit la taille** : les grands titres se resserrent (`-0.02` à `-0.035em`), le texte courant reste au naturel. Les surtitres s'écartent (`0.12em`) et passent en capitales.

### 3.3 Ce que porte Fraunces

Les noms de personnes, les titres et les décomptes — c'est-à-dire **ce qui touche aux gens et au temps**. Le reste appartient à Karla. Un libellé de bouton en Fraunces alourdit ; un nom de proche en Karla perd sa chaleur.

## 4. Mesures

### 4.1 Espacement

Base de 4 px. Les valeurs employées : 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32, 44.

- **Marge d'écran** : 16–20 px sur mobile ; largeur de lecture bornée sur grand écran plutôt qu'un étirement.
- **Entre deux cartes d'une liste** : 8–10 px.
- **Entre deux sections** : 18–24 px.
- **Intérieur d'une carte** : 12–15 px.

### 4.2 Rayons

| Élément | Rayon |
|---|---|
| Champ, petit bouton | 8–10 px |
| Carte, bloc | 12–14 px |
| Grand panneau, écran modal | 18–28 px |
| Étiquette, pastille | 999 px |
| Icône d'application | 22.5 % du côté |

### 4.3 Filets

Un pixel, en `line` à l'intérieur d'un bloc, en `line2` pour le contour d'une carte. **Le filet remplace l'ombre partout.**

## 5. Composants

### 5.1 Boutons

| Variante | Fond | Texte | Contour | Emploi |
|---|---|---|---|---|
| **Plein** | `violet` | `on-violet` | — | L'action principale. Un seul par écran |
| **Contour** | transparent | `violet-deep` | `violet` | Une action de même rang qu'une autre |
| **Discret** | `panel` | `violet-deep` | — | Une action secondaire dans un bloc mis en avant |
| **Nu** | transparent | `muted` | `edge` | Une action de service : basculer, fermer |

**Trois rangs, jamais plus sur un même écran** : un seul bouton plein par vue — l'action qui fait avancer ; le contour porte l'alternative ; le texte seul les actions de service.

| | Web | Mobile |
|---|---|---|
| Hauteur | 40 px | 48 px, jamais sous 44 px de cible tactile |
| Texte | 15 px | 16 px |
| Rayon | 10 px | 12 px |

L'écart de rayon suit la taille du doigt, non le goût. Libellé en Karla 600.

**Deux boutons côte à côte n'occupent la même largeur que s'ils ont le même poids.**

**Il n'y a pas de bouton « succès ».** Le succès est un état, pas une action : on ne clique pas sur une réussite. Ce que le succès demande, c'est un bandeau.

**Le focus clavier ne se supprime jamais.** Contour de 2 px en violet, décalé de 2 px, sur les deux thèmes et sur tous les rangs — y compris le bouton texte. C'est la seule bordure que la marque ajoute sans qu'on la dessine.

### 5.2 Carte d'échéance

La brique la plus employée. Deux états :

- **Imminente** — fond `panel`, nom en Fraunces, date en `muted`, étiquette `apricot` si c'est aujourd'hui, et **deux actions visibles** (*préparer*, *marquer envoyé*).
- **À venir** — fond `card`, contour `line2`, décompte en Fraunces `violet-deep` à droite. Une ligne calme.

Une seule carte imminente par écran.

### 5.3 Ligne de liste

Avatar ou initiale à gauche, nom en Fraunces, précision en `muted` dessous, valeur ou décompte à droite. Séparation en `line`, ou carte à contour selon la densité voulue.

### 5.4 Étiquette

Rayon plein, 5 px sur 11–12 px de rembourrage, Karla 600 à 12 px.
- **Neutre** : fond `panel`, texte `violet-deep` — un type d'événement, un état.
- **Chaude** : fond `apricot`, texte `on-apricot` — aujourd'hui, une bonne nouvelle.

### 5.5 Champ de saisie

Fond `card`, contour `edge`, rayon 10 px, rembourrage 12–15 px, texte 16 px — **jamais moins**, sous peine que le navigateur mobile agrandisse la page à la mise au point. Le libellé se place au-dessus, en `faint` à 12 px.

### 5.6 Barre d'onglets

Quatre onglets : **Accueil · Dates · Proches · Moi**. Icône de 21 px au-dessus d'un libellé de 10.5 px. Actif en `violet-deep`, inactif en `faint`. Filet supérieur en `line`, fond `surface`.

Les icônes : maison, calendrier, **cœur**, silhouette — quatre formes nettement distinctes.

### 5.7 En-tête

Nom de la marque à gauche, **cloche** à droite avec sa pastille de décompte en `apricot`. Filet inférieur en `line`. L'en-tête ne porte aucune action de création : ce qui est rare vit ailleurs.

## 6. Les deux conventions de marque

Ce qu'on reconnaît de Lehno d'un écran à l'autre. Éprouvées sur la landing avant adoption.

### 6.1 La ligne de provenance

Dans Lehno, chaque élément vient de quelque part. La provenance se dit **toujours au même endroit et de la même façon** : en pied de l'élément, sous un filet d'un pixel.

- **Icône de retour** — 13 px, flèche courbe vers l'arrière.
- **Texte** — 11,5 px, Karla 400, gris de mention.
- **Structure** — *origine · date*, séparées par un point médian.

**Elle n'apparaît que si elle apprend quelque chose** — une date (« noté en mars »), une source (« dit par lui, en janvier »), une quantité (« écrit à partir de 9 notes »). Elle s'abstient partout où elle énoncerait ce que l'élément dit déjà : des étiquettes de goûts viennent forcément des notes, « d'après vos notes » n'apprendrait rien.

**Une seule par élément, jamais plus de deux par bloc.** Au-delà, la répétition la transforme en motif décoratif.

### 6.2 L'italique pour la parole

**Fraunces italique marque ce que quelqu'un a dit ou écrit** : une note rapportée, un souhait exprimé, un brouillon de message, la phrase d'un portrait. Le texte de produit reste en Karla romain.

Les guillemets accompagnent les citations longues et tombent sur les courtes.

*Cette règle vaut dans l'application, où du contenu d'utilisateur voisine avec du texte de produit. Sur les surfaces marketing, l'italique reste libre de son emploi.*

## 7. Le décompte

Un traitement typographique, non un élément de signature. Composé en **Fraunces**, en `violet-deep`, à une taille supérieure au texte qui l'entoure. Ce qui le distingue d'une donnée, c'est la coupe et le poids.

- **Français** : `J−3` — avec un tiret demi-cadratin (`−`), non un trait d'union.
- **Anglais** : `3 days` — faute d'équivalent au « jour J ».
- **Le jour même** : l'étiquette `apricot` remplace le décompte.

**La notation reste ouverte.** `J−3` disparaît dans une langue sur deux, ce qui l'empêche d'être ce qu'on reconnaît partout. Elle sera éprouvée par un test utilisateur, et d'autres formes sont envisagées — dont une qui vaudrait dans les deux langues.

## 8. États

**Vide.** Un titre, une phrase, et l'action qui débloque. Les textes annoncent **ce qui est possible** plutôt que ce qui manque : jamais « aucun proche », « vide », « rien à faire ».

**Chargement.** Des silhouettes de contenu aux dimensions réelles plutôt qu'un tourniquet centré : l'écran ne saute pas quand la donnée arrive.

**Attente longue** — génération, paiement. L'écran dit ce qui se passe, laisse **quitter sans perdre**, et prévient à l'aboutissement.

**Erreur.** Ce qui s'est passé, et ce qu'on peut faire. Le client traduit un code ; il n'affiche jamais le message technique.

## 9. Accessibilité

- **Contraste** — seuil AA sur tout texte, dans les deux thèmes. Les deux palettes ont été mesurées ; les paires les plus serrées sont consignées en 2.3, avec la règle qui les accompagne : **une paire à moins d'un dixième du seuil se re-mesure à chaque retouche**.
- **Zones tactiles** — 44 px minimum, y compris pour la cloche et les onglets.
- **Taille de texte** — la préférence du système est respectée jusqu'aux plus grandes valeurs ; les mises en page tiennent quand le texte grandit. Aucune hauteur fixe sur un bloc qui contient du texte.
- **Mouvement** — la réduction des animations est respectée ; aucune information ne dépend d'une transition.
- **La couleur ne porte jamais seule une information** : un souhait réservé porte une mention, pas seulement une teinte.
- **Zones sûres** — encoches et barres système prises en compte ; aucune action logée dessous.

## 10. Bilingue

Trois contraintes que le dessin doit absorber :

- **Les libellés respirent.** Une phrase peut s'allonger d'un tiers d'une langue à l'autre : boutons et onglets prévoient cette marge plutôt que de tronquer.
- **Les textes se composent entièrement** dans chaque langue, avec leurs variantes de singulier et de pluriel — jamais recollés à partir de morceaux.
- **Dates, nombres et décomptes suivent la langue.**

## 11. Messages, icônes, mouvement

### 11.1 Les quatre couleurs de message

Quatre intentions, quatre couleurs — et **l'information n'en reçoit pas de nouvelle** : c'est le violet de la marque qui parle, puisque c'est le produit qui s'adresse à vous. L'abricot reste hors de ce jeu ; il célèbre, il n'avertit pas.

| Intention | Clair | Sombre | Contraste |
|---|---|---|---|
| Information | `#5A4B93` | `#C3B4EE` | Le violet profond de la marque |
| Succès | `#166B43` | `#7ED9A6` | 6,5:1 sur blanc · 10,6:1 sur sombre |
| Avertissement | `#8A5A00` | `#E3B25C` | Ambre saturé — jamais l'abricot |
| Erreur | `#B3261E` | `#F2B37A` | 6,5:1 sur blanc · 7,1:1 sur sombre |

**Les bandeaux.** Fonds teintés `#EDEAF7` · `#E6F4EC` · `#FBF0DC` · `#FBEAE8` en clair ; `#2E2945` · `#163024` · `#322814` · `#35191A` en sombre. Angles droits, aucune bordure, aucune ombre : **le bandeau est une bande, pas une carte**. Une icône, une phrase, et l'action de fermeture seulement si le message survit au changement d'écran.

**Le rouge ne sert qu'à trois choses** : l'erreur de saisie, l'action destructrice, l'état hors service. Il ne décore pas, il ne souligne pas, il ne signale pas l'urgence d'une date. **Il ne côtoie jamais l'abricot** — deux couleurs chaudes voisines, et l'une des deux cesse d'être un signal.

### 11.2 Les icônes

- **Famille** — Lucide, contours ouverts, aucune icône pleine.
- **Grille** — 24 × 24, taille de référence 20 px.
- **Trait** — 1,8 pour le contenu ; 2 sous 16 px et pour les chevrons.
- **Extrémités et angles arrondis**, toujours.
- **Couleur** — celle du texte qu'elle accompagne, jamais une couleur propre.

### 11.3 Le mouvement

| Durée | Emploi |
|---|---|
| 120 ms | Survol, focus, changement d'état d'un bouton — `ease-out` |
| 220 ms | Apparition d'une carte, ouverture d'un accordéon, bascule de thème — `cubic-bezier(.22,.8,.24,1)` |
| 340 ms | Changement d'écran, panneau qui entre — `cubic-bezier(.36,0,.16,1)` |

**Deux courbes seulement** : la première pour ce qui se pose, la seconde pour ce qui traverse. Rien ne rebondit, rien ne dépasse.

**`prefers-reduced-motion` supprime toute durée** : les éléments prennent leur état final d'emblée. Ce n'est pas une dégradation, c'est l'une des deux manières prévues d'afficher la marque.

## 12. Ce qui reste à décider

- La **notation du décompte**, à éprouver par un test utilisateur.
- La **reprise à la main du logotype** sur les courbes livrées, le masque circulaire et la marge de recadrage pour les magasins d'applications.
- L'**écran de lancement** et le filigrane du portrait partagé.
