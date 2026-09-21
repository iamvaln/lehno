# Retours de test sur l'appareil — mobile, 21 septembre 2026

**Document en cours.** Valentine parcourt l'application sur son appareil et
remonte les écarts au fil de l'eau ; chaque retour s'ajoute ici avec ce qui a
été vu, ce que la planche demande, et la cause retrouvée dans le code. Les
décisions restent à prendre — rien n'est corrigé tant qu'une entrée n'est pas
marquée comme telle.

Les copies d'écran viennent d'un Android en thème sombre ; les planches citées
sont en thème clair. **La différence de thème n'est pas un écart** — seuls les
écarts de structure et de comportement sont relevés.

---

# Synthèse — 21 retours, au 21 septembre

**Vingt et un retours relevés, tous avec leur cause retrouvée dans le code.** Rien
n'est corrigé à ce jour : ce document est l'état des lieux qui précède le
travail.

Ce qui suit ne classe pas par ordre d'arrivée mais par **ce qu'il faut faire
ensemble**. Plusieurs retours n'ont pas de correction propre — ils disparaissent
avec celle d'un autre, ou ils n'ont pas été compris.

## Ce qui ressort de l'ensemble

Trois constats traversent la liste, et ils comptent plus que les retours pris un
par un.

**1. Une seule cause tient quatre retours.** Le §16 — vingt-quatre écrans
enregistrés comme onglets sans qu'on l'ait voulu — explique le retour cassé
partout (15C), la pile de Proches (7), **et l'impossibilité de recommencer un
formulaire (20A)** : un onglet ne se démonte pas, donc aucun de ces écrans ne
remet jamais son état à zéro.

**2. L'application se tait quand une voie est fermée.** Trois écrans retirent
leur fonction sans dire pourquoi (14, 15B, 17), chacun avec une justification
écrite et défendable. Mises bout à bout, elles font une application qui paraît
cassée. **C'est une règle à poser, pas trois correctifs.**

**3. Plusieurs fonctions sont écrites mais non branchées.** Le travail difficile
est fait ; c'est le dernier fil qui manque — parfois une ligne. C'est la
catégorie la plus coûteuse en confiance : l'écran promet, l'accusé confirme, et
rien ne se produit.

**4. Et le commentaire ment plus souvent qu'on ne voudrait.** Aux §13, §17, §19
et §20C, l'intention est écrite, juste, argumentée — au-dessus d'un code qui ne
la tient pas. Le dépôt nomme lui-même le piège : « Un commentaire ne décrit pas
ce qu'on voulait faire. » **En relecture on lit la règle et on passe.**

## Les chantiers, dans l'ordre où je les prendrais

### A. La structure de navigation — §16 (referme 7 et 15C)

**À faire en premier, et seul.** Les cinq onglets dans leur propre groupe, le
reste dans une pile. Sans ça, on corrigerait vingt-quatre fois le même retour.

### B. Les promesses non tenues — §13, §19, §6A

Des gestes qui accusent réception sans rien écrire, ou qui écrivent sans que
personne ne lise.

- [ ] **§13** « Marquer envoyé » ne fait aucun appel réseau — et s'offre sans
      brouillon. *Traiter la condition d'affichage avant de brancher l'appel.*
- [ ] **§19** L'export de données s'enregistre, rien ne le traite. *Le bouton
      est désormais mort sur les comptes d'essai : purger les `pending`.*
- [ ] **§6A** Une contribution reçue n'écrit aucune notification, alors qu'un
      interrupteur existe pour la régler.
- [ ] **§20C** Le code de suppression de compte n'est **jamais envoyé** :
      `AccountService` n'a pas de port de courrier. *Le gabarit existe, le
      chemin de connexion donne la forme — et ce chemin-ci est celui d'un
      droit.*

### C. La règle des voies fermées — §15B, §17, §14

- [ ] **Vérifier d'abord la configuration de la sandbox** — `topup.manual`,
      comptes de collecte, canaux de paiement. Si elle devait être ouverte, 15B
      et 17 n'ont rien à corriger.
- [ ] **Poser la règle** : une voie fermée se dit, ou l'écran n'est pas
      atteignable. Le silence n'est pas une troisième option.
- [ ] **§21** « Confirm » reste gris tant qu'un souhait n'est pas tranché, et
      ne le dit pas — pendant que « Set aside », lui, est actif.
- [ ] **§20D** La fermeture de compte n'offre aucune sortie sans le code.

### D. Les corrections courtes et sûres

Chacune tient en peu de lignes, et aucune n'attend une décision.

- [ ] **§5** Le texte d'aide de la date teste la nature du lien au lieu de la
      date. *Une ligne, plus un test qui tombe sur l'état actuel.*
- [ ] **§18** `natureDeLAppareil` ignore `okhttp` : chaque Android est un
      « appareil inconnu ». *La même panne a été réparée pour iOS.*
- [ ] **§4** La bande d'acquisition ne passe jamais à la ligne. *Une propriété
      flex — et elle sert les cinq surfaces publiques.*
- [ ] **§2 (partie garde)** Le 31 février se saisit et franchit le contrat.
      *Indépendant du sélecteur, et c'est une vraie erreur de données.*

### E. Ce qui attend une décision de conception

- [ ] **§1** L'horizon de l'accueil. *Fenêtre à 4 semaines, cartes à 7 jours :
      que fait-on entre 8 et 28 ? La phrase de résumé survit-elle ?*
- [ ] **§2 (partie forme)** Le `Select` natif — **son propre lot**, iOS et
      Android n'ayant pas la même modalité. Il sert trois écrans.
- [ ] **§9** Le thème : le déplacer vers les réglages, et l'appliquer sous le
      doigt.
- [ ] **§11** Retirer « Moi » du sélecteur — mais les culs-de-sac sont le vrai
      sujet, et ils se rejoignent depuis l'onglet « Moi ».
- [ ] **§8** L'étendue du tirer-pour-rafraîchir.
- [ ] **§7** Une fois §16 corrigé : revient-on à la liste des proches ?
- [ ] **§20D** Que propose l'écran de fermeture quand le code n'arrive pas ?
      *Aujourd'hui : rien. Et le geste engage un droit.*

### F. Bloqué sur une observation

- [ ] **§10A** La cloche annonce 5, le centre ne montre rien. *Ouvrir le centre
      et dire ce qu'il affiche : état vide dessiné, ou erreur ?*
- [ ] **§12** L'échec de portrait. *Le `failureCode` est dans le journal du
      conteneur.* — et le motif est servi par le serveur, jeté par l'écran.
- [ ] **§3** Le mot de collecte. *Rouvrir le lien : le chapeau dit-il « You have
      already answered » ?*
- [ ] **§10B** Le mot d'accueil n'existe pas. *Décision produit, pas panne.*

## Ce qui est déjà tranché

- **§14** — les remboursements du 21 septembre établissent que des générations
  ont bien échoué. Reste le pourquoi (§12).
- **§16** — la cause est établie, la correction est connue, et le §20 en a
  élargi la portée.
- **§20B** — le code ne part pas à l'ouverture ; c'est le §16 qui le fait
  croire.
- **§20C** — la configuration Resend de la sandbox est en ordre. Le défaut est
  dans le code, pas dans l'environnement.

## Une correction de ma part, à lire comme telle

J'ai d'abord attribué le courriel manquant du §20 à `LEHNO_MAIL_CONSOLE` sur la
sandbox, et rédigé toute une marche à suivre pour l'y désactiver. **C'était
faux**, et l'observation qui l'a défait tenait en une phrase : l'OTP de
connexion à l'admin arrive. J'avais raisonné depuis la configuration sans
vérifier le chemin de code. La section a été retirée et remplacée par la cause
réelle.

---

## 1 — L'accueil montre des dates bien au-delà de l'horizon

**Statut :** cause identifiée, correction à décider.

### Ce qui a été vu

L'accueil affiche « Nothing until Mar 4. » — donc l'application sait qu'il n'y
a rien avant quatre mois — puis, juste en dessous, un bloc **COMING UP** avec
la carte « Awa · Birthday · Mar 4 » et son décompte **164 days**.

### Ce que la planche demande

L'accueil ne montre que ce qui vient **dans les quatre semaines au plus**. Quand
il n'y a rien dans cette fenêtre, il montre l'état vide : illustration, « Rien
dans les semaines qui viennent », « Le bon moment pour noter une idée pendant
qu'elle est fraîche. », puis « Laisser une note » et « Faire ma wishlist ».

Les deux libellés existent déjà et sont traduits — `videRienTitre` et
`videRienTexte` dans `apps/mobile/messages/fr.ts` et `en.ts`. Ce n'est donc pas
un état à dessiner : c'est un état qu'on n'atteint jamais.

### La cause

Deux endroits, et il faut les corriger ensemble.

**`apps/mobile/lib/accueil.ts:30` — l'état ne regarde pas les dates, seulement
leur nombre :**

```ts
export function etatDeLAccueil(home: Home): EtatDeLAccueil {
  if (home.occurrences.length > 0) return "nominal";
  return home.hasPersons ? "vide" : "premier";
}
```

Une seule échéance, fût-elle à onze mois, suffit à rendre l'état `"vide"`
inatteignable. C'est pour ça que l'écran vide de la planche ne se voit jamais
sur un carnet rempli.

**`apps/mobile/lib/accueil.ts:89` — le repli sur les dates lointaines :**

```ts
const semaine = avenir.filter((e) => e.daysUntil <= SEMAINE);
const source = semaine.length ? semaine : avenir.slice(0, MIN_CARTES);
```

Le commentaire au-dessus assume le choix : « Rien cette semaine, mais des dates
plus loin : on montre les deux prochaines en cartes quand même. Un écran
d'accueil qui ne montrerait que des rangs n'aurait plus de point d'entrée. »

Le raisonnement se tient, mais il a été tenu **contre l'état vide de la
planche**, sans doute sans le savoir : on a rempli un écran qu'on croyait nu,
alors que le designer y avait mis quelque chose.

### Ce qu'il y a à trancher

- **La fenêtre est de quatre semaines, les cartes sont sur sept jours.**
  `SEMAINE = 7` sert aujourd'hui aux deux usages. Il en faut deux : l'**horizon**
  de l'accueil (28 jours — au-delà, l'écran est vide) et la **fenêtre des
  cartes** (7 jours — au-delà, ce sont des rangs). Entre 8 et 28 jours, la
  question reste ouverte : cartes ou rangs ?
- **Le résumé « Rien avant le 4 mars » survit-il ?** `etatLointain` existe et
  dit quelque chose de vrai. Mais si l'écran passe en état vide, il porte déjà
  « Rien dans les semaines qui viennent » : deux phrases pour la même absence.
  La planche n'en montre qu'une.
- **Le serveur, lui, ne borne rien.** `apps/api/src/me/home.service.ts` rend les
  sept échéances les plus proches sur un horizon de 365 jours. Si le client doit
  filtrer à 28 jours, il reçoit et jette — acceptable pour sept lignes, mais
  `remainingOccurrences` continue alors de compter l'année entière, et le lien
  « Voir plus · n restants » dira un nombre qui ne correspond plus à ce que
  l'écran laisse dehors.

---

## 2 — Le sélecteur de date de naissance n'est pas celui de la planche

**Statut :** cause identifiée, primitive manquante.

### Ce qui a été vu

Sur l'écran d'ajout d'un proche, la section **DATE OF BIRTH** propose une rangée
de jours qui défile horizontalement (on voit « 8 9 10 11 12 13 14 »), puis les
douze mois en vignettes sur quatre lignes. L'ensemble occupe la moitié de
l'écran.

### Ce que la planche demande

