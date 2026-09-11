# Les écrans de l'atelier des textes

*11 septembre 2026. Complète `ux-admin-lehno.md` §8 (le studio) et le brief
fonctionnel §3 (ce que le modèle lit).*

L'API existe depuis ce matin — `admin/text-studio`, trois natures sur un seul
jeu de routes. Aucun écran ne l'atteint. Ce document dit lesquels faire, et
surtout **ce qu'ils ne feront pas**.

---

## 1. Ce qui existe, et ce qui manque

| | |
|---|---|
| **Réglé depuis l'outil** | le portrait — son atelier, ses essais, ses réglages en service |
| **Réglable par l'API, sans écran** | le **message**, les **idées de cadeau**, le **brief du portrait** |

Les trois générations de texte tournaient sur ce que le semis avait posé. Les
changer demandait une livraison — ce que le studio existe précisément pour
éviter.

`admin/portrait-studio` porte d'ailleurs un nom qui trompe : toutes ses routes
passent « portrait » en dur. Il règle **l'image**, pas les textes.

---

## 2. Un écran, trois natures — jamais trois écrans

L'API a tranché, et l'écran suit le même raisonnement : le geste est
**rigoureusement le même** — lire ce qui tourne et ce qu'on compose,
enregistrer, essayer sur un profil, publier, revenir en arrière. Seule la
**forme des réglages** diffère.

Trois écrans jumeaux divergeraient au premier durcissement : l'un garderait
l'ancienne règle, et personne ne le verrait avant qu'un administrateur ne
publie par le mauvais chemin. C'est exactement l'argument que le contrôleur
écrit pour lui-même.

**La nature se choisit par un onglet**, en tête d'écran : *Message · Idées de
cadeau · Brief du portrait*. Une entrée de menu par nature ferait trois
adresses pour un seul outil.

### L'entrée au menu

Sous **Studio du portrait**, à côté de *L'Atelier*, *Les essais*, *Réglages en
service* et *Profils de simulation*.

> *Corrigé le 11 septembre : ce paragraphe citait aussi « Gabarits de
> production ». L'entrée est partie — elle lisait `prompt_template`, que rien
> n'a jamais branché à la génération.*

> **À trancher par le design.** « Studio du portrait » devient un nom faux le
> jour où il abrite l'atelier des textes. Deux issues : renommer la famille
> (« Studio »), ou sortir les textes dans leur propre famille. Le présent
> document propose la première — le studio est **un** lieu, avec deux matières
> — mais l'écran se fait sans attendre ce choix : seule l'étiquette bouge.

---

## 3. Ce que chaque nature règle

Les trois partagent un **fond commun** — la consigne, les garde-fous, les
champs du proche, le modèle appelé — et ajoutent ce qui leur est propre.

### Commun aux trois

| Champ | Forme à l'écran | Ce que l'administrateur doit comprendre |
|---|---|---|
| `consigneCommune` | zone de texte, 4 000 caractères | ce qui **s'ajoute** à la consigne système, pas ce qui la remplace |
| `gardeFous` | liste d'étiquettes, 40 au plus, 200 caractères chacune | ce qui est **écarté** : symboles, formules, tournures |
| `champsDuProche` | cases : relation · âge · notes · texte libre | ce que le modèle **reçoit** de la fiche — donc ce qui sort de chez nous |
| `modele` | liste des modèles de **texte** publiés | « fournisseur:clé ». Le registre en fait foi ; l'écran n'invente aucune clé |

`champsDuProche` mérite sa mention à l'écran : décocher « notes », c'est
décider que les confidences ne traversent pas. Ce n'est pas un réglage de
qualité, c'est un réglage de **fuite**.

### Le message

| Champ | Forme | Règle |
|---|---|---|
| `orientations` | liste **réordonnable**, chacune activable | **l'ordre est celui de l'écran mobile, et le premier actif est le défaut** |

Il n'y a pas de champ « orientation par défaut », et il ne doit pas y en avoir :
deux champs — un ordre et un défaut désigné — laisseraient un défaut pointer sur
une orientation qu'on vient d'éteindre, et l'écran du client s'ouvrirait sans
sélection. L'administration règle le défaut **en réordonnant**.

**Au moins une orientation active.** Le contrat le refuse à l'enregistrement, et
l'écran doit le dire avant d'envoyer : un studio sans orientation est un écran
client vide.

#### Les quatre textes d'une orientation — relevé et livré le 12 septembre

Une orientation n'est pas qu'un identifiant et une case. `orientationReglageSchema`
lui donne quatre champs de texte bilingues : `libelle`, `description`,
`avertissement`, et surtout **`consigne`** — l'instruction propre à cette
orientation, celle que `essai.service.ts` pose en `consigneOrientation` et qui
part au modèle.

