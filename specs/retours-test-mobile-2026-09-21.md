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

### A — la pastille contredit le centre

La pastille vient de `/me/home` ; la liste vient de `/me/notifications`. **Les
deux passent par le même prédicat**, et ce n'est pas un hasard — c'est une
panne déjà réparée une fois, et le commentaire de `home.service.ts` la raconte :

> la pastille comptait les lignes `email` et `push`, donc elle annonçait trois
> éléments à un centre qui n'en montrait qu'un.

Aujourd'hui `apps/api/src/me/notification.service.ts:42` définit
`perimetreDuCentre` — canal `in_app`, échéance nulle ou passée — et la liste
comme le compte s'en servent, le compte y ajoutant `readAt: null`. **Un « 5 »
signifie donc que cinq entrées existent que le centre devrait lister.**

Qu'il n'en montre aucune laisse une explication principale, et c'est celle que
`packages/contracts/src/me-notifications.ts` écrit deux fois, en haut du
fichier :

> Un type absent d'ici n'échoue pas à l'écriture, il échoue à la **LECTURE**,
> longtemps après, chez le client.

Si la base porte un type que `NOTIFICATION_TYPES` ne connaît pas, alors
`notificationsPageSchema.parse()` **jette côté mobile**
(`apps/mobile/app/(app)/notifications.tsx:46`) — l'écran ne rend rien — pendant
que la pastille, qui n'est qu'un entier dans `/me/home`, continue d'annoncer
cinq. Le symptôme décrit est exactement celui-là.

L'énumération a déjà manqué deux fois : les cinq `activation_*`, puis
`wish_reserved` et `wish_reservation_cancelled`. Les deux commentaires qui le
racontent sont encore dans le fichier.

**L'observation qui tranche, et elle est immédiate :** ouvrir le centre de
notifications et regarder ce qu'il affiche.

- **L'état vide dessiné** (« rien pour l'instant ») → les lignes ne sont pas
  dans le périmètre, et c'est le prédicat qu'il faut reprendre.
- **Un bandeau d'erreur, ou un écran qui ne finit pas de charger** → c'est la
  lecture qui casse, donc un type inconnu du contrat. Le journal du conteneur
  de l'API donnera lequel.

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
