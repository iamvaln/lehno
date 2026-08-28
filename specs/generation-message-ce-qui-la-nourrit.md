# Lehno — la génération du message : ce qu'il faut rassembler

Avant d'écrire un gabarit, il faut savoir **ce que le modèle reçoit**. Ce
document établit la matière, ce qui l'encadre, ce qui en sort — et **ce qui
manque encore**.

Le message est la seule génération allumée au lancement. C'est aussi la moins
risquée à éprouver : quelques secondes, un texte court, relu par son auteur
avant d'être envoyé.

---

## 1. Ce qui existe déjà en base, et qu'il suffit de lire

Tout ce que la §4.1 demande est là. Rien à créer côté données du proche.

| Ce que la spec demande | Où ça vit | État |
|---|---|---|
| Le nom d'usage | `Person.callingName`, à défaut `displayName` | ✅ |
| Le genre du proche | `Person.gender` | ✅ |
| **Le genre de l'utilisateur** | `User.gender` | ✅ |
| La relation | `Person.relation` — sept valeurs — et `relationHint` en clair | ✅ |
| Le registre | `Person.register` — familier · amical · formel | ✅ |
| La langue | `Person.language`, à défaut celle du compte | ✅ |
| La nature de l'occasion | `EventOccurrence` → `Event.eventNature` — `happy` ou `sensitive` | ✅ |
| Les notes, avec date et catégorie | `Note` + `NoteCategory` → `Category.code` | ✅ |
| L'âge | déduit de `Person.birthDate` si `birthYearKnown` | ✅ |
| La ville | `Person.city` | ✅ |
| Le canal | `Person.preferredChannel` — il règle la longueur | ✅ |
| Ce qui a déjà été offert | `GiftGiven` | ❌ **la table n'existe pas** |

**Deux nuances qui comptent** :

- **`relation` et `relationHint` coexistent** — l'énumération pour raisonner, le
  texte libre pour écrire. « Ma marraine » n'est pas « famille étendue » dans un
  message.
- **Une note non rangée sert quand même** (§3.4). La catégorie oriente ; son
  absence n'exclut pas.

---

## 2. Les sept catégories, et celle qui ne se discute pas

| Code | Durée | Ce qu'elle apporte au message |
|---|---|---|
| `interests` | durable | La matière première — ce qui le caractérise |
| `facts` | ponctuelle | Les faits sur lesquels s'appuyer |
| `challenges` | ponctuelle | Ce qu'il traverse — sert « un soutien » |
| `encouragements` | ponctuelle | Sert « tes progrès », « ma fierté » |
| `message_ideas` | ponctuelle | Ce que l'utilisateur voulait dire lui-même |
| `gift_ideas` | ponctuelle | **Hors sujet pour le message** |
| `dislikes_nogo` | durable | **Une contrainte, pas une indication** |

**`dislikes_nogo` porte `is_constraint = true`, seule de toutes.** Elle ne dit
pas ce qu'on peut mentionner : elle dit **ce qu'on ne doit pas**. Un modèle qui
la reçoit comme une note parmi d'autres finira par l'employer — « tu qui
détestes l'alcool » est une phrase que rien n'interdit à un modèle bien
intentionné.

Elle doit donc partir dans le gabarit **à part**, comme une interdiction, jamais
mêlée aux autres notes.

---

## 3. Ce que l'utilisateur choisit au studio

**L'orientation** — douze valeurs, et c'est le premier choix : il commande le
texte. `Notre relation · tes progrès · nos progrès · une motivation · un soutien
· ce qui te caractérise · ma fierté · mon affection · ma gratitude · ce que tu
m'as appris · un vœu · un hommage.`

**L'hommage est à part** : registre sobre, aucune réjouissance.

**La matière** — la plage de notes retenue : tout l'historique (par défaut), les
douze derniers mois, depuis le dernier portrait, ou des dates fixées.

> **Ce que la plage protège, et qu'on sous-estime.** Les notes sont les mots
> privés de l'utilisateur sur un tiers qui n'a rien demandé. Les envoyer toutes
> à un fournisseur étranger est le flux le plus sensible de l'application. La
> plage n'est pas qu'un réglage de pertinence : c'est ce qui limite l'exposition
> à ce qui sert vraiment.

**Le registre et la langue**, hérités de la fiche, modifiables au moment de
générer sans être écrits sur la fiche.

---

## 4. Ce que le modèle ne doit JAMAIS recevoir

Rien de tout cela n'aide à écrire, et chacun est un risque.

- **L'identité de l'utilisateur** — adresse, nom de compte, identifiant. Le
  prénom de qui signe suffit, et encore : il ne sert qu'à l'accord.
- **Les identifiants techniques** — aucun UUID. Ils ne veulent rien dire pour un
  modèle et voyagent dans les journaux du fournisseur.
