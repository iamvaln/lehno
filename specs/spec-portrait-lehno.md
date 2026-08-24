# Lehno — Le portrait : studio, gabarits et génération

Le portrait est **une image** qu'un utilisateur compose pour un proche et lui envoie, accompagnée d'un mot. Il ne s'expose sur aucune page : il circule dans les conversations, en portant le pied de marque.

Ce document couvre trois choses : ce que l'utilisateur choisit (**le studio**), ce que la composition produit (**les gabarits**), et ce qu'on demande aux modèles (**les briefs de génération**).

---

## 1. Ce qu'est un portrait

> Une illustration de ce qu'on veut exprimer à quelqu'un à un moment donné, personnalisée, fondée sur la relation qu'on a avec lui.

Ce n'est ni une carte d'anniversaire, ni une fiche de profil. Un portrait peut s'offrir n'importe quand — rien dans sa composition ne le rattache à une occasion précise.

**Deux principes qui gouvernent tout le reste**

- **Une image, pas une étiquette.** Écrire « chats, voyages, mer » sur un fond catalogue quelqu'un. Dessiner un chat au bord de la mer dit qu'on l'a écouté. Le portrait montre, il n'énumère pas.
- **Une seule image par portrait.** Illustration **ou** photo traitée **ou** rien. Jamais deux, sous peine de surcharge.

---

## 2. Le studio

Ce que l'utilisateur règle avant de lancer la génération. Chaque choix a un défaut, et l'écran reste franchissable en quelques gestes.

### 2.1 L'orientation du message

**Ce qu'on veut dire.** C'est le premier choix, et il commande le texte comme l'illustration.

| Orientation | Ce qu'elle exprime |
|---|---|
| **Notre relation** | Ce que vous êtes l'un pour l'autre |
| **Tes progrès** | Ce qu'il a accompli cette année |
| **Nos progrès** | Ce que la relation est devenue |
| **Une motivation** | Un élan pour ce qui vient |
| **Un soutien** | Un accompagnement dans ce qu'il traverse |
| **Ce qui te caractérise** | Ce qui le rend reconnaissable |
| **Ma fierté** | Ce dont vous êtes fier pour lui |
| **Mon affection** | Une déclaration, dans son registre |
| **Ma gratitude** | Ce que vous lui devez |
| **Ce que tu m'as appris** | Ce qu'il vous a transmis |
| **Un vœu** | Ce que vous lui souhaitez pour l'année qui vient |
| **Un hommage** | Pour une mémoire, une absence |

**L'hommage est à part.** Il neutralise l'abricot, écarte toute illustration joyeuse, et emprunte un registre propre. Une occasion sensible ne peut pas partager le gabarit d'une déclaration de fierté.

### 2.2 L'image

**Trois voies, une seule à la fois.**

- **Une illustration** — composée à partir de ce qu'on sait du proche.
- **Une photo traitée** — jamais une photo brute ; toujours un style appliqué.
- **Aucune image** — le motif de marque tient alors tout le fond.

### 2.3 Si l'illustration est choisie

**Trois familles**, au choix ou proposées selon les notes :

- **Nature** — un paysage, une fleur, un élément. Pour qui est calme, enraciné, tourné vers le dehors.
- **Animal** — un animal qu'il aime s'il figure dans les notes, sinon un qui correspond à son caractère.
- **Abstrait** — des formes, un mouvement, une lumière. Pour qui échappe aux deux autres.

**Un champ de texte libre** accompagne ce choix : *ce qu'il faut savoir de lui pour le dessiner*. Il complète les notes, sert la génération, et n'est conservé nulle part au-delà.

### 2.4 Si la photo est choisie

**Trois styles nommés**, définis par la marque. L'utilisateur choisit ; il n'y a pas de réglage libre.

L'écran indique, au moment du dépôt, que **l'image est transmise à un service qui la transforme** et qu'elle n'est pas conservée.

### 2.5 Les réglages communs

- **Le nom** sous lequel le proche apparaît — son nom d'usage par défaut.
- **La plage de notes** retenue : tout l'historique (défaut), douze mois, depuis le dernier portrait, dates fixées.
- **La note de l'expéditeur** — courte, discrète, proposée puis modifiable (« Fait avec soin par Valentine »).
- **La langue** — celle de la fiche par défaut.

---

## 3. Les gabarits

