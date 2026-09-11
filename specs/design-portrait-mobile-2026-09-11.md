# Le portrait sur mobile — conception

11 septembre 2026. Fait référence pour l'implémentation mobile de §3.22.
Complète `spec-portrait-lehno.md`, qui reste la référence produit, et
`brief-backend-mobile-2026-09-09.md`, où partent les demandes au serveur.

## Pourquoi ce document

Le portrait est **produit de bout en bout côté serveur** depuis le 10 septembre,
et **atteignable de nulle part** côté mobile : la fiche d'un proche porte sa
sortie « Ses portraits » avec `route: null`, et aucun écran n'appelle jamais
`POST /me/generations` avec `kind: "portrait"`. L'écran §3.22 existe pourtant,
complet — il lit, sonde, approuve, enregistre, partage.

Ce qui manque n'est donc pas un écran : c'est **le chemin pour y entrer**, et la
décision de ce qu'on y vit.

## Le principe

Le portrait est le seul des trois natures qui finit en **objet qu'on donne**. Un
message est un brouillon qu'on envoie, des idées sont une liste où l'on pioche.
Ça doit se sentir : on fait fabriquer quelque chose pour quelqu'un, on ne lance
pas un traitement.

---

## 1. Le parcours

### 1.1 L'entrée est la fiche du proche

La planche est explicite : « le portrait appartient au proche et se compose
depuis sa fiche, à tout moment ; la préparation d'une occasion ne propose que ce
qui se périme avec la date ». La préparation reste donc à deux pistes.

Le rang de la fiche **dit ce qu'il fait selon ce qui existe** :

- aucun portrait → « Composer son portrait »
- au moins un → « Ses portraits »

Un rang qui annonce « Ses portraits » à quelqu'un qui n'en a aucun ment, et
c'est ce qu'il ferait aujourd'hui si on lui donnait simplement sa route.

### 1.2 Les quatre moments

| Moment | Ce qu'on doit y vivre |
|---|---|
| **Composer** | On choisit ce qu'on regarde, pas des mots. Coût annoncé. |
| **Attendre** | On nomme ce qui se passe, avec la matière du proche. On peut fermer. |
| **Relire** | Le texte se vérifie. Le geste suivant compose l'image, et le dit. |
| **Donner** | L'image finie s'enregistre et se partage. « Refaire » porte ses réglages. |

On arrive **sur la chose**, jamais sur une liste. Payer et atterrir dans une
boîte de réception est la pire transition du produit ; les reprises redeviennent
ce que la planche en dit — où l'on retrouve ce qu'on a *laissé en plan*.

---

## 2. Composer

### 2.1 L'image se choisit à l'œil

**Décision arrêtée le 11 septembre.** Un choix de rendu ne se fait pas avec des
mots : personne ne sait départager « chaleureux » et « sobre » dans l'abstrait.
Le catalogue sert donc, par choix de rendu, **une vignette de référence** —
figée, la même pour tout le monde, publiée avec la configuration.

Elle ne se génère pas à la volée : ce serait un appel de modèle par pastille
regardée, avant même d'avoir payé. Elle vient du back-office, qui produit déjà
ces images — un essai (`EssaiStudio`) porte son `ambianceId` et reçoit un
**verdict** d'un administrateur. Un essai retenu devient la référence de son
ambiance. Ce n'est pas une chaîne de production nouvelle : c'est un chemin de
publication.

Conséquences :

- **L'image et les familles se montrent en grille de vignettes**, légende
  dessous — libellé puis description. Ce qu'on regarde est ce qu'on aura.
- **La voie photo montre les mêmes vignettes** — corrigé le 11 septembre. Elle
  ouvre la famille de l'illustration, il n'y a pas de « styles de photo » à
  part.
- **L'orientation reste en mots.** « Notre relation », « Ma gratitude » : c'est
  le *propos*, pas le rendu. Rien à montrer.
- **Sans vignette publiée** (`previewUrl` nul), la grille retombe sur la
  description seule. L'écran ne suppose jamais l'image présente.

### 2.2 Le dépliement vient du catalogue

`revealsGroup` existe au contrat, et porte déjà la règle : « une illustration
porte sa famille ». On ne réécrit pas cette logique dans le client — choisir une
voie déplie son groupe, et c'est le serveur qui dit lequel.

```
L'IMAGE
  [vignette]      [vignette]      [vignette]
  Illustration    Photo traitée   Aucune image
  composée de     jamais brute —  le motif de marque
  ce qu'on sait   un style est    tient le fond
                  appliqué
```