Trois **listes déroulantes** côte à côte — Jour, Mois, Année — sur une seule
ligne. Dessous, une case à cocher « Je ne connais pas l'année », puis la
mention « L'anniversaire s'en déduit — inutile de le poser deux fois. »

### La cause

`apps/mobile/app/(app)/proches/identite.tsx:242` emploie `RangeeDeJours` puis
une grille de `Pastille` pour les mois. Le composant fait ce qu'on lui demande
et le fait bien — il défile jusqu'au jour retenu, pour une raison documentée
dans `apps/mobile/composants/RangeeDeJours.tsx`. Ce n'est pas un bogue : c'est
une autre forme.

**La forme de la planche n'est pas implémentable en l'état.**
`packages/ui-native/src/forms/` ne contient que `TextField`. Il n'y a ni
`Select`, ni `Picker`, ni liste déroulante nulle part dans le mobile — et le
pilote de port React Native (`specs/handoff_app_mobile/react-native/`) n'en
livre pas non plus : il établit `tokens`, `Button`, `EventCard`, `AccueilScreen`
et `ReglagesHubScreen`, et rien d'autre.

### La portée : trois écrans, pas un

Le défaut n'est pas propre à l'ajout d'un proche. **Trois écrans saisissent une
date avec la rangée de jours et les mois en vignettes :**

| Écran | Fichier |
|---|---|
| Ajouter / modifier un proche | `apps/mobile/app/(app)/proches/identite.tsx:242` |
| Mon profil — ma propre naissance | `apps/mobile/app/(app)/profil.tsx:414` |
| Un événement | `apps/mobile/app/evenement.tsx:414` |

Le `Select` à construire sert donc les trois, et c'est une raison de plus d'en
faire un lot à part plutôt qu'une retouche d'écran.

### Et un défaut qui en découle : le 31 février se saisit

En cherchant la portée, autre chose est apparu, et celui-là n'est pas une
affaire de forme.

**`evenement.tsx` borne ses jours au mois choisi** — il passe `jours={jours}`,
calculé par `joursDuMois(annee, mois)`, et ramène le jour dans les bornes avec
`borneLeJour`.

**`identite.tsx` et `profil.tsx` ne passent rien.** `RangeeDeJours` retombe
alors sur son défaut : `Array.from({ length: 31 })`, les trente-et-un jours,
quel que soit le mois. On peut donc y choisir **31 février**.

Et rien ne l'arrête ensuite :

- `naissanceAEnvoyer` (`apps/mobile/lib/carnet.ts`) assemble la chaîne sans
  regarder le calendrier : `` `${annee}-${mm}-${jj}` `` ;
- `dateCivileSchema` (`packages/contracts/src/me-events.ts:21`) est
  `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` — **une forme, pas une date.**
  `1990-02-31` la franchit.

Ce qui se passe au-delà dépend du type de la colonne en base, et je ne l'ai pas
éprouvé. Les deux issues sont mauvaises : ou la ligne est refusée et la
personne reçoit une erreur qu'elle ne peut pas comprendre, ou elle est acceptée
et la date est fausse pour toujours.

**À éprouver en premier**, parce que la réponse décide de l'urgence : saisir 31
février sur une fiche et regarder ce que rend l'API.

Le `Select` de la planche supprimerait le problème à la saisie — une liste de
jours qui suit le mois. Mais **la garde doit exister au contrat de toute
façon** : un client ne doit pas pouvoir poser une date qui n'existe pas.

### Ce qu'il y a à trancher

- **Un `Select` natif est un vrai chantier**, pas une retouche d'écran : iOS et
  Android n'ont pas la même modalité (roue en feuille contre menu), et le choix
  se paie sur tous les formulaires qui suivront. Il vaut son propre lot.
- **La case à cocher existe déjà** sous une autre forme : l'écran porte un
  interrupteur « I don't know the year » là où la planche pose une case. Écart
  mineur, mais à régler dans le même passage.
- **La mention explicative manque** : « L'anniversaire s'en déduit — inutile de
  le poser deux fois. » n'est nulle part dans l'écran.

---

## 3 — Le mot d'accompagnement n'arrive pas sur la page de collecte

**Statut :** cause probable identifiée, un essai la confirme ou l'écarte.

### Ce qui a été vu

Un lien de collecte envoyé à quelqu'un, avec un mot personnalisé écrit dans
l'application. La page ouverte par le destinataire n'affiche pas ce mot.

### Ce que la chaîne promet

Le contrat est explicite, et il le dit deux fois. Dans
`packages/contracts/src/me-contributions.ts`, sur le champ d'écriture :

> « Il s'affiche en haut de la page qu'on ouvrira » — la copie de la maquette le
> promet à celui qui l'écrit, et c'est cette promesse qui oblige le contrat à le
> porter. Un champ saisi ici et perdu à l'envoi serait pire qu'un champ absent :
> on croirait l'avoir écrit.

Et dans `packages/contracts/src/public-mur.ts`, sur le champ servi à la page :

> C'est la seule chose de cette page qui ne vienne pas du produit : le reste est
> un formulaire, lui est une voix.

### Ce qui marche

**Toute la chaîne, prise morceau par morceau.** Je l'ai suivie d'un bout à
l'autre et chaque maillon fait ce qu'il doit :

- le mobile envoie bien le mot à la création du lien
  (`apps/mobile/app/(app)/collecte.tsx:122`) ;
- le serveur l'écrit, et le garde quand on rouvre un lien sans le fournir
  (`apps/api/src/mur/collecte.service.ts:88` et `:99`) ;
- il le sert sur les deux natures de lien
  (`apps/api/src/mur/collecte.service.ts:152`) ;
- la page web l'affiche, cité, trait vertical à gauche, au-dessus du chapeau
  (`apps/web/components/surfaces/Collecte.tsx:201`).

Le défaut n'est donc pas dans un maillon. **Il est dans le geste.**

### La cause probable : le mot ne part pas quand on partage

L'écran de collecte enchaîne trois choses dans cet ordre : le champ du mot, un
bouton **« Enregistrer »** qui *n'apparaît que si le texte a changé*, puis le
bouton plein **« Partager »**.

Or « Partager » n'enregistre rien :

```tsx
onPress={() => void Share.share({ message: vivant.url })}
```

Il envoie l'adresse, telle qu'elle est déjà en base. Le mot qu'on vient de taper
juste au-dessus reste dans l'état local de l'écran.

Et le parcours *force* ce piège, parce que le champ du mot n'existe que sur un
lien vivant (`{vivant ? …}`) : on ne peut pas écrire le mot avant de créer le
lien. L'ordre imposé est donc — créer le lien (sans mot, forcément), écrire le
mot, **penser à l'enregistrer**, puis partager. Le seul bouton plein de l'écran
est le dernier, et il marche sans le troisième.

C'est exactement le cas que le contrat disait vouloir éviter : « un champ saisi
ici et perdu à l'envoi serait pire qu'un champ absent : on croirait l'avoir
écrit ».

### Une seconde cause possible, à écarter d'abord

`apps/web/app/[locale]/c/[jeton]/page.tsx:18` revalide la page **toutes les
soixante secondes**. Un mot enregistré puis ouvert dans la minute peut donc
montrer l'état précédent.

**L'essai qui tranche, et il coûte dix secondes :** rouvrir la page maintenant.

- Le mot apparaît → c'était le cache, et il n'y a rien à corriger côté code (au
  plus, à décider si soixante secondes est le bon délai pour cette page).
- Le mot n'apparaît toujours pas → il n'a jamais été enregistré, et c'est bien
  le geste qu'il faut réparer.

### MISE À JOUR — la contribution était bien là, et c'est la découvrabilité qui a manqué

**J'avais conclu qu'aucune ligne `Submission` n'existait.** Le raisonnement
tenait — la file de validation ne filtre rien, donc une file vide vaut une base
vide — mais la prémisse était fausse : la file n'était pas vide, elle n'avait
pas été trouvée. La contribution de Remi s'y trouvait, avec sa date, son mot et
son souhait.

**Ce qui laisse une question plus intéressante que la première : pourquoi
a-t-il fallu la chercher ?**

- **Rien n'a prévenu.** C'est le §6A : une contribution reçue n'écrit aucune
  notification. Ni cloche, ni push, ni courriel. Le seul moyen d'apprendre
  qu'elle est arrivée est d'aller voir.
- **Et l'écran ne se trouve pas depuis là où on l'attend.** La file vit sous
  l'onglet « Moi » (`moi.tsx:297`). Or on attend une contribution *pour un
  proche* : on la cherche sur la fiche du proche, ou sur l'accueil. Ni l'une ni
  l'autre n'y mène.

**À porter au §6A comme une raison de plus**, et à trancher : la fiche d'un
proche devrait-elle annoncer ce qui l'attend ? Le nombre existe déjà côté
serveur — `moi.tsx` l'affiche (`aTrancherPour`).

### Ce qu'il y a à trancher, si c'est bien le geste

- **« Partager » enregistre d'abord.** Le plus court : le bouton enregistre le
  mot en attente s'il y en a un, puis ouvre la feuille de partage. Le bouton
  « Enregistrer » demeure pour qui veut poser le mot sans partager tout de
  suite.
- **Ou bien l'écran refuse de partager un mot non enregistré**, et le dit. Plus
  honnête, plus agaçant.
- **Dans les deux cas, le champ du mot devrait exister avant le lien.** Écrire
  le mot puis créer le lien d'un seul geste supprimerait la moitié du piège.

---

## 4 — La bande d'acquisition s'écrase sur un écran étroit

**Statut :** cause identifiée, correction évidente, portée large.

### Ce qui a été vu

En bas de la page de collecte, sur Android (sandbox) : le titre « Be there on
the day, too » se coupe à un ou deux mots par ligne, le paragraphe descend en
colonne d'une seule main de large, et le bouton « Discover Lehno » reste à
pleine largeur à côté, enfoncé au milieu du texte.

### La cause

`apps/web/components/BandeAcquisition.tsx`. La bande est un conteneur flexible
avec retour à la ligne, mais **le retour ne se déclenche jamais** :

```tsx
display: "flex", flexWrap: "wrap",
…
<div style={{ flex: "1 1 0", minWidth: 0 }}>   {/* le texte */}
<a  style={{ flex: "0 0 auto" }}>              {/* le bouton */}
```

Un élément ne passe à la ligne que s'il ne tient plus à sa largeur minimale. Or
`flex: "1 1 0"` avec `minWidth: 0` dit précisément l'inverse : **la colonne de
texte accepte de rétrécir jusqu'à rien.** Elle se laisse donc écraser au lieu de
pousser le bouton à la ligne, et le bouton, lui, est en `flex: "0 0 auto"` — il
ne cède pas un pixel.