Trois compositions, une par voie d'image. Toutes partagent la **bande basse** et le **pied de marque**.

### 3.1 Avec illustration

L'illustration occupe le haut. Une **bande basse** porte le texte, avec le motif en fond sous un voile qui garantit la lisibilité.

### 3.2 Avec photo traitée

Même structure. Le traitement du visage remplace l'illustration.

### 3.3 Sans image

Le **motif prend tout le fond**, sous un voile plus léger, et le texte respire sur toute la surface. C'est le gabarit le plus typographique — une affiche.

### 3.4 Les motifs

Deux motifs, deux emplois, **jamais les deux sur un même portrait** :

- **La trame de hampes** dans la bande basse — le seul motif qui accepte du texte par-dessus.
- **Les registres** en fond plein du gabarit sans image — le seul qui « ait quelque chose à dire : une suite qui revient ».

### 3.5 Ce que porte la bande

Dans cet ordre : **le nom du proche** · **le message** · **la note de l'expéditeur** · **le pied de marque** (lehno.app et les identifiants sociaux, discrets).

### 3.6 Les formats

| Usage | Format | Priorité |
|---|---|---|
| Partage en conversation | Carré, 1080 × 1080 | Le principal |
| Story et statut | 1080 × 1920 | Ensuite |

Le carré est la référence ; le vertical en dérive sans perdre le nom ni le message.

---

## 4. Les briefs de génération

Quatre productions distinctes, quatre briefs. Chacun précise **ce qu'on donne au modèle**, **ce qu'on attend**, et **ce qui doit être écarté**.

### 4.1 Le message

**Ce qu'on fournit** — l'orientation choisie ; le nom d'usage du proche ; la relation et le registre ; les notes de la plage retenue, avec leur date et leur catégorie ; la langue ; le texte libre s'il existe ; la nature de l'occasion (ordinaire ou sensible).

**Ce qu'on attend** — un texte court, **de deux à quatre phrases**, écrit **à la première personne**, adressé au proche. Il tient dans la bande sans être tronqué.

**Les règles**

- Il **s'appuie sur des faits présents dans les notes**. Aucune invention de souvenir, aucun détail que l'utilisateur n'a pas fourni.
- Il **suit le registre de la fiche** — familier, amical, formel.
- Il **suit l'orientation choisie**, sans dériver vers une autre.
- Il **ne mentionne jamais Lehno**, ni le fait d'avoir pris des notes.
- Il **ne date pas** l'occasion et ne dit pas « joyeux anniversaire » : le portrait peut s'offrir n'importe quand.

**Ce qui est écarté** — les superlatifs empilés, les formules de carte de vœux, les emojis, les points d'exclamation multiples, toute mention de l'âge sauf si l'utilisateur l'a demandée.

**Pour une occasion sensible** — registre sobre, aucune réjouissance, aucun conseil, aucune consolation. On constate et on accompagne, on ne réconforte pas.

**Ce qui sort** — un texte, plus une **version courte** de dix à quinze mots pour le format vertical.

### 4.2 L'illustration

**Ce qu'on fournit** — la famille choisie (nature, animal, abstrait) ; les notes qui décrivent goûts, traits de caractère et centres d'intérêt ; le texte libre ; l'orientation du message ; la palette de la marque.

**Ce qu'on attend** — une composition en **aplats pleins**, sans contour, dans la palette, occupant la zone haute du portrait, avec une **zone calme** en bas où la bande viendra se poser.

**Les règles**

- **Trois ou quatre éléments au plus.** Une illustration qui essaie de tout dire ne dit rien.
- **Une scène, pas un catalogue.** Un chat au bord de la mer, non un chat, une valise et une vague côte à côte.
- **Aucun texte dans l'image.**
- **Aucun visage**, aucun trait humain reconnaissable. Une silhouette est admise.
- **Aucun symbole d'occasion** — ni gâteau, ni bougie, ni ballon, ni paquet. Le portrait n'est pas un anniversaire.
- **Aucune ombre portée, aucun dégradé.**
- **L'abricot reste un accent**, jamais une masse.

**Le choix de l'animal** — s'il figure dans les notes, on le prend. Sinon on le déduit du caractère, et **on l'indique à l'utilisateur** : il doit pouvoir corriger. Un animal mal choisi est plus blessant qu'aucun animal.

