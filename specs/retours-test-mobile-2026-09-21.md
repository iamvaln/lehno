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