`minWidth: 0` est un réflexe juste ailleurs (il évite qu'un nom long déborde
d'une carte) ; ici il désarme le seul mécanisme qui devait sauver la mise.

### La portée

**Ce composant sert toutes les surfaces publiques** — le Mur, la liste partagée,
l'invitation, le dépôt de vœu, et la collecte. Le défaut est donc sur chacune,
et une seule correction les redresse toutes. À vérifier au même passage.

### La correction

Donner à la colonne de texte une largeur de base qui force le retour — de
l'ordre de `flex: "1 1 20rem"`, sans `minWidth: 0` — plutôt qu'une base nulle.
En dessous de cette largeur, le bouton passe sous le texte, ce que la mise en
page prévoyait déjà (`flexWrap`, `alignItems: "flex-end"`).

**À confirmer sur la planche :** quelle largeur sépare les deux dispositions, et
si le bouton, une fois passé dessous, s'étire sur toute la largeur ou reste à sa
taille.

---

## 5 — « Déjà connue de… » s'affiche sur une date que personne ne connaît

**Statut :** cause identifiée, correction courte, une question de copie.

### Ce qui a été vu

Un lien nominatif envoyé à Remi, dont la fiche **ne porte aucune date de
naissance**. La page présente un champ « Your date of birth » vide, et sous ce
champ vide : « **Already known to valentine — correct it if it is wrong.** »

On demande donc à quelqu'un de corriger une date qu'il n'a pas sous les yeux, et
qui n'existe nulle part.

### La règle voulue

- **Une date est déjà connue** → « Déjà connue de {nom} — corrigez-la si elle
  est fausse. » La phrase actuelle, à sa place.
- **Aucune date connue** → une invitation à la renseigner. C'est un champ à
  remplir, pas une valeur à vérifier.

### La cause

`apps/web/components/surfaces/Collecte.tsx:261`. Le texte d'aide se choisit sur
la **nature du lien**, jamais sur la présence de la date :

```tsx
hint={interpoler(
  ouvert ? t.collecteAideDatePublic : t.collecteAideDateNominatif,
  { nom: ownerDisplayName },
)}
```

`ouvert` dit « lien public ». Tout lien nominatif reçoit donc « Déjà connue
de… », que la fiche porte une date ou non — et une fiche sans date est le cas
ordinaire, puisque c'est souvent pour l'obtenir qu'on envoie le lien.

Le champ juste au-dessus, lui, sait : `const [date, setDate] = useState(birthDate ?? "")`.
La donnée est là, dans le même composant ; c'est la condition qui regarde
ailleurs.

### La correction

**Tester `birthDate`, pas `ouvert`.** Et les deux règles se recouvrent
exactement, sans qu'il faille les combiner : le serveur tait déjà la date sur un
lien public — « y servir un nom ou une date exposerait une fiche à quiconque
relaie l'adresse » — donc `birthDate` y est **toujours** nul. Une condition
unique sur `birthDate` sert donc correctement les deux natures de lien, et la
condition sur le type disparaît.

### La question de copie

Les deux libellés existants suffisent peut-être tels quels :

| Cas | Libellé |
|---|---|
| Date connue | `collecteAideDateNominatif` — « Déjà connue de {nom} — corrigez-la si elle est fausse. » |
| Date inconnue | `collecteAideDatePublic` — « Le jour et le mois suffisent à {nom} pour y penser. » |

La seconde se lit bien sur un lien nominatif sans date : elle invite, et elle
dit même ce qui suffit. **Si elle convient, la correction est d'une ligne et
aucun texte n'est à écrire** — et le nom `collecteAideDatePublic` devient
trompeur, il faudra le renommer (`collecteAideDateInconnue`).

Sinon, il faut un troisième libellé, en français et en anglais.

### Au passage

`apps/web/test/collecte.test.tsx` monte déjà des liens nominatifs avec
`birthDate: null` (lignes 86, 95, 138, 152) — le cas est donc **traversé par la
suite sans être éprouvé** : aucune assertion ne regarde le texte d'aide. La
correction doit venir avec un test qui tombe sur l'état actuel.

---

## 6 — Une contribution reçue ne prévient personne

**Statut :** cause certaine pour la notification. Le second symptôme reste à
départager par un essai.

### Ce qui a été vu

Quelqu'un a rempli le lien et envoyé. Le propriétaire **n'a reçu aucune
notification**, et la page du répondant « affiche toujours la même chose ».

Deux symptômes, deux causes distinctes. Le premier est certain.

### Symptôme A — la notification n'existe pas

`apps/api/src/mur/collecte.service.ts:164`, `soumettre()` : la contribution
s'écrit en base, avec ses souhaits, dans une transaction — et la méthode rend
`{ submitted: true }`. **Il n'y a pas une ligne de notification sur ce chemin.**

Ce n'est pas un oubli de branchement : le type existe partout ailleurs, et
seule l'écriture manque.

| Où | Ce qu'on y trouve |
|---|---|
| `packages/contracts/src/me-notifications.ts:25` | `contribution_received` figure dans `NOTIFICATION_TYPES` |
| `apps/mobile/lib/rappels.ts:58` | l'écran des rappels offre un interrupteur pour ce type |
| **`apps/api/src/`** | **aucune occurrence — rien ne l'écrit jamais** |

Le résultat est le pire des trois : **un interrupteur qui ne commande rien.**
Le commentaire du contrat le dit lui-même à propos d'une autre famille — « un
interrupteur sans effet apprend à ne pas croire les interrupteurs ».

La file de validation, elle, se remplit correctement. Le propriétaire doit
simplement deviner d'aller y regarder.

### Rien ne la signale nulle part — confirmé à l'appareil

Trois manques se cumulent, et c'est leur somme qui a fait croire que la
contribution n'était jamais arrivée :

- **Aucune notification** — c'est le défaut ci-dessus.
- **Aucune marque sur l'accueil.** Le contrat de `/me/home` ne porte rien sur
  les contributions en attente : `firstName`, `occurrences`, `counts`,
  `unreadNotifications`, `remainingOccurrences`, `hasPersons`, `hasWishlist`.
  **L'accueil ne peut donc structurellement pas l'annoncer**, même s'il le
  voulait.
- **Aucune mise en évidence dans la file.** Une contribution nouvelle ne se
  distingue pas d'une ancienne.

La seule voie qui a fonctionné est la fiche du proche — et encore, **après
redémarrage de l'application** (voir la question ouverte au §16/§20A).

### Ce qu'il y a à trancher pour le symptôme A

- **Quels canaux.** La ligne `in_app` du centre de notifications est le minimum
  — c'est elle qui allume la pastille de la cloche, déjà servie par
  `/me/home`. Le push et le courriel sont un choix à part.
- **Le groupage.** Trois personnes qui répondent dans l'heure font-elles trois
  entrées ou une ? Sur un lien public relayé, la question n'est pas théorique.
- **Le réglage est-il configurable ?** `contribution_received` n'est pas dans
  `ALWAYS_SENT_NOTIFICATIONS`, donc il est réglable — l'interrupteur qui existe
  déjà prendra effet tout seul une fois l'écriture posée.

### Symptôme B — la page du répondant, à départager

Ici je n'ai pas de certitude, et le code seul ne la donnera pas.

**Ce que le code fait, et qui est juste :** à l'envoi réussi, le composant pose
`envoye` et la page bascule sur une bannière de succès
(`apps/web/components/surfaces/Collecte.tsx:117` et `:151`). En cas d'échec,
elle pose `erreur` et montre une bannière rouge près du bouton d'envoi
(`:388`). Au **rechargement**, l'historique se relit sans cache et, s'il n'est
pas vide, le chapeau change — « You have already answered. You can add more…
» — et le bloc `DejaEnvoye` paraît au-dessus des souhaits.

**Donc la page devrait changer, dans les trois cas.** Qu'elle n'ait pas changé
laisse deux lectures :

1. **L'envoi a échoué et la bannière rouge est passée inaperçue.** Le candidat
   le plus vraisemblable serait `NEXT_PUBLIC_API_URL` : les lectures se font au
   serveur avec `API_URL`, l'envoi se fait au navigateur avec
   `NEXT_PUBLIC_API_URL` — deux variables distinctes, et une page qui s'affiche
   ne prouve donc rien de l'envoi. **Mais `.github/workflows/sandbox.yml:93` la
   pose explicitement** à `https://api.sandbox.lehno.io`, avec un commentaire
   qui dit pourquoi elle n'est pas prise de `vars`. L'hypothèse ne tient que si
   l'image déployée est antérieure à cette ligne.
2. **L'envoi a réussi, et c'est le retour ultérieur qui ne dit rien.** Alors
   `relire` rend une liste vide là où elle devrait rendre la contribution.

**Les deux essais qui tranchent :**

- Rouvrir le lien maintenant. Le chapeau dit-il « You have already answered » ?
  → l'envoi a réussi, et seul le symptôme A subsiste.
- Sinon : la file de validation du propriétaire porte-t-elle la contribution ?
  Si oui, c'est `relire` ; si non, c'est l'envoi.

---

## 7 — L'onglet Proches rouvre la fiche qu'on avait quittée

**Statut :** cause identifiée, décision de navigation à prendre.

### Ce qui a été vu

Ouvrir la fiche d'un proche, aller partager un lien, revenir à l'accueil. En
rouvrant l'onglet **Proches**, on ne retombe pas sur la liste des proches mais
sur la fiche qu'on avait laissée.

### La cause

`apps/mobile/app/(app)/proches/` est le **seul onglet qui soit un dossier** —
donc le seul qui porte une pile de navigation (`_layout.tsx` y monte un
`Stack`). Les quatre autres sont des fichiers simples, sans pile, et n'ont donc
rien à retenir.

`apps/mobile/app/(app)/_layout.tsx` fait, sur chaque appui d'onglet :

```tsx
onSelect={(id) => navigation.navigate(id)}
```

`navigate` sur un onglet **restaure l'état de sa pile**. C'est le comportement
normal de React Navigation, et sur les quatre autres onglets il ne se voit pas
faute de pile. Sur Proches, il ramène la fiche.

### Ce qu'il y a à trancher

Ce n'est pas un bogue au sens strict : c'est la convention par défaut, et elle
se défend — un onglet qui garde sa place évite de refaire trois gestes pour
retrouver ce qu'on lisait. Mais elle se défend **quand l'onglet est un lieu où
l'on séjourne**, et l'onglet s'appelle ici « Proches », pas « ce proche ».

Trois conduites possibles :

- **Revenir à la liste dès qu'on quitte l'onglet.** Le plus proche de ce que le
  nom promet, et de l'attente décrite.
- **Garder la pile, mais la remettre à zéro quand on appuie sur l'onglet DÉJÀ
  actif.** C'est la convention iOS, et elle ne règle pas le cas décrit ici —
  l'onglet n'était pas actif.
- **Garder la pile.** Alors il faut que le retour depuis une fiche soit
  évident, et vérifier qu'il l'est sur cet écran.

**La planche doit trancher.** Si elle ne dit rien, c'est un choix de
comportement natif — exactement la catégorie que le pilote de port laisse
ouverte : « ce que le kit web ne peut pas décider ».

---

## 8 — Le tirer-pour-rafraîchir ne couvre que trois écrans

**Statut :** relevé exact à une nuance près, portée à décider.

### Ce qui a été vu

« Le tirer-pour-rafraîchir ne semble implémenté que sur l'accueil. »

### Ce qui est

Trois écrans le portent, pas un :

- `apps/mobile/app/(app)/accueil.tsx`
- `apps/mobile/app/(app)/dates.tsx`
- `apps/mobile/app/(app)/reprises.tsx`

L'observation tient quand même : **tout le reste en est dépourvu** — la liste
des proches, les notifications, les listes, les souhaits, le Mur, les
mouvements, « Moi », et la file de validation des contributions. Ce sont pour
la plupart des écrans qui montrent des données venues du serveur et qui peuvent
avoir vieilli.

### Ce que le pilote de port en disait

`specs/handoff_app_mobile/react-native/LISEZ-MOI.md` range le geste parmi « ce
que le kit web ne peut pas décider » :

> **Le tirer-pour-rafraîchir** : sur quels écrans (ici : oui sur l'accueil, non
> sur les formulaires)

Le kit a donc posé une règle à deux bornes — oui sur l'accueil, non sur les
formulaires — **et laissé tout l'entre-deux ouvert.** Les écrans qui manquent
sont précisément ceux dont il ne parlait pas.

### Ce qu'il y a à trancher

La règle qui se déduit du peu qui est dit : **tout écran qui LISTE ce que le
serveur détient le porte ; aucun formulaire ne le porte.** Si elle convient, la
liste à reprendre est celle ci-dessus, et le travail est mécanique — les trois
écrans qui l'ont déjà donnent la forme à recopier.

Reste à décider pour les écrans mixtes — « Moi » montre un solde et porte des
champs.

---

## 9 — La bascule de thème est au mauvais endroit, et n'agit qu'à l'enregistrement

**Statut :** les deux causes sont certaines. Les deux corrections sont courtes.

### Ce qui a été vu

Le choix clair / sombre se trouve dans **le profil**. Et il ne change rien tant
qu'on n'a pas appuyé sur « Enregistrer » en bas de l'écran.

### Le lieu

`apps/mobile/app/(app)/profil.tsx:450`. Et `reglages.tsx` **ne contient aucune
mention de thème** — pas une ligne.

La planche pose l'inverse : le pilote de port livre un écran entier pour ça,
`specs/handoff_app_mobile/react-native/ReglagesHubScreen.js`, présenté dans le
LISEZ-MOI comme « les réglages, dont le choix de thème — **le cas où le web ne
pouvait rien décider** ». Le thème appartient aux réglages, et le designer a
pris la peine d'en livrer l'écran.

Le profil porte qui l'on est ; les réglages portent ce qui règle le produit.
C'est la ligne que `_layout.tsx` trace déjà pour les deux onglets.

### Le comportement

Le sélecteur n'écrit que dans l'état du formulaire :

```tsx
pose={(v) => setSaisie({ ...saisie, theme: v ?? saisie.theme })}
```

L'application réelle est ailleurs, **dans le gestionnaire d'enregistrement**
(`profil.tsx:268`) :

```tsx
choisis(saisie.langue);
choisisLeTheme(saisie.theme);
void poseLApparence(saisie.theme);
routeur.back();
```

Et le commentaire juste au-dessus explique pourquoi c'est là :

> On l'applique **après l'enregistrement** : ce qui est affiché correspond alors
> à ce que le serveur a retenu.

**Le raisonnement est juste pour la langue, et faux pour le thème.** La langue
est une donnée du compte — elle gouverne les courriels, elle doit suivre ce que
le serveur a retenu. Le thème est un **réglage d'affichage** : sa vérité est ce
qu'on voit, et l'attendre d'un aller-retour réseau fait douter du bouton.

Le pilote de port avait d'ailleurs posé la question sans la trancher, et c'est
exactement celle-ci :

> **La bascule de thème** : immédiate sous le doigt, ou appliquée au retour

La réponse est tranchée : **immédiate**.

### Les deux corrections

1. **Déplacer le choix de thème du profil vers les réglages**, sur le modèle de
   `ReglagesHubScreen.js`. Les trois positions restent trois — « Système » est
   la valeur par défaut au contrat, et le commentaire de `profil.tsx` dit bien
   pourquoi un couple Clair / Sombre ne suffit pas.
2. **Appliquer sous le doigt** : `choisisLeTheme(v)` et `poseLApparence(v)` dans
   le `pose` du sélecteur, et non dans l'enregistrement.

**Un point à ne pas casser au passage :** la persistance côté compte doit
continuer de partir. Appliquer tout de suite ne veut pas dire ne plus
enregistrer — l'écran des réglages n'ayant pas de bouton « Enregistrer », il lui
faudra écrire au serveur de lui-même.

---

## 10 — La cloche annonce 5, le centre ne montre rien ; et aucun mot d'accueil

**Statut :** deux questions distinctes. La seconde a une réponse nette, la
première demande une observation de plus.

### A — RÉSOLU : la pastille dit vrai, c'est le centre qui jette en silence

**Observation qui tranche :** le centre affiche **l'état vide dessiné**, pas une
erreur. Donc la lecture ne casse pas — mon hypothèse d'un type absent du contrat
était fausse. La réalité est plus douce et pire.

**La pastille n'est pas une valeur de maquette.** `pastilleDeCloche` rend `null`
en dessous de 1, sinon le nombre ; `NotificationBell` part de `unread = 0`, et
l'accueil lui passe `home.unreadNotifications`. **Le 5 est réel : cinq
notifications non lues existent bel et bien.**

**Et le centre les jette, côté client.**
`apps/mobile/app/(app)/notifications.tsx:133` :

```tsx
const lisibles = items.filter((n) => libelleDeLaNotification(n, t) !== null);
…
if (!lisibles.length) { /* état vide */ }
```

`libelleDeLaNotification` (`apps/mobile/lib/notifications.ts`) est un `switch`
qui ne connaît que **quatre** clés — `event_reminder`, `event_day_of`,
`own_date_reminder`, `own_date_day_of` — et retombe sur `default: return null`
pour tout le reste. Une notification sans libellé est retirée **sans un mot**,
et si toutes le sont, l'écran affiche son vide dessiné.

### Ce n'est pas une découverte : c'est écrit dans le fichier

Juste en dessous du `switch`, une liste nommée `CLES_SERVIES` et ce commentaire :

> **CE QUE LE SERVEUR ÉMET ET QUE LA COPIE NE SAIT PAS DIRE.** Rendu visible par
> un test plutôt que perdu dans un commentaire : ces notifications partent,
> arrivent, et **n'apparaissent nulle part**. C'est un silence, pas une panne —
> mais il se voit d'autant moins qu'il est silencieux.

La liste porte **dix** clés, le `switch` en traite **quatre**. **Six natures
émises n'ont aucun libellé :**

```
activation_first_person · activation_first_note · activation_unused_credits
enrichment_nudge_global · enrichment_nudge_person · wish_reserved
```

**Vos cinq sont presque certainement des `activation_*`** — un compte neuf en
reçoit précisément de cette famille : premier proche, première note, crédits
inutilisés.

### Ce qu'il y a à faire

- **Écrire la copie des six clés manquantes**, en français et en anglais. C'est
  le gros du travail, et il est connu depuis qu'on a écrit `CLES_SERVIES`.
- **Cesser de jeter en silence.** Une notification sans libellé doit se voir
  d'une façon ou d'une autre — au minimum ne pas être comptée par la pastille,
  au mieux tomber sur un rendu générique. Aujourd'hui elle est comptée **et**
  cachée, ce qui est la seule combinaison qui ne puisse pas s'expliquer à
  l'écran.
- **Attention au piège inverse :** même les quatre clés traitées rendent `null`
  quand `bodyParams` n'a pas `person` ou `days`. Un corps mal formé disparaît
  donc aussi, et par le même chemin.

### B — le mot d'accueil n'existe pas

Celui-là ne demande aucune enquête. `apps/api/src/onboarding/signup.service.ts`
**n'écrit aucune notification**, et il n'existe **aucun type d'accueil** dans
l'énumération — ni au contrat, ni dans `prisma/schema.prisma`.

Ce qui existe et qui pourrait passer pour ça, ce sont les cinq `activation_*` —
premier proche, première note, crédits inutilisés, lien de collecte,
invitation. Mais ce sont des **relances**, envoyées par `RelancesService` selon
ce qu'on a fait ou pas fait, pas un mot à l'arrivée.

**Ce n'est donc pas une panne : c'est une fonctionnalité qui n'a jamais été
écrite.** À décider comme telle — si un mot d'accueil doit exister, il lui faut
un type, un libellé dans les deux langues, et une écriture à l'inscription.

---

## 11 — « Moi » figure dans la liste « pour qui »

**Statut :** cause identifiée, et le choix est délibéré — c'est donc la
décision qu'il faut reprendre, pas le code seul.

### Ce qui a été vu

En ajoutant une date, le sélecteur **POUR QUI** propose « Moi » en tête, avant
Awa et Remi. Le choisir mène à « une suite de culs-de-sac ».

### La cause

Ce n'est pas un oubli de filtre. `apps/mobile/app/evenement.tsx` **nomme
explicitement le cas** : `nomAAfficher(proche, t.evtPourMoi)`, aux lignes 251 et
327. La fiche `is_self` est dans le carnet, la liste la rend, et un libellé
propre — « Moi » — a été écrit pour elle.

La source est `/me/persons?sort=alpha&…` (`evenement.tsx:89`), le carnet entier,
sans filtre autre que le retrait du proche déjà choisi (`:173`). Le placeholder
du champ le dit aussi : « **Vous** ou un proche ».

### Ce qu'il faut trancher

L'intention rapportée est claire : **ses propres dates se gèrent dans l'onglet
« Moi »**, donc la liste ne doit pas proposer « Moi ». Si c'est la règle, alors
il faut aussi :

- retirer le libellé `evtPourMoi` de ce sélecteur, et corriger le placeholder
  (« Vous ou un proche » → « Un proche ») ;
- **vérifier que l'onglet « Moi » permet réellement d'ajouter une date à soi**,
  sans quoi on ferme une porte sans en ouvrir une autre ;
- vérifier le reste de la chaîne : le contrat et le serveur acceptent
  aujourd'hui un événement sur la fiche `is_self`, et `ProgrammationService`
  s'en sert — « le séparateur est `person.is_self` », dit `schema.prisma`, et
  les types `own_date_reminder` / `own_date_day_of` existent pour ça.

**Les culs-de-sac sont le vrai sujet.** Retirer « Moi » de la liste les cache
sans les régler — et les mêmes écrans se rejoignent depuis l'onglet « Moi ».
Dites-moi lesquels vous avez rencontrés : ce sont eux qu'il faut réparer, le
retrait du sélecteur n'étant que la moitié propre du travail.

---

## 12 — « L'écriture n'a pas abouti », et la page ne dit pas pourquoi

**Statut :** la cause réelle est dans le journal du serveur. Mais l'écran a un
défaut propre, indépendant de l'incident.

### Ce qui a été vu

Un portrait lancé (Notre relation · Encre · illustration Nature), et un bandeau
noir : « **L'écriture n'a pas abouti** ».

### Ce que ce message signifie exactement

`apps/mobile/app/portrait.tsx:278`. L'écran interroge la génération jusqu'à ce
qu'elle s'arrête, puis :

```tsx
if (lu.generation.status === "succeeded" && lu.generation.resultId) { … }
setEchecDuGeste(t.genErreurTitre);
```

Le message tombe donc dans **tous** les cas qui ne sont pas un succès avec
résultat. La génération a bien été lancée et a bien échoué côté serveur — ce
n'est pas un problème de réseau ni de formulaire.

### Le défaut de l'écran : le motif est servi, et jeté

Le serveur **dit pourquoi**. Le contrat porte le champ
(`packages/contracts/src/me-generation.ts:165`) :

```ts
failureReason: z.string().nullable(),
```

et `apps/api/src/me/generation.controller.ts:241` le remplit depuis
`failureCode`. Les propres tests du mobile le simulent —
`apps/mobile/test/generation.test.ts:46` pose `"provider_unavailable"`.

**Aucun écran de génération ne le lit.** `failureReason` n'est lu nulle part
dans le mobile, sauf dans `recharge.tsx:391` — pour les paiements, où il est
correctement affiché.

Le résultat : la même phrase pour un fournisseur indisponible, un crédit
manquant ou un refus de contenu. La personne ne sait ni si elle doit réessayer,
ni si elle doit recharger, ni si elle doit changer ce qu'elle a demandé.

### Les deux choses à faire, dans cet ordre

1. **Trouver la cause de CET échec** — le journal du conteneur de l'API sur la
   sandbox porte le `failureCode`. C'est lui qui dira s'il y a un second défaut
   à corriger derrière.
2. **Afficher le motif**, comme `recharge.tsx` le fait déjà. Les codes sont un
   petit ensemble fermé : il leur faut une table de libellés dans les deux
   langues, et un repli sur la phrase actuelle pour un code inconnu.

---

## 13 — « Marquer envoyé » ne marque rien, et s'offre sans brouillon

**Statut :** trois défauts distincts, tous certains, sur six lignes de code.

### Ce qui a été vu

Sur la carte d'Awa, un geste « Marquer comme envoyé » alors qu'**aucun message
n'avait été produit**. En appuyant : « Message marqué comme envoyé à Awa. » Et
la question, qui est la bonne : *qu'est-ce qui a été envoyé, à qui, et où est la
trace ?*

### D'abord, ce que le geste veut dire

Il ne prétend pas que l'application ait envoyé quoi que ce soit, et le contrat
est net là-dessus (`packages/contracts/src/me-generation.ts`) :

> `markSent` est **déclaratif** : l'application n'envoie rien elle-même — le
> message se copie ailleurs, dans la messagerie de son choix. Le marquer est
> donc une affirmation de l'utilisateur, pas un constat du serveur, et l'écrire
> autrement **ferait croire à une preuve d'envoi qui n'existe pas**.

Le geste est donc : « j'ai recopié ce brouillon dans WhatsApp, range-le ». Rien
ne part de l'application. C'est légitime — et c'est aussi ce qui rend les trois
défauts ci-dessous gênants.

### Défaut A — il n'écrit rien nulle part

`apps/mobile/app/(app)/accueil.tsx:419` :

```tsx
onMarkSent: () => {
  setEnvoyes((v) => ({ ...v, [e.id]: true }));
  setAccuse(t.envoiFait(nomDeLEcheance(e, t.evtPourMoi)));
},
```

**Aucun appel réseau.** L'état vit dans un `useState` de l'écran
(`accueil.tsx:59`), et disparaît au premier rechargement. Le bouton
réapparaîtra.

**La trace n'existe pas parce qu'il n'y a pas d'écriture.** Ce n'est pas qu'elle
soit mal rangée : rien n'a été écrit.

Et le chemin correct existe déjà, complet, éprouvé : `markSent` est implémenté
au serveur (`apps/api/src/me/generation.service.ts:929`), et l'écran de
génération l'appelle bien — `apps/mobile/test/generation.test.ts:205` gèle le
corps `{ markSent: true }`. **C'est la carte de l'accueil qui fait semblant**,
seule contre le reste de la chaîne.

### Défaut B — il s'offre alors qu'il n'y a pas de brouillon

La condition d'affichage est `gesteDeLaCarte(e, preparer) === "message"`, et
cette fonction tient en trois lignes (`apps/mobile/lib/accueil.ts`) :

```ts
if (echeance.isSelf) return "liste";
return generationOuverte ? "message" : "note";
```

`generationOuverte` dit seulement que **le drapeau de génération est allumé sur
le compte**. Il ne dit pas qu'un message existe pour cette échéance, ni qu'on en
ait jamais demandé un.

D'où l'écran vu : aucun message produit, et pourtant le geste proposé. Marquer
comme envoyé un message qui n'a jamais été écrit.

### Défaut C — l'accusé dit ce que le contrat interdit de dire

« **Message marqué comme envoyé à Awa.** » — la phrase nomme un destinataire et
un envoi. C'est exactement la lecture que le contrat demandait d'éviter : « une
preuve d'envoi qui n'existe pas ». Rien n'est parti vers Awa, et rien n'aurait
pu partir : l'application ne connaît aucun canal vers elle.

### Ce qu'il y a à faire

1. **Brancher l'appel** — la carte doit faire le `PATCH` que fait déjà l'écran
   de génération, et n'afficher l'accusé qu'au retour du serveur.
2. **Ne proposer le geste que s'il y a un brouillon à marquer.** La condition
   doit porter sur l'existence d'un message pour cette échéance, pas sur le
   drapeau. **À vérifier :** `/me/home` sert-il de quoi le savoir ? Si non, le
   contrat de l'accueil doit le porter — la carte ne peut pas le deviner, et un
   second appel par carte n'est pas une option.
3. **Reprendre la phrase** pour qu'elle déclare au lieu de constater — « Noté :
   vous avez écrit à Awa », ou une formule de la planche si elle en porte une.

**Le défaut B est celui à traiter en premier.** Tant qu'il tient, brancher
l'appel ne ferait qu'enregistrer fidèlement une affirmation sur un message qui
n'existe pas.

---

## 14 — Lancer un message mène à une liste vide, sans attente et sans trace

**Statut :** deux causes certaines, et elles expliquent l'écran vu **avec** le
retour 12. À traiter ensemble.

### Ce qui a été vu

Appuyer pour produire un message. L'application ouvre « **En cours** », qui
affiche son état vide : « Tout est traité — ce que vous commencerez sans finir
vous attendra ici. » Puis plus rien. Pas d'attente à l'écran, pas de résultat,
et la question qui suit : *où est-ce que je le retrouve ?*

### Cause A — le lancement ouvre la liste, pas l'exécution

`apps/mobile/app/(app)/preparation.tsx:87` :

```tsx
await appel<unknown>("/me/generations", {
  method: "POST",
  body: JSON.stringify(composeLaDemande(kind, occurrenceId)),
  gouvernee: true,
});
routeur.push("/(app)/reprises");
```

**La réponse du serveur est jetée.** Elle porte pourtant l'identifiant de la
génération qui vient d'être créée, son statut et son `resultId`
(`packages/contracts/src/me-generation.ts:155`). On l'ignore, et on pousse vers
l'écran de LISTE.

Or l'écran d'attente existe : `/generation?id=<identifiant>` observe une
exécution, la fait patienter et ouvre le résultat. C'est exactement ce que
`portrait.tsx` fait pour un portrait. Et `reprises.ts` le rappelle lui-même,
dans le commentaire de `destinationDeLaReprise` :

> le message et les idées s'observent par leur EXÉCUTION, `/generation?id=`

Le même fichier raconte d'ailleurs la panne jumelle, déjà réparée une fois :

> La carte poussait `/generation` SANS IDENTIFIANT. […] Vu de l'appareil : on
> appuie sur « Reprendre » et rien ne bouge. Pas d'erreur, pas d'écran : rien.

**C'est la même panne, à l'autre bout du même parcours** — corrigée sur le geste
« Reprendre », laissée sur le geste qui lance.

**L'attente manquante n'est donc pas un oubli de loader** : c'est l'écran qui
sait attendre qu'on n'ouvre pas.

### Cause B — une génération ratée disparaît de la liste

Même en atterrissant sur « En cours », la génération aurait dû s'y voir. Elle
n'y est pas, et `apps/mobile/lib/reprises.ts:191` dit pourquoi, en une ligne :

```ts
if (generation.status === "failed") continue;
```

**Les échecs sont écartés sans un mot.**

**Ce qui suit est une DÉDUCTION, pas une observation.** Rien n'a dit que cette
génération-là avait échoué : le retour 12 portait sur un **portrait**, celle-ci
est un **message**, et transporter la panne de l'une à l'autre serait une
supposition. Voici ce qui est établi, et ce qui ne l'est pas.

**Établi :**

- **La demande est passée.** `routeur.push` n'est atteint que si `appel` n'a
  pas jeté ; un échec réseau aurait posé le bandeau et laissé l'écran en place.
  Elle a navigué, donc le serveur a répondu 2xx et une exécution existe.
- **Le serveur ne cache rien.** `generation.service.ts:lister` rend les
  cinquante plus récentes, sans filtre d'état ; le contrôleur n'en retire
  aucune.
- **Les états sont exhaustifs.** `running | succeeded | failed`, et la table de
  correspondance avec la base (`pending | success | failure`) est complète —
  aucune ligne ne peut tomber dans un état imprévu.
- **Le client n'écarte que deux choses** : `status === "failed"`, et les natures
  dont le drapeau est éteint.

**Il ne reste donc que deux explications, et je ne peux pas choisir entre
elles depuis le code :**

1. **La génération a échoué**, et la liste l'a jetée.
2. **Le drapeau de la nature « message » n'est pas actif pour ce compte.**
   L'écran se replie alors sur son état vide **sans même appeler**
   (`reprises.tsx:75`) — ce qui expliquerait aussi qu'il paraisse
   instantanément. Cette branche est moins probable, puisque le geste
   « Préparer » ne s'offre que si une nature est ouverte, mais `ecranEteint`
   et `preparationOuverte` ne lisent pas forcément le même drapeau : **à
   vérifier.**

**MISE À JOUR — l'écran des mouvements tranche en grande partie** (voir le
retour 15). Il porte, tous datés du 21 septembre :

