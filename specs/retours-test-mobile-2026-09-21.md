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