**Aucun n'était éditable.** L'écran affichait le libellé et une case ; le texte
qui oriente réellement la génération restait celui du semis, et le changer
demandait une livraison — très exactement ce que le studio existe pour éviter.
La ligne du tableau ci-dessus, « liste réordonnable, chacune activable », le
cachait en le décrivant fidèlement.

**Les quatre s'écrivent depuis un dépliage par orientation**, une seule ouverte
à la fois : douze orientations par quatre textes par deux langues font
quatre-vingt-seize champs, et tout ouvrir ferait perdre de vue la liste
elle-même — qui est l'ordre, donc le défaut.

**Les deux familles de l'Atelier s'appliquent ici aussi, et l'empreinte les
départage déjà.** `partieLueParLeModeleMessage` retient des orientations
`{ id, consigne }`, et rien d'autre :

| Champ | Dans l'empreinte | Ce que l'écran doit en dire |
|---|---|---|
| `consigne` | **oui** | la modifier **redemande un essai** avant publication — l'écran sait déjà le dire |
| `libelle`, `description`, `avertissement` | non | ne changent que ce que le client lit ; ils se corrigent sans réessayer |

La `consigne` porte donc le liséré `admin-lu-par-le-modele`, la convention de
l'Atelier du portrait ; les trois autres ne l'ont pas. Et le tri par identifiant
dans l'empreinte dit l'autre moitié : **réordonner ne redemande pas d'essai**,
puisque la position est l'ordre de l'écran, pas la matière.

##### Un bilingue est entier ou nul — jamais à moitié

`bilingueFacultatifSchema` est `bilingueSchema.nullable()`, et chaque côté exige
au moins un caractère. Il n'existe donc pas d'orientation dont la description
serait écrite en français seulement : le contrat la refuse, **et les deux
facultatifs se retirent en entier ou pas du tout**.

Deux conséquences que l'écran tient :

- **il ferme l'enregistrement et NOMME l'orientation fautive** dès qu'un texte
  n'est rempli que d'un côté. Sans le nom, il faudrait déplier les douze pour
  trouver laquelle — et sans le contrôle, le refus tomberait après
  l'aller-retour, sans dire d'où il vient ;
- **un facultatif vidé des deux côtés part `null`**, jamais `{ fr: "", en: "" }`.
  La coquille ferait refuser l'enregistrement pour un champ que l'administrateur
  croyait avoir effacé.

C'est la troisième fois que cette forme coûte du temps — elle avait déjà fait
rougir les épreuves de l'écran le 11. Elle est écrite ici pour que la quatrième
n'ait pas lieu.

### Les idées de cadeau

| Champ | Forme | Règle |
|---|---|---|
| `nombreDemande` | nombre, de 3 à 6 | en dessous de trois, rien à comparer et un refus vide la liste ; au-delà de six, les dernières deviennent des variantes de la première |

### Le brief du portrait

| Champ | Forme | Règle |
|---|---|---|
| `motsDuPortrait` | bornes min/max, 1 à 12 | les mots du nuage : trop peu ne dit rien, trop noie le dessin |
| `motsDeLaPhrase` | bornes min/max, 2 à 24 | **contrainte de composition, pas de goût** : au-delà de 24, la troisième ligne déborde de la bande, et la dédicace sort tronquée |

Le plafond de la phrase doit porter cette explication **à l'écran**. Sans elle,
quelqu'un le desserrera un jour pour « laisser de la place », et des portraits
sortiront avec une dédicace coupée — le mot qu'on offre à quelqu'un.

---

## 4. Les quatre gestes

| Geste | Route | Ce que l'écran doit garantir |
|---|---|---|
| **Enregistrer** | `PATCH :nature/config` | écrit un **brouillon**, ne met rien en service. Aucun motif demandé |
| **Essayer** | `POST :nature/trials` | sur un **profil de simulation**. Le brouillon naît avant l'appel |
| **Publier** | `POST config/publish` | met en service, avec une **note** disant ce qui change |
| **Revenir en arrière** | `POST config/rollback` | republie une version antérieure, sans la reconstruire |

**Publier et revenir en arrière ne portent pas la nature** — ils visent une
configuration par son identifiant, et c'est elle qui dit sa nature. L'écran ne
la renvoie donc pas : la faire répéter ouvrirait la possibilité qu'elle
contredise la ligne, et il faudrait décider laquelle ment.

### Rien ne se publie sans essai

Comme pour le portrait. L'écran **n'affiche pas** le bouton « Publier » tant
qu'aucun essai ne porte sur le brouillon courant, et dit pourquoi — plutôt que
d'offrir un geste que le serveur refusera.

### L'essai coûte de l'argent réel

Sans consommer de crédit ni toucher un compte. L'écran affiche son coût et le
cumul du jour, comme l'atelier du portrait.

---

## 5. Ce que l'écran ne fait pas

- **Il ne crée pas de profil de simulation.** Il les choisit. Leur entretien
  vit dans *Profils de simulation*.
- **Il n'invente aucune clé de modèle.** La liste vient du registre ; un modèle
  écarté du routage y figure quand même — c'est là qu'on va voir s'il est
  revenu.