| Mouvement | Montant |
|---|---|
| Remboursement | + 1 |
| Génération | − 1 |
| Remboursement | + 2 |

Un remboursement de crédit ne se produit que dans un cas — « en cas d'échec, le
crédit est rendu au solde ». **Des générations ont donc bel et bien échoué ce
jour-là**, et l'explication 1 l'emporte sur l'explication 2.

Ce qui reste à confirmer est plus étroit : que l'échec porte sur **cette**
demande-là, et surtout **pourquoi**. Le `+2` intrigue d'ailleurs — il ne
correspond à aucun `−2` visible, donc soit l'écran tronque, soit une exécution
plus coûteuse a échoué ailleurs.

**Ce qui tranche :** le journal du conteneur de l'API sur la sandbox, ou l'appel
direct à `/me/generations` avec le jeton du compte. La réponse dira l'état de
l'exécution, et son `failureReason` s'il y en a un.

**Mais les deux causes A et B tiennent quelle que soit la réponse** : dans un
cas comme dans l'autre, l'écran d'attente n'a pas été ouvert, et rien n'a été
dit. Le crédit, lui, est rendu en cas d'échec — « en cas d'échec, le crédit est
rendu au solde et la raison portée par la réponse » — mais la raison n'atteint
aucun écran (retour 12, défaut symétrique sur le portrait).