**Si illustration** → se déplie : les trois familles en vignettes (Nature,
Animal, Abstrait), puis **le champ libre**. Il appartient à cette branche, pas
au portrait en général — §2.3 le dit : « ce qu'il faut savoir de lui pour le
dessiner ». 280 caractères, avec sa mention d'éphémère, que le contrat exige :
« conservé le temps de la génération seulement, et l'écran le dit là où on le
remplit ».

**Si photo** → se déplie au même endroit (voir §2.3 ci-dessous).

**Si aucune image** → rien ne se déplie.

**L'avertissement d'un choix s'affiche au moment du choix**, jamais après : le
contrat le motive — « l'hommage change le gabarit, et l'apprendre trop tard fait
perdre un crédit ».

### 2.3 La photo : la place se tient dès maintenant

*Révisé le 11 septembre 2026, en fin de journée : le câblage n'est plus reporté.
Le dépôt, le jugement et l'appel au modèle sont écrits — voir
`brief-admin-studio-2026-09-11.md`. Ce qui suit reste vrai pour le dessin, aux
deux corrections marquées près.*

Insérer plus tard une troisième voie qui demande un dépôt, un recadrage et un
refus dans une feuille dessinée pour deux coûterait bien plus que la prévoir.

Trois emplacements à réserver, tous avant le paiement :

1. **Le dépôt** — « Choisir une photo ».
2. **Le recadrage** — l'utilisateur cadre (§4.3 : « la photo recadrée par
   l'utilisateur, le style retenu »).
3. **Le refus nommé** — trop sombre, trop floue, trop petite, avec sa raison
   (§4.3 : « refusée avec une raison claire, plutôt que traitée mal »).

**LA SOURCE RESTE — corrigé le 11 septembre.** Ce paragraphe disait que la photo
était effacée après traitement, et la spec du portrait le disait aussi. C'était
contre l'usage : **on refait un portrait pour en voir un autre**, et redemander
un téléversement à chaque essai transformerait la recherche du bon rendu en
corvée. Elle ne s'en va qu'au dépôt d'une autre, ou quand on la refuse.

**Et aucun avertissement à l'écran** — corrigé le 11 septembre. La clé
`studioPhotoAvis` portait « L'image est transmise à un service qui la transforme.
Elle n'est pas conservée. » Elle a été retirée : la seconde phrase serait devenue
fausse, et la première est déjà dans les CGU §7 et la Confidentialité §5, qu'on
accepte à l'inscription. Un garde-fou par écran pour une règle posée une fois
fatigue sans protéger.

**LES AMBIANCES SONT LES MÊMES — corrigé le 11 septembre.** La voie photo ouvre
la même famille que l'illustration : nature, animal, abstrait. Il y avait un
groupe `photo_style` à part, et il n'a jamais eu d'ambiance — c'est ce qui
rendait la voie invisible. Ce que la photo change n'est pas le sujet mais d'où
l'on part.

Il n'y a donc **pas de sous-choix à dessiner pour la photo** : la grille des
familles est celle de l'illustration, et la voie photo la déplie pareil.

**Le libellé importe.** « Photo » laisse croire « votre photo » alors que la
voie décide du *modèle* appelé (`modeles.photo_style` contre
`modeles.illustration`). Il doit nommer le rendu.

### 2.4 Les détails, repliés

§2.5 en compte quatre, et le contrat les porte tous :

| Réglage | Défaut | Champ |
|---|---|---|
| Le nom du proche | son nom d'usage | — |
| La plage de notes | tout l'historique | `sourceFrom` / `sourceTo` |
| La note de l'expéditeur | **proposée**, « Fait avec soin par Valentine » | `senderNote` (120) |
| La langue | celle de la fiche | `language` |

Repliés sous « Les détails ». Le premier portrait ne doit obliger à rien : on
déplie si l'on veut.

La note de l'expéditeur est **proposée puis modifiable** — elle se retire et se
remet. `portrait.tsx` porte déjà cette mécanique (`signatureARemettre`,
`noteRetiree`, avec le piège documenté : sans mémoire de ce qu'on a retiré, la
remettre retomberait sur le nom du compte).

### 2.5 Le pied

Le coût, le solde, « Lancer le portrait ». La feuille payante existante,
qui annonce déjà les deux et bascule sur « Recharger » quand le solde ne suffit pas.

---

## 3. Attendre

`POST /me/generations` **produit en ligne** : il débite, appelle le modèle, rend
le résultat fini. ~40 s mesurées pour le message ; l'image sera plus longue.

Le crédit part **avant** l'appel. À la troisième seconde, on a déjà payé et rien
à l'écran ne le dit. C'est le seul endroit de l'application où le silence coûte
de l'argent.