- **Il ne montre pas la consigne système.** Elle n'est pas réglable : les
  règles absolues ne se négocient pas depuis un panneau.
- **Il n'est pas ouvert au support**, y compris en lecture. Lire montre la
  consigne en préparation, et chaque essai engage une dépense. `@Role("admin")`
  est posé sur la classe côté serveur ; la section suit.

---

## 6. Ce qui reste à trancher

1. **Le nom de la famille au menu** (§2). Le design tranche.
2. **L'ordre des onglets.** Proposé : message, idées, brief du portrait — celui
   de la fréquence d'usage, pas celui du contrat.
3. **Les garde-fous se saisissent-ils un par un, ou en liste collée ?** Quarante
   entrées à la main est long ; un collage multiligne est plus rapide et plus
   facile à rater. Proposé : saisie une par une, avec retrait au clic.

---

## 7. L'historique et le retour arrière

*Ajouté le 11 septembre, après coup : le présent document les renvoyait à un
second temps, et ils sont faits.*

L'**historique** (`GET :nature/config/history`) et le **retour arrière**
(`POST config/rollback`) tiennent dans **l'atelier lui-même**, sous la
composition — et non dans un écran jumeau de *Réglages en service* comme pour
le portrait.

C'est le raisonnement du §2, poussé d'un cran : deux écrans à onglets auraient
**deux sélections de nature** à tenir d'accord, et l'une mentirait sur l'autre
dès qu'on changerait d'onglet d'un seul côté. L'atelier porte déjà la nature ;
l'historique s'y range.

L'appel vit dans **la même clé** que la configuration. Hors de cette clé, on
lirait les publications du message sous l'onglet des idées, et rien à l'écran
ne le dirait.

### Ce que le retour arrière n'offre pas

| Ligne | Pourquoi le geste est fermé |
|---|---|
| Déjà **en service** | elle n'a rien à défaire |
| **Brouillon** jamais publié (`version` nulle) | personne ne l'a validée ; y « revenir » la mettrait en service par la porte que la règle de publication ferme |
| Vue par le **support** | le studio lui est fermé, §5 |

Le serveur refuse ces trois cas. L'écran les ferme d'avance plutôt que d'offrir
un geste qui échouerait.

### Un défaut trouvé en ouvrant la porte

`retourArriere` déclassait **toute** configuration en service avant de remettre
la sienne — sans filtre sur la nature. Revenir sur une version du message
rangeait donc aussi le portrait, les idées et le brief : trois natures sans
configuration en service, **sans erreur et sans trace**, puisque le geste
demandé réussissait.

La publication portait déjà ce filtre, et son commentaire raconte l'incident
qui le lui avait appris. Les deux gestes écrivent au même endroit ; un seul
avait retenu la leçon.

**Et le retour arrière n'était pas un geste non éprouvé** : quatre cas e2e lui
sont consacrés. Ils restent tous sur la nature `portrait` — et avec une seule
nature en vue, un filtre par nature ne se voit pas. Il y a là une leçon plus
large que ce défaut : depuis que le studio porte quatre natures, **un cas qui
n'en regarde qu'une n'éprouve plus la séparation**. L'index unique ne rattrape
rien non plus : il n'admet qu'une publiée par nature, et zéro en satisfait la
lettre.

---

## 8. Ce que ce document ne couvre toujours pas

> **Ce paragraphe disait le contraire, et il avait tort.** J'y affirmais que les
> essais des textes ne se listent ni ne se jugent. Vérification faite : ils se
> listent et se jugent depuis le premier jour.

**Les essais des textes se relisent — dans l'écran du portrait.** `GET
/admin/portrait-studio/trials` n'a **aucun filtre par nature** : il rend les
cent derniers essais, les quatre natures mêlées. `PATCH trials/:id` juge de
même. Et l'écran *Les essais* a été bâti en le sachant — son commentaire nomme
« ceux du message », et sa vignette a une branche pour une sortie textuelle.

Ce qui manquait vraiment était plus étroit : **l'essai ne portait pas sa
nature**. Deux essais du même modèle, l'un pour le portrait et l'autre pour les
idées, se ressemblaient — et la forme de la sortie ne les sépare pas, les trois
natures de texte rendant toutes un message. Le seul filtre offert, l'ambiance,
rangeait les trois dans « Sans ambiance », avec les vieux essais du portrait.

`nature` entre donc au contrat de l'essai, et la galerie s'y filtre. **Aucun
écran *Les essais* propre aux textes n'est à faire** : ce serait un jumeau de
plus à tenir d'accord, pour une galerie qui rend déjà tout.

**Ce que le mélange laisse ouvert.** Le nom de l'écran — *Les essais*, sous
« Studio du portrait » — continue d'annoncer moins qu'il ne montre. C'est la
même question que le §2, et elle se tranche au même endroit : le design.