### Ce qu'il y a à faire

1. **Router vers l'exécution.** Lire l'identifiant rendu par le `POST` et
   pousser `/generation?id=<id>`. L'attente, le résultat et l'échec y sont déjà
   traités.
2. **Cesser d'escamoter les échecs**, ou dire où ils vont. Si « En cours » ne
   doit porter que ce qui peut être repris, alors un échec doit se voir
   ailleurs — au minimum sur l'écran qui l'a lancé, avec son motif. Le taire
   des deux côtés est ce qui produit le silence complet.
3. **Se souvenir que le crédit est rendu.** Un échec muet fait croire à un
   crédit perdu, ce qui est faux — et c'est une raison de plus de le dire.

**L'ordre :** corriger A d'abord. Une fois l'écran d'attente ouvert, l'échec se
voit là où il doit se voir, et B redevient une question de rangement plutôt
qu'un trou.

---

## 15 — « Recharger » n'ouvre aucun achat, et le retour sort de l'onglet

**Statut :** trois choses. Deux causes certaines, une hypothèse structurelle qui
expliquerait aussi le retour 7.

### Ce qui a été vu

Depuis « Moi », appuyer sur **Recharger**. L'écran montre le solde (5), la liste
des mouvements, un lien « Tout voir » — et **rien pour recharger**. Les
mouvements affichent des lignes non reconnues : des générations et des
remboursements. Et le retour depuis cet écran ramène à l'**accueil**, pas à
« Moi ».

### A — les mouvements ne sont pas inexplicables : ce sont les échecs

Trois lignes, toutes du 21 septembre : Remboursement +1, Génération −1,
Remboursement +2.