- **Les notes d'un AUTRE proche.** Évident, et c'est exactement le genre
  d'évidence qu'une jointure mal filtrée casse en silence.
- **L'historique des générations précédentes.** Une régénération demande autre
  chose, pas une variante de la précédente.
- **Le solde de crédits, le contexte de paiement, les drapeaux.**

---

## 5. Ce qu'on attend en retour

**Deux textes, en un seul appel** :

- le message — deux à quatre phrases, à la première personne, adressé au proche ;
- une version courte — dix à quinze mots, pour le format vertical.

> **Un seul appel, et c'est une décision.** Deux appels donneraient deux textes
> qui peuvent se contredire — une version courte qui promet ce que la longue ne
> dit pas. Et ils coûteraient deux fois pour un crédit débité une fois.

**Une sortie structurée**, pas de la prose libre : deux champs nommés. Ce qui
permet de vérifier qu'ils sont là — pas d'en juger le style, qui est l'affaire
du gabarit.

---

## 6. Les règles que le gabarit doit porter

De la §4.1, et chacune existe parce qu'elle a un coût :

| La règle | Ce qu'elle évite |
|---|---|
| S'appuyer sur les notes, **rien d'inventé** | Un souvenir fabriqué détruit la confiance en une phrase |
| Suivre le registre de la fiche | Le tutoiement à un collègue |
| S'accorder correctement, **pour les deux** | « Je suis fier » quand on est une femme |
| Genre inconnu → tournures qui s'en passent | **Jamais** un accord au hasard ni « fier(e) » |
| Ne jamais mentionner Lehno ni les notes | « D'après ce que tu m'as dit… » trahit le carnet |
| Ne pas dater, ne pas dire « joyeux anniversaire » | Le portrait s'offre n'importe quand |
| Pas de superlatifs empilés, d'emojis, de multiples « ! » | Le ton de la carte de vœux |
| L'âge seulement si demandé | On ne rappelle pas son âge à quelqu'un sans raison |

**Pour une occasion sensible** — registre sobre, aucune réjouissance, aucun
conseil, aucune consolation. *On constate et on accompagne, on ne réconforte
pas.*

---

## 7. Le cas qui coûte le plus cher

**Un message joyeux sur une occasion sensible.**

`EventNature` vaut `happy` ou `sensitive`, et cette valeur commande tout. Elle
mérite d'être traitée comme la contrainte qu'elle est :

- **dans le gabarit**, en tête et non au milieu ;
- et à l'entrée : `sensitive` **et** l'orientation « un hommage » vont ensemble.
  Les orientations joyeuses — ma fierté, une motivation, un vœu — n'ont rien à
  faire sur une occasion sensible, et **c'est au serveur de le refuser**, pas au
  modèle de le deviner.

C'est la même discipline que partout : rendre le mauvais état impossible à
écrire plutôt que de compter sur la bonne volonté d'un tiers.

---

## 8. Ce qui manque, et qu'il faut décider

**Le gabarit lui-même n'existe pas.** `PromptTemplate` est vide, et le Studio
d'administration qui les compose n'est pas construit. Pour le lancement, un
gabarit de départ **dans le code**, comme le registre des modèles — puis la base
prend le relais quand le Studio existe. Sans ça, rien ne se génère.

**Les douze orientations n'existent nulle part.** Ni énumération, ni table. Elles
doivent vivre en base (§8 de la spec portrait : *« rien de tout cela ne vit dans
le code »*), mais `StudioConfig` n'existe pas non plus. Même réponse : un
registre de départ dans le code.

**Le genre se collecte aux deux formulaires d'identité**, et non au studio — le
lot de design le tranche : *« Deux champs : celui du proche (§3.18), celui de qui
écrit (§3.23) »*, sous le libellé **« Accord du message »**.

Ce document disait d'abord « demandé au studio », d'après `profil-proche`. Le lot
est postérieur et il l'emporte : la question ne se pose pas à la première
génération, elle se pose là où l'on décrit quelqu'un.

**L'asymétrie qui en découle** : `gender` **s'écrit sans se lire**. Il entre par
le formulaire et ne ressort que vers le modèle ; `personSchema` ne le rend pas,
ce qui empêche un écran d'afficher le genre d'un tiers ou de trier dessus. Celui
de l'utilisateur, lui, est rendu — c'est son propre compte, et lui cacher ce
qu'il a répondu n'aurait aucun sens.

**`GiftGiven` n'existe pas.** Sans impact sur le message ; bloquant pour les
idées de cadeaux.

**Une question ouverte, et elle vous revient** : que fait-on d'un message qui
sort en six phrases au lieu de quatre ? Rejeter coûte une seconde génération,
donc de l'argent réel, pour un texte que l'utilisateur va de toute façon relire
et ajuster. Ma recommandation : **on vérifie que les deux champs sont là, et
c'est tout.** La longueur est l'affaire du gabarit, pas d'une garde qui refait
payer.