**L'attente se nomme**, avec la matière qu'on a déjà : « On relit vos 9 notes sur
Awa. » Le temps mort devient la preuve que la chose est personnelle, ce qui est
la promesse du produit.

**Elle se quitte** : « Vous pouvez fermer, on vous le garde. » C'est vrai — le
résultat vit dans les reprises quoi qu'il arrive, et c'est à ça qu'elles servent.

**Un composant partagé.** Les trois natures ont la même attente et aucune ne
l'a. Le message grise deux boutons quarante secondes ; les idées font pareil.

**Ce qui est déjà écrit et ne sert pas** : `generation.tsx` porte une phase
`attente`, un `LoadingState variant="generation"`, et un sondage à repli
2 s → 8 s. Tout cela a été écrit pour un serveur qui rendrait l'exécution
`running` tout de suite. Voir §6.

---

## 4. Relire

Avant l'approbation, `imageUrl` est nul : il n'y a rien à montrer. L'écran
affiche le **texte** qui entrera dans la bande, et c'est voulu.

**Le bouton dit la suite, pas la signature.** « Approuver » se lit comme un
engagement administratif ; ce qu'on fait est vérifier le texte **et lancer la
composition de l'image**. Il dit donc **« Composer l'image »**.

Le verbe est celui du produit — on compose un portrait, on compose une image —
et il vaut pour les trois voies : l'illustration se dessine, la photo se
traite, et sans image le motif de marque se compose quand même. « Dessiner »
aurait menti sur deux voies de trois.

Le bouton du lancement dit donc **« Lancer le portrait »**, pour que les deux
gestes ne portent pas le même verbe à deux écrans d'écart.

L'approbation appelle un modèle d'image en ligne : **la seconde attente se
dessine comme la première**, avec ses mots à elle.

Elle est idempotente, et l'écran peut s'y fier : deux frappes ne font pas deux
images.

---

## 5. Donner, et refaire

L'image finie s'enregistre et se partage par la feuille du système, avec son
pied de marque. Ni lien, ni mise au Mur : « le portrait ne s'expose à aucune
adresse publique ».

**Les réglages n'existent plus comme réglages.** Posés en pastilles libres à
côté de l'image, ils promettent de la rehabiller sous les yeux — ce que rien ne
permet. Ils ne réapparaissent qu'**à l'intérieur de « Refaire »**, dans la même
feuille pliée qu'à la composition, avec son crédit annoncé.

C'est le même écran de composition, rouvert. Pas un second dessin à tenir.

---

## 6. Ce qui est demandé au serveur

À porter au brief backend. Aucun de ces points ne bloque le reste : l'écran
retombe proprement sur l'existant. **Les trois sont vérifiés ouverts au
11 septembre au soir**, après la livraison du studio des textes (#176) — qui
règle le §9 du brief mais ne touche à aucun des trois.

**§A — `previewUrl` sur `studioChoiceSchema`**, nullable. *Absent du contrat au
11 septembre.* C'est le plus intéressant des trois, et le moins coûteux : rien
à produire, seulement à publier. Nul veut dire « pas
encore de référence retenue », et la grille retombe sur la description. Le geste
qui le remplit existe presque : `PATCH /admin/portrait-studio/trials/:id` pose
déjà un verdict ; il lui manque « c'est celle-ci qui représente l'ambiance ». La
vignette suit la **version publiée**, comme le reste du catalogue — changer
l'ambiance en administration change la vignette sans livraison.

**§B — rendre l'exécution `running` immédiatement.** La requête de quarante
secondes est fragile sur un réseau mobile, et l'attente ne devient un endroit
qu'on quitte et retrouve vraiment que si le client peut sonder. Le sondage est
**déjà écrit**. Le jour où le serveur le fait, l'attente conçue au §3 le devient
sans rien réécrire.

**§C — la voie photo** : ~~reporté~~ **livré** côté serveur le 11 septembre.
`POST me/portraits/photo/depot` rend une URL signée — le client téléverse
directement, l'image ne passe pas par l'API — puis `POST me/portraits/photo`
juge et refuse en nommant : `trop_petite`, `trop_sombre`, `trop_floue`. Les
seuils se règlent au studio. Le **recadrage reste au client** : le serveur reçoit
une image déjà cadrée.

---

## 7. Hors sujet

- **Le Mur** : le portrait ne s'y pose pas, le contrat l'écrit.
- **Recomposer l'image sans repayer** : rien ne le permet, et « Refaire » est la
  réponse honnête.
- **Plusieurs portraits par proche affichés ensemble** : `GET /me/portraits`
  rend une liste, mais la planche n'en dessine qu'un. Le rang de la fiche mène
  au dernier ; la collection attendra qu'on en veuille une.