**C'est la trace des générations ratées.** Le crédit est débité au lancement,
puis rendu quand l'exécution échoue — « en cas d'échec, le crédit est rendu au
solde ». Ce sont donc les essais de la journée qui figurent là, et cet écran est
**le seul endroit de l'application où ils laissent une marque**.

Ce qui est en soi le constat du retour 14 : la comptabilité garde la trace,
aucun écran de génération ne la montre. On découvre ses échecs par son relevé
de crédits.

**Une chose reste à éclaircir :** le `+2` ne répond à aucun `−2` visible. Soit
la liste est tronquée aux trois derniers — c'est ce que fait `recents`, et
« Tout voir » mène au reste —, soit une exécution plus chère a échoué ailleurs.

### B — l'achat ne s'affiche pas parce qu'une voie est fermée

`apps/mobile/app/(app)/recharge.tsx:416` :

```tsx
const achetable = manuel && compte !== null;
```

Deux conditions : le drapeau `topup.manual`, **et** un compte de versement
configuré. Si l'une manque, tout le bloc d'achat — les paliers, le moyen de
paiement, le bouton — disparaît, et l'écran se replie sur cette branche
(`:670`) :

```tsx
) : (
  /* Ni palier ni compte à proposer : le solde reste, il est du socle.
     Un écran de recharge qui n'affiche plus rien du tout ferait croire
     à une panne là où il n'y a qu'une voie fermée. */
  <Card surface="panel" padding={16} radius="lg">
    <CreditIndicator label={t.moiSolde} balance={solde} variant="solde" />
  </Card>
)}
```

**Le commentaire annonce l'intention, le code ne la tient pas.** Il dit vouloir
éviter qu'on croie à une panne — et il n'affiche qu'un solde, sans un mot. Vu de
l'appareil, appuyer sur « Recharger » et n'obtenir qu'un nombre ne se distingue
pas d'une panne : c'est même la lecture la plus naturelle.

**À trancher :**

- **Dire que la voie est fermée**, et pourquoi, dans cette branche. C'est ce que
  le commentaire voulait.
- **Ou ne pas proposer « Recharger » du tout** quand rien n'est achetable.
  L'écran « Moi » connaît les drapeaux ; un bouton qui mène à un cul-de-sac vaut
  moins qu'un bouton absent — c'est déjà la règle qu'applique `_layout.tsx`
  pour les onglets : « un onglet qui mène à une page vide est pire qu'un onglet
  absent ».
- **Et vérifier la configuration de la sandbox** : `topup.manual` est-il
  allumé, et un compte de versement existe-t-il ? Si la voie devait être
  ouverte, le défaut est là et non dans l'écran.

### C — le retour sort de l'onglet, et ce n'est pas propre à cet écran

`recharge.tsx:251` appelle `routeur.back()`, ce qui est juste. Mais on
n'atterrit pas sur « Moi ».

**Hypothèse, et elle expliquerait aussi le retour 7 :**
`apps/mobile/app/(app)/_layout.tsx` monte un `Tabs`. Le dossier `(app)/`
contient **29 écrans** ; cinq seulement sont déclarés comme onglets. Les
vingt-quatre autres — dont `recharge`, `mouvements`, `listes`, `valider`,
`monmur` — sont donc enregistrés comme **onglets frères invisibles**, masqués
seulement parce que notre `TabBar` dessine une liste fixe de cinq.

Si c'est le cas, aller de « Moi » à « Recharger » n'est pas un empilement mais
un **changement d'onglet**, et `back()` retombe sur l'onglet initial —
l'accueil. Ce qui est exactement ce qui a été vu.

Et c'est la même racine que le retour 7 : la pile de `proches` qui garde son
état, parce que les onglets gardent le leur.

**Ce n'est pas établi, c'est déduit**, et ça se vérifie vite : suivre l'état du
navigateur au moment du geste, ou regarder si `mouvements` → retour se comporte
comme `recharge` → retour.

**Si l'hypothèse tient, la correction n'est pas dans ces écrans** mais dans la
structure : les écrans qui ne sont pas des onglets doivent vivre dans une pile,
pas à côté des onglets. C'est un chantier à part, et il faut le traiter avant de
retoucher les retours un par un — sinon on corrige vingt-quatre fois le même
défaut.

---

## 16 — LE RETOUR EST CASSÉ PARTOUT, et c'est une seule cause

**Statut :** cause établie. **C'est le défaut le plus important de la
séance** — il explique à lui seul les retours 7 et 15C, et il touche
vingt-quatre écrans.

### Ce qui a été vu, trois fois

| Parcours | Attendu | Obtenu |
|---|---|---|
| Moi → Recharger → retour | Moi | **Accueil** |
| Réglages → Réglage des notifications → retour | Réglages | **Accueil** |
| Proches → fiche → accueil → onglet Proches | la liste | **la fiche quittée** |

Trois écrans sans rapport, trois fois le même dérèglement. Ce n'est pas un
bouton mal branché : les trois appellent `routeur.back()`, et c'est correct.

### La cause

`apps/mobile/app/(app)/_layout.tsx` monte un **`Tabs`**. Or `expo-router`
enregistre comme écran d'onglet **tout ce que contient le dossier du layout**,
déclaré ou non.

Le dossier `(app)/` contient **vingt-neuf écrans**. Cinq sont des onglets. Les
**vingt-quatre autres** le sont donc aussi, sans qu'on l'ait voulu :

```
aide, apercu, apercu-liste, cadrage, collecte, donnees, fermeture, listes,
monmur, mouvements, notifications, occasion, paiement, parrainage,
preparation, profil, rappels, recharge, reprises, reservations, securite,
souhait, souhaits, valider
```

Ils sont invisibles, mais pas pour la raison qu'on croit : **rien ne les
masque.** C'est notre `TabBar` qui dessine une liste fixe de cinq entrées
(`onglets`) et ignore le reste. La barre ment sur ce qu'est la navigation.

**Conséquence :** aller de « Moi » à « Recharger » n'empile rien — **c'est un
changement d'onglet.** Et `back()` sur un navigateur d'onglets ne dépile pas :
il applique `backBehavior`, dont la valeur par défaut est **`firstRoute`**.
Aucun `backBehavior` n'est posé ici. Le retour ramène donc **toujours au
premier onglet** — l'accueil.

Ce qui est exactement, et à chaque fois, ce qui a été observé.

Le retour 7 est la même cause vue par l'autre face : les onglets conservent leur
état, donc la pile de `proches` garde la fiche ouverte.

**ET IL Y A PIRE — voir le retour 20.** Un onglet ne se démonte pas : **les
vingt-quatre écrans gardent donc leur état indéfiniment.** Un formulaire quitté
à moitié se retrouve à moitié rempli, une étape franchie reste franchie, une
erreur affichée reste affichée. La fermeture de compte en donne l'exemple le
plus net : on y revient bloqué au troisième temps, sans aucun moyen de
recommencer autrement qu'en tuant l'application.

Ce n'est donc pas seulement le retour qui est cassé — **c'est le cycle de vie de
tout ce qui n'est pas un onglet.**

### Pourquoi personne ne l'a vu

Trois choses ont conspiré :

- **Rien n'échoue.** Pas d'avertissement, pas d'erreur — une navigation qui
  aboutit, simplement pas là où on voulait.
- **La barre paraît juste.** Elle affiche cinq onglets et se comporte bien ; le
  défaut est dans ce qu'elle ne montre pas.
- **Aucun test ne peut le voir.** C'est exactement ce que disait déjà
  `proches/_layout.tsx` à propos de sa propre panne : « Aucun test ne pouvait le
  voir : la table des onglets est juste, les quatre écrans sont justes, **c'est
  leur assemblage qui ne l'était pas.** » Le même diagnostic vaut ici, un cran
  au-dessus.

### La correction

**Elle est structurelle, et elle ne se fait pas écran par écran.** Retoucher les
vingt-quatre retours un à un corrigerait vingt-quatre fois le même défaut, en
laissant la structure qui le produit.

La forme attendue : les cinq onglets dans leur propre groupe, et tout le reste
dans une pile au-dessus.

```
app/(app)/
  _layout.tsx          → Stack
  (onglets)/
    _layout.tsx        → Tabs, et il ne contient QUE les cinq
    accueil.tsx  dates.tsx  moi.tsx  reglages.tsx  proches/
  recharge.tsx  rappels.tsx  mouvements.tsx  …   ← empilés, plus des onglets
```

`back()` redevient alors un dépilement, et ramène d'où l'on vient — sans qu'il
faille toucher un seul des vingt-quatre écrans.

**Deux choses à vérifier en le faisant :**

- **`ecranEteint` et les drapeaux.** Plusieurs de ces écrans se ferment par
  drapeau ; le déplacement ne doit pas leur faire perdre leur garde.
- **Le retour 7 ne se règle pas tout seul.** Une fois la structure juste, la
  pile de `proches` gardera toujours son état — c'est le comportement normal
  d'un onglet. La question « revient-on à la liste ? » reste entière, mais elle
  redevient une question de conception au lieu d'un symptôme.

### Ce que ça veut dire pour le reste de la liste

**À faire avant les autres corrections de navigation.** Les retours 7 et 15C
n'ont pas de correction propre : ils disparaissent avec celle-ci, ou ils n'ont
pas été compris.

---

## 17 — « Aucun moyen enregistré », et aucun moyen d'en enregistrer un

**Statut :** cause identifiée. **Même défaut de conduite que le retour 15B**, et
c'est le troisième écran à faire ça — voir la synthèse en fin d'entrée.

### Ce qui a été vu

L'écran **Payment** annonce « No method saved — One will save itself on your
first purchase. » Et rien d'autre : **aucun bouton pour en ajouter un.**

### Le bouton existe, il est retiré

`apps/mobile/app/(app)/paiement.tsx:224` :

```tsx
{lu && proposables.length > 0 ? (
  ajoute ? ( …le formulaire… ) : (
    <Button variant="outline" onPress={() => setAjoute(true)}>{t.paiementAjouter}</Button>
  )
) : null}
```

`proposables` est `canauxProposables(canaux)`, c'est-à-dire les canaux de sorte
`mobile_money` servis par la plateforme (`apps/mobile/lib/paiement.ts:61`).
**Aucun canal servi ⇒ pas de bouton.**

Et c'est délibéré, avec sa justification écrite au-dessus :

> ON N'AJOUTE QUE CE QU'ON SAIT AJOUTER, et rien ne le dit mieux que l'absence
> du bouton. Sans opérateur servi, la plateforme n'a aucun canal mobile money :
> ouvrir le formulaire ferait choisir dans une liste vide, puis échouer à
> l'envoi.

**Le raisonnement est juste. La conclusion ne l'est pas.** « Rien ne le dit
mieux que l'absence du bouton » — sauf que l'absence d'un bouton ne dit rien du
tout. Elle se lit comme un écran inachevé, et c'est exactement ainsi qu'elle a
été lue.

### Et la phrase promet une porte qui n'existe pas

« One will save itself on your first purchase. »

Or **le premier achat est impossible** : le retour 15B établit que l'écran de
recharge ne propose rien tant que `achetable` est faux. On renvoie donc vers un
geste inatteignable.

**La boucle est fermée :** pas de moyen de paiement parce qu'il faut un premier
achat ; pas de premier achat parce que la voie d'achat est fermée. Et les deux
écrans se taisent.

### La cause commune, probablement unique

Les deux gardes lisent la même chose sous deux noms :

| Écran | Garde | Ce qu'elle exige |
|---|---|---|
| Recharge | `achetable = manuel && compte !== null` | drapeau `topup.manual` **et** un compte de collecte |
| Paiement | `proposables.length > 0` | au moins un canal `mobile_money` servi |