**Pour une occasion sensible** — palette froide, composition dépouillée, aucun élément vif.

### 4.3 Le traitement de la photo

**Ce qu'on fournit** — la photo recadrée par l'utilisateur, le style retenu.

**Ce qu'on attend** — une **illustration** dérivée de la photo, dans la palette de la marque, et non un filtre appliqué à une image.

**Les trois styles** *(noms de travail, à remplacer)*

- **La lumière** — le visage émerge d'un fond d'encre, éclairé d'abricot et de violet, avec quelques gestes de brosse. Le plus flatteur.
- **La sérigraphie** — quatre aplats, aucune nuance : lumière, demi-teinte, ombre, contour. Le plus régulier.
- **La silhouette** — le contour en aplat plein, sans traits de visage, sur un fond composé. Le repli sûr.

**Les règles**

- **La ressemblance prime.** Un style qui rend quelqu'un méconnaissable a échoué, quelle que soit sa beauté.
- **Aucun ajout** — pas d'accessoire, pas de décor inventé, pas de modification du visage.
- **La palette de la marque**, et elle seule.
- **Un repli** : si le résultat est douteux, on propose « la silhouette », qui tient toujours.

**Avant l'envoi** — une photo trop sombre, trop floue ou trop petite est refusée avec une raison claire, plutôt que traitée mal.

### 4.4 Le classement des notes pour la sélection

**Ce qu'on fournit** — les notes de la plage, avec leurs catégories.

**Ce qu'on attend** — la sélection de celles qui servent le message et celles qui servent l'illustration. Ce ne sont pas les mêmes : un trait de caractère nourrit le texte, un goût nourrit l'image.

**Les règles** — écarter les notes marquées « à éviter », écarter les notes de circonstance périmées, privilégier les plus récentes à contenu égal.

---

## 5. Ce qui se règle depuis le back-office

Le studio porte douze orientations, des familles, des styles, et derrière chacun un gabarit de production. **Rien de tout cela ne vit dans le code** : ce sont des réglages qu'on ajuste au vu des résultats.

La section **Studio du portrait** du back-office (5.8 de `ux-admin-lehno.md`) permet de :

- **régler les orientations** — libellés dans les deux langues, ordre, activation ; si trois orientations sur douze servent, on désactive les autres sans livraison ;
- **tenir les familles et les styles** — nom, description, activation, modèle qui les produit ;
- **modifier les gabarits de production** — un par orientation, par famille, par style ;
- **compléter les garde-fous** à mesure qu'on voit passer des résultats ;
- **essayer une production** sur une fiche de démonstration, sans consommer de crédit ni toucher à un compte réel.

**Chaque gabarit est versionné**, et chaque portrait retient la version qui l'a produit (`ActionRun.prompt_template_id`). Sans cela, comprendre pourquoi les productions d'une semaine valaient mieux que celles de la suivante devient impossible.

**Ce qu'on mesure par orientation et par style** : le volume produit, le **taux de régénération** — un contenu qu'on relance aussitôt est un contenu manqué —, le coût moyen, le taux d'échec.

## 6. Ce que cela change dans les specs

À répercuter :

- **`GeneratedProfile`** — ajouter l'orientation, la voie d'image (illustration, photo, aucune), la famille d'illustration, le style de photo, la note de l'expéditeur, le texte libre.
- **§3.7 de la spec mobile** — la génération d'un portrait passe par le studio, avec ses choix.
- **§3.22** — l'aperçu doit refléter les trois gabarits.
- **Le tracking plan** — mesurer quelle orientation est choisie, quelle voie d'image, quel style, et le taux de régénération. C'est ce qui dira si les douze orientations servent ou si trois suffisent.
- **Le back-office** — la section Studio (5.8) et l'entité `PromptTemplate` : câblés.

---

## 7. Ce qui reste à décider

- **Le prix.** Un portrait avec photo coûte plus cher à produire qu'un portrait sans image. Faut-il qu'il coûte plus de crédits ?
- **La couleur du motif** suit-elle l'orientation, ou reste-t-elle constante, l'illustration portant seule la couleur du propos ?
- **La hauteur de la bande** est-elle fixe, ou s'adapte-t-elle à la longueur du message ?
- **Les noms des trois styles** de photo.
- **Le fournisseur** du traitement d'image, et sa politique de conservation — une photo de tiers ne peut pas servir à entraîner un modèle.