**Il est très probable que ce soit une seule configuration manquante sur la
sandbox** — les canaux de paiement et les comptes de collecte se règlent en
back-office. À vérifier avant d'écrire la moindre ligne : si la sandbox devait
être configurée, le défaut est là, et les deux écrans redeviennent normaux.

### Le motif qui se répète — trois écrans, la même conduite

C'est la troisième fois dans cette liste :

| Retour | Écran | Ce qui est caché | Justification écrite dans le code |
|---|---|---|---|
| 14 | En cours | les générations en échec | — |
| 15B | Recharge | tout le bloc d'achat | « ferait croire à une panne » |
| 17 | Paiement | le bouton d'ajout | « rien ne le dit mieux que l'absence du bouton » |

**Chacun a sa raison, et chacune se défend seule.** Mises bout à bout, elles
font une application qui retire ses fonctions sans jamais dire pourquoi — et
l'utilisateur, lui, ne lit pas trois justifications : il lit trois écrans
cassés.

**La règle à poser, et elle vaut au-delà de ces trois écrans :** une voie fermée
se DIT. Un écran qui retire son action doit expliquer ce qui manque, ou ne pas
être atteignable du tout. Le silence n'est jamais la troisième option — c'est
d'ailleurs déjà la règle que `_layout.tsx` applique aux onglets : « un onglet
qui mène à une page vide est pire qu'un onglet absent ».

### Ce qu'il y a à trancher

- **Vérifier la configuration sandbox d'abord** — canaux de paiement, comptes
  de collecte, drapeau `topup.manual`.
- **Si la voie est fermée à dessein** : les deux écrans doivent le dire, et
  « Recharger » comme « Paiement » ne devraient pas être proposés depuis « Moi ».
- **Si elle devait être ouverte** : rien à corriger dans ces écrans, et il reste
  malgré tout à décider ce qu'ils affichent le jour où un opérateur tombe.

---

## 18 — Les appareils connectés portent leur en-tête brut

**Statut :** cause identifiée. **Un des deux défauts a déjà été corrigé pour
iOS** et manque pour Android — la correction est écrite, il suffit de la
prolonger.

### Ce qui a été vu

L'écran **Security** liste trois sessions : `okhttp/4.9.2` (cet appareil) et
deux `curl/8.6.0`. Toutes les trois portent l'icône « **?** ».

Les deux `curl` sont vos propres appels en ligne de commande — ils sont à leur
place, et qu'ils se voient est plutôt une bonne chose. `okhttp/4.9.2`, en
revanche, **est le téléphone**.

### Pourquoi le nom est brut, et pourquoi ce n'est pas un oubli

`apps/mobile/app/(app)/securite.tsx:201`, le commentaire assume le choix :

> L'en-tête TEL QUEL, sans en tirer un nom d'appareil : il est déclaré et jamais
> vérifié — « un indice de reconnaissance pour la personne qui lit l'écran, pas
> une preuve ». En faire « iPhone de Valentine » serait une affirmation.

**Le principe est juste : on n'affirme pas ce qu'on ne vérifie pas.** Mais il ne
commande pas d'afficher la chaîne brute — il commande de ne pas inventer. Or
`okhttp/4.9.2` n'est un indice de reconnaissance pour personne : c'est le nom de
la bibliothèque HTTP d'Android, pas celui d'un appareil. On a évité
l'affirmation en renonçant à l'information.

### Le défaut certain : l'icône, et il est déjà connu

L'icône vient de `natureDeLAppareil(s.userAgent)`
(`apps/mobile/lib/securite.ts`), qui cherche trois familles de mots. `okhttp`
n'en contient aucun — ni `android`, ni `mobile`, ni un mot de bureau, ni
`cfnetwork`/`darwin`. La fonction rend donc `"inconnu"`, d'où le « ? ».

**Et cette panne a déjà été rencontrée et réparée — pour iOS.** Le commentaire
de la troisième passe le raconte :

> Une application iOS n'annonce jamais « iPhone » : c'est le navigateur qui le
> dit. […] Sans ces deux mots, la session ouverte depuis le téléphone qu'on
> tient portait l'icône « appareil inconnu », et **CHAQUE iPhone en production
> aurait fait pareil** : sur un écran qu'on ouvre pour retrouver SA ligne,
> c'était la seule qui ne se reconnaissait pas.

C'est mot pour mot ce qui se produit aujourd'hui sur Android. Le client HTTP par
défaut de React Native y est **OkHttp**, et il s'annonce `okhttp/<version>`. La
correction iOS a été faite sur le cas rencontré ; le cas jumeau n'a pas été
cherché.

**Correction immédiate :** ajouter `okhttp` (et `dalvik`, que certaines
versions envoient) à la passe des mots mobiles. Une ligne, et chaque Android
cesse d'être un appareil inconnu.

### La vraie correction : la matière existe déjà, et elle traverse le réseau

**L'application envoie déjà de quoi se nommer, à chaque requête.**
`apps/mobile/lib/client.ts:89` pose sept en-têtes sur tous les appels :

```
x-client-id, x-client-key, x-client-type,
x-app-version, x-app-build, x-app-os, x-app-env
```

`x-app-os` porte le système **et sa version**. Le serveur a donc déjà sous la
main de quoi écrire « Lehno Android 14 » au lieu de `okhttp/4.9.2`.

**Il ne s'en sert pas.** `apps/api/src/auth/auth.controller.ts:70` ne lit que
`@Headers("user-agent")`, et `security.service.ts` ne conserve que ce champ.

Et le principe du commentaire est **entièrement préservé** : `x-app-os` est
déclaré par le client, exactement comme l'en-tête d'agent. On ne gagne aucune
preuve — on gagne une forme lisible de la même déclaration. « Affirmer » et
« rendre lisible » ne sont pas la même chose.

### Ce qu'il y a à trancher

- **La ligne de repli.** Un appel `curl` n'enverra jamais `x-app-os`. Ces
  sessions-là doivent garder leur en-tête brut — c'est le seul indice
  disponible, et c'est d'ailleurs exactement ce qu'on veut lire pour une
  session qui ne vient pas de l'application.
- **Le champ au contrat.** `sessionSchema` ne porte que `userAgent`
  (`packages/contracts/src/me-security.ts:47`). Il faudra soit un champ de plus,
  soit un libellé composé au serveur — ce dernier évite au client de connaître
  la règle, et c'est la convention déjà suivie ailleurs (voir `url` sur le lien
  de collecte : « l'adresse complète, parce qu'elle appartient au serveur »).
- **Les sessions déjà ouvertes** n'ont pas ces en-têtes en base. Elles
  resteront brutes jusqu'à la prochaine connexion, et c'est acceptable — mais
  il faut le savoir avant de conclure que la correction n'a rien changé.

---

## 19 — L'export de données s'enregistre, et rien ne le traite jamais

**Statut :** cause certaine, de bout en bout. **Et la demande d'aujourd'hui a
verrouillé la fonction pour ce compte.**

### La question posée : y a-t-il une trace en base ?

**Oui.** `apps/api/src/me/data-export.service.ts`, `demander()` :

```ts
const ligne = await this.prisma.dataExportRequest.create({ data: { userId } });
```

Une ligne `data_export_request` existe, au statut `pending`. L'accusé « Request
received » ne ment pas : la demande a bien été reçue et enregistrée.

**C'est tout ce qui se produit.**

### Rien ne consomme cette ligne

`assembler()` — la fonction qui construit le document — **n'est appelée nulle
part.** Vérifié sur l'ensemble de l'API : les seules autres occurrences du mot
appartiennent à `studio/configuration.service.ts`, qui n'a aucun rapport.

Et il n'y a pas de travailleur ailleurs. L'ordonnanceur
(`apps/api/src/me/ordonnanceur.service.ts`) porte sept étapes dans son passage
quotidien :

```
déroulement · programmation · relance globale · relance par personne ·
activation · générations abandonnées · envoi
```

**Aucune ne touche aux exports.** Le rattrapage des dix minutes ne concerne que
les générations.

Conséquence : la ligne reste `pending` **indéfiniment**. Le fichier n'est jamais
assemblé, aucun courriel ne part, `completedAt` n'est jamais posé.

### Ce qui rend la chose particulière

`assembler()` n'est pas une ébauche. C'est **cent lignes écrites avec soin**,
surmontées du commentaire le plus long du fichier — quatre règles sur ce qui ne
doit jamais sortir du service, chacune justifiée : l'adresse d'un autre compte,
l'identité d'un contributeur, les jetons et secrets, les traces de sécurité.
Quelqu'un a pesé chaque champ de ce document.

**Et personne ne l'appelle.** Le travail difficile est fait ; c'est le fil qui
manque.

### Le piège : la fonction est maintenant morte pour ce compte

`demander()` refuse une seconde demande tant qu'une est `pending` :

```ts
if (enCours) throw new AppError("conflict", "an export is already being prepared");
```

Et l'écran en tire les conséquences — le bouton s'éteint pendant la préparation
(`donnees.tsx:109`, `disabled={… || !peutDemander(derniere)}`), avec un
commentaire qui explique pourquoi : « un bouton qui part pour revenir en erreur
dirait le contraire du refus qu'il reçoit ».

Les deux décisions sont justes séparément. Ensemble, et **avec un traitement qui
n'existe pas**, elles donnent : une demande qui ne s'achève jamais, donc un
bouton qui ne se rallume jamais.

**Vérifiable tout de suite :** sur la copie d'écran, « Request a copy » est déjà
grisé. Rouvrir l'écran devrait le montrer éteint, définitivement. Si c'est le
cas, c'est la confirmation.

**Il faudra donc, en plus de la correction, effacer les lignes `pending`
restées en base** — sans quoi les comptes d'essai gardent un bouton mort.

### Troisième couche : le back-office ne la voit pas non plus

Vérifié sur l'ensemble du back-office — `apps/admin`, `apps/api/src/admin` et
`packages/contracts/src/admin.ts` : **le mot `dataExport` n'y figure nulle
part.**

Le tableau de bord porte pourtant une file « À TRAITER », et sa raison d'être
est exactement celle-là : « c'est par ici qu'on entre dans le délai de grâce et
dans l'assistance, qui n'ont pas d'entrée au menu ». Elle est alimentée par
**deux sources seulement** (`apps/api/src/admin/dashboard.controller.ts:124`) :

- les comptes dont le délai de grâce est échu ;
- les demandes d'assistance sans réponse.

Les exports n'y sont pas, et n'ont aucun écran ailleurs.

**Donc non seulement rien ne traite la demande automatiquement, mais personne ne
peut la traiter à la main** — un administrateur n'a aucun moyen d'apprendre
qu'elle existe. Le seul endroit où elle se voit est la table en base.

C'est à verser au même chantier : une file qui attend une décision et que
l'outil d'exploitation ignore est une file qu'on découvre par une réclamation.

### Ce que ça engage

Cet écran exerce le **droit à la portabilité** — la politique de
confidentialité §8 le nomme, et la copie promet « dans les 24 heures ». Ce
n'est pas une commodité qu'on livre plus tard : c'est un engagement affiché à
l'utilisateur.

### Ce qu'il y a à faire

1. **Ajouter l'étape au passage quotidien** — ou un rattrapage plus fréquent :
   lire les `pending`, appeler `assembler()`, produire le fichier, l'envoyer,
   poser `completedAt` et le statut. La liste des sept étapes est le bon
   endroit, et sa forme (`[nom, etape]`) est faite pour qu'on en ajoute.
2. **Décider du transport.** « Par e-mail » est ce que la copie promet, mais un
   export complet peut être volumineux : pièce jointe ou lien signé à durée
   limitée ? Le second est plus sûr et demande un stockage — `stockage/` existe
   déjà.
3. **Traiter l'échec.** Si l'assemblage casse, la ligne doit passer en échec et
   non rester `pending` — sinon on recrée exactement le verrou ci-dessus.
4. **Purger les `pending` existants** avant de conclure que la correction
   marche.

---

## 20 — La fermeture de compte : bloquée au troisième temps, et l'écran ne se réinitialise jamais

**Statut :** quatre choses. **L'une d'elles agrandit considérablement le §16** —
ce n'est plus seulement le retour qui est cassé, c'est l'état de vingt-quatre
écrans qui ne se remet jamais à zéro.

### Ce qui a été vu

Ouvrir « Close my account ». Un code est demandé alors que rien n'a été rempli.
Le code n'arrive jamais. « Renvoyer » affiche le même accusé, toujours rien. Le
bouton reste gris, donc impossible d'avancer. Le retour ramène à l'accueil. Et
en rouvrant Réglages → fermeture, **on retombe au troisième temps, toujours
bloqué.**

### A — l'écran ne se réinitialise pas, et c'est le §16

`apps/mobile/app/(app)/fermeture.tsx:44` : `const [temps, setTemps] = useState(1)`.
L'étape est un état **local et non persisté**. Rouvrir l'écran devrait donc
toujours repartir du premier temps.

**Il ne se réinitialise pas parce qu'il ne se démonte jamais.** `fermeture` est
l'un des vingt-quatre écrans du dossier `(app)/` enregistrés comme onglets
(§16), et **un onglet conserve son état** : le composant reste monté, `temps`
reste à 3, et rouvrir l'écran ramène exactement où on en était.

**C'est une conséquence du §16 bien plus large que le retour cassé.** Tous ces
écrans gardent leur saisie indéfiniment : un formulaire quitté à moitié se
retrouve à moitié rempli, une étape franchie reste franchie, une erreur
affichée reste affichée. Personne ne peut recommencer quoi que ce soit sans
tuer l'application.

**À porter au §16** : ce n'est pas un défaut de plus, c'est la même cause, et
elle coûte plus cher qu'on ne l'avait estimé.

### B — le code n'est pas parti « à l'ouverture », mais l'écran le fait croire

Le code ne part que par `avance()`, quand on atteint le troisième temps
(`fermeture.tsx:89`). L'intention est écrite juste au-dessus :

> LE CODE PART QUAND ON ARRIVE AU TROISIÈME TEMPS, pas avant : le demander à
> l'ouverture enverrait un courrier à quelqu'un qui lisait seulement ce qu'il
> risque de perdre — et l'envoi est borné en débit, cinq par heure.

**La règle voulue est donc exactement celle que vous attendiez.** Aucun chemin
du code ne demande d'OTP au montage.

Ce qui s'est probablement passé : le premier passage a franchi les deux
premiers temps — deux appuis sur « Suivant », les temps 1 et 2 ne demandant
rien d'obligatoire — ce qui a déclenché l'envoi. Ensuite, par le défaut A,
**toute réouverture rouvre le troisième temps**, code déjà demandé. Vu de
l'appareil, cela ne se distingue pas d'un envoi à l'ouverture.

**Si la réinitialisation du §16 est corrigée et que le code part quand même au
montage, alors il y a un second défaut et il faudra le chercher.** En l'état, je
n'en vois pas la trace.

### C — le code n'est JAMAIS envoyé : `demanderCode` n'écrit à personne

**Cause certaine, et ce n'est ni la configuration ni la sandbox.**

`apps/api/src/me/account.service.ts:173`, la méthode entière :

```ts
async demanderCode(userId: string): Promise<{ expiresAt: Date; code: string }> {
  const user = await this.compteActif(userId);
  const { code, expiresAt } = await this.otp.issue(user.email, "account_deletion");
  return { code, expiresAt };
}
```

**Il n'y a pas d'envoi.** Le code est frappé, rendu au contrôleur — qui le jette
et répond `{ sent: true }`. Personne n'écrit jamais à la boîte.

La comparaison avec le chemin de connexion, qui fonctionne, est sans appel.
`apps/api/src/auth/auth.service.ts:108` :

```ts
const { code, expiresAt } = await this.otp.issue(input.email, "login");
…
const { subject, text } = otpEmail({ code, locale });
await this.mail.send({ to: input.email, subject, text, locale });   // ← absent côté suppression
```

Et `AccountService` **n'injecte aucun port de courrier** : son constructeur n'a
pas de `MAIL_PORT`. Le service ne peut donc pas envoyer — ce n'est pas un appel
oublié dans une branche, c'est une dépendance qui n'a jamais été câblée.

**Les commentaires, eux, affirment le contraire, aux deux bouts :**

- le service : « TROISIÈME TEMPS, première moitié : **le code par e-mail** […]
  c'est le même envoi vers la même boîte » ;
- le contrôleur : « Le code ne descend JAMAIS dans la réponse : **il part par
  e-mail**, et c'est tout l'intérêt du second facteur ».

Deux commentaires qui décrivent une intention juste, au-dessus d'un code qui ne
la tient pas. C'est exactement le piège que `generation.controller.ts` nomme
ailleurs dans ce dépôt : « Un commentaire ne décrit pas ce qu'on voulait
faire. »

**La configuration Resend de la sandbox est en ordre** — l'OTP de connexion à
l'admin arrive bien, par le chemin qui, lui, envoie. Il n'y a donc rien à
changer dans `.env.sandbox`, et `LEHNO_MAIL_CONSOLE` n'est pas en cause.

### La correction

Elle est courte, et tout ce qu'il faut existe déjà :

1. injecter `MAIL_PORT` dans `AccountService`, comme `AuthService` le fait ;
2. composer avec `otpEmail({ code, locale })` — le gabarit est déjà écrit et
   sert la connexion ;
3. lire la langue comme le fait `auth.service.ts` : le choix du compte d'abord
   (`user.uiLanguage`), puis la langue de l'appareil, le français en dernier.
   `compteActif` ne sélectionne pas encore `uiLanguage`, il faudra l'ajouter ;
4. **cesser de rendre le code depuis le service.** Une fois l'envoi posé,
   `demanderCode` n'a plus de raison de le retourner, et le contrôleur a écrit
   noir sur blanc pourquoi il ne doit jamais ressortir. Le laisser remonter est
   une arme chargée posée sur la table.

**Un test qui tombe sur l'état actuel** : `demanderCode` doit appeler le port de
courrier. Aucun ne le vérifie aujourd'hui — c'est ce qui a laissé passer la
chose.

### Ce que ça dit du reste

Ce chemin-ci est celui d'un **droit** — la suppression de son compte. Il était
inachevé sans que rien ne le signale : l'écran accuse réception, le serveur rend
`202`, et la seule façon de s'en apercevoir est de ne pas recevoir le courrier.

**À vérifier au même passage :** les autres chemins qui promettent un courriel
sans passer par `AuthService`. `reservationCodeEmail` existe dans les gabarits —
est-il appelé ? Le même défaut peut s'y trouver.

### D — aucune sortie quand le code n'arrive pas

`peutFermer` exige le pseudo exact **et** un code complet. Sans code, le bouton
reste gris, et il n'existe aucune autre voie : ni « je ne reçois pas le code »,
ni délai affiché, ni recours.

C'est le même motif que les §15B et §17 — **une voie fermée qui ne se dit pas**
— mais ici elle est plus grave : le geste engage un droit (la suppression du
compte), et la personne n'a aucun moyen d'aboutir ni de comprendre pourquoi.

**À trancher :** que propose l'écran quand le code n'arrive pas ? Au minimum,
dire que le courrier peut tarder, rappeler à quelle adresse il est parti, et
laisser une porte vers l'assistance.

---

## 21 — « Confirm » reste inactif tant qu'un souhait n'est pas tranché

**Statut :** cause certaine. **Quatrième occurrence du motif des voies fermées
muettes** (§15B, §17, §20D).

### Ce qui a été vu

La contribution de Remi, enfin trouvée : la date « Mar 31 » et le mot, tous
deux acceptés par leur interrupteur ; un souhait, « An evening out », avec
« Keep » et « Set aside » ; puis **« Confirm » en gris, qui ne répond pas**, et
« Set aside » en dessous, bien actif.

### La cause

`apps/mobile/app/(app)/valider.tsx:258` : `disabled={… || !pretAEnvoyer(c, saisie)}`,
et `apps/mobile/lib/sas.ts:131` tient en une ligne :

```ts
export function pretAEnvoyer(contribution: Submission, saisie: SaisieDuSas): boolean {
  return toutEstTranche(contribution.wishes, saisie.sorts);
}
```

**Tout souhait doit être tranché.** L'état initial est `sorts: {}`
(`valider.tsx:66`), donc tant qu'on n'a pas appuyé sur « Keep » ou « Set aside »
pour « An evening out », le bouton reste éteint.

Et la règle est juste : le contrat l'exige de son côté — « every submitted wish
must be decided » — parce qu'écarter un souhait par omission serait le pire des
défauts sur cet écran.

**Le bouton ne le dit simplement pas.**

### Pourquoi l'écran se lit comme cassé

Trois choses se conjuguent, et aucune n'est fautive seule :

1. **Deux éléments sur trois portent déjà une réponse.** La date et le mot
   s'ouvrent à « accepté » (`garderLaDate: true, garderLeMot: true`), et leur
   interrupteur le montre. Le souhait, lui, n'a pas de valeur par défaut — mais
   rien ne distingue visuellement « déjà répondu » de « attend une réponse ».
2. **Le geste du souhait ne ressemble pas à une obligation.** « Keep » et
   « Set aside » sont deux boutons de texte, de la même famille que les actions
   facultatives ailleurs dans l'application. Les interrupteurs, eux, se lisent
   comme des réglages déjà posés.
3. **Le refus global, lui, est actif.** « Set aside » en bas ne dépend que de
   `envoi` — donc l'écran propose de tout refuser mais pas d'accepter. C'est la
   lecture la plus décourageante possible : on croit que seul le refus
   fonctionne.

### Ce qu'il y a à faire

- **Dire ce qui manque.** Un mot sous le bouton — « tranchez chaque souhait » —
  ou le souhait non tranché mis en évidence. C'est la règle qu'on a déjà posée
  pour les §15B, §17 et §20D : **une voie fermée se dit.**
- **Distinguer ce qui attend de ce qui est répondu.** Si la date et le mot
  portent un défaut et le souhait non, l'écran doit le montrer — sinon
  l'asymétrie est invisible et c'est elle qui piège.
- **À vérifier :** `corpsDeDecision` retombe sur `"discarded"` pour un souhait
  sans sort (`sas.ts:120`). Ce repli n'est jamais atteint tant que
  `pretAEnvoyer` garde la porte — mais si l'on desserrait la garde, **on
  écarterait des souhaits en silence.** Les deux se tiennent : ne pas toucher à
  l'un sans regarder l'autre.

---

## Relevé au passage, non signalé — à confirmer

Deux choses visibles sur la copie d'écran de l'ajout d'un proche, que Valentine
n'a pas mentionnées et que je n'inscris donc pas comme retours :

- **L'en-tête passe sous la barre d'état.** « When you call them » est écrit
  par-dessus l'heure (« 9:14 PM ») et les icônes système. La zone sûre du haut
  n'est pas appliquée sur cet écran.
- **Le bas du formulaire passe sous la barre d'onglets.** « I don't know the
  year » est coupé en deux par la barre Home / Dates / People / Me / Settings.

Si ce sont des écarts, ils se corrigent ensemble : c'est le même oubli d'insets
aux deux bouts du même écran.
