# Lehno — Brief du port React Native

Ce brief fait suite au pilote de port (la dernière archive pour le react navitve : `tokens.js`,
`Button.js`, `EventCard.js`, `AccueilScreen.js`). **La convention du pilote est
retenue** — le reste peut suivre mécaniquement. Ce document ne demande donc pas
un nouveau kit : il demande les trois choses que le port ne peut pas produire
tout seul, et signale ce qu'il ne faut surtout pas fournir.

---

## 1. Ce qui est acquis, et n'est plus à discuter

Le pilote établit la bonne convention, et elle est adoptée telle quelle :

- `Pressable` + `StyleSheet.create`, le survol disparaît, la pression le remplace
- le thème se transporte en argument, il ne s'hérite pas
- `border` en raccourci → `borderWidth` + `borderColor` séparés
- `minWidth: 0` → `flexShrink: 1`
- `aria-*` → `accessibilityRole` / `accessibilityLabel` / `accessibilityState`
- `ScrollView` + `useSafeAreaInsets` + `RefreshControl`, le rembourrage sur
  `contentContainerStyle` et non sur le `ScrollView`

Rien de tout cela n'est à refaire ni à rediscuter.

---

## 2. Les polices — la seule demande bloquante

`tokens.js` nomme déjà des instances statiques (`Fraunces-Medium`,
`Karla-SemiBold`). Les noms attendent leurs fichiers. Sans eux, React Native
retombe sur la police système et l'identité tombe avec elle.

Le sous-ensemble `.fraunces-subset.b64.txt` livré avec l'identité visuelle ne
convient pas : c'est un WOFF2 de 6 Ko, taillé pour le logotype d'une page HTML.
Ni le format ni la couverture de glyphes ne tiennent pour une application.

### 2.1 Ce qu'il faut — liste exacte

Les graisses ci-dessous sont **relevées dans le code**, pas supposées : elles
sont celles que les 22 primitives et les 35 écrans emploient réellement.

**Fraunces** — quatre fichiers

| Fichier attendu | Graisse | Style | Où |
|---|---|---|---|
| `Fraunces-Regular.ttf` | 400 | romain | décomptes, titres de vue |
| `Fraunces-Medium.ttf` | 500 | romain | noms de personnes, titres de carte |
| `Fraunces-Italic.ttf` | 400 | italique | `Quote` — les citations |
| `Fraunces-MediumItalic.ttf` | 500 | italique | la signature du portrait |

**Karla** — quatre fichiers

| Fichier attendu | Graisse | Style |
|---|---|---|
| `Karla-Regular.ttf` | 400 | romain |
| `Karla-Medium.ttf` | 500 | romain |
| `Karla-SemiBold.ttf` | 600 | romain |
| `Karla-Bold.ttf` | 700 | romain |

**Huit fichiers en tout.** Les noms de fichiers doivent correspondre au mot près
à ceux de `tokens.js` : React Native ne résout pas les familles par graisse, il
charge une police par nom.

### 2.2 Les trois contraintes de fabrication

**L'instance de marque doit être cuite dans le fichier.** Fraunces est une
variable, et la marque en emploie une instance précise — `SOFT 40, WONK 1`,
appliquée dans les 21 endroits où Fraunces paraît. Ces axes doivent être figés
dans le `.ttf` : `fontVariationSettings` n'existe pas en React Native, et le
support des variables reste irrégulier sur Android.

**La taille optique.** L'application emploie Fraunces entre 18 et 38 px. **Une
seule coupe suffit, à `opsz` ≈ 24.** Le portrait généré (`PortraitImage`) monte
beaucoup plus haut : si une seconde coupe est facile à produire, `opsz` ≈ 72
l'améliorerait — mais ce n'est pas bloquant, et cela ne concerne qu'un écran.

**Format `.ttf` statique.** Pas de WOFF2, pas de variable, pas de sous-ensemble :
`expo-font` charge des `.ttf` ou des `.otf` complets, et l'application a besoin
du latin étendu entier (les prénoms et les notes ne se limitent pas à l'ASCII).

### 2.3 La graisse à ne PAS fournir

`--font-body-light` (Karla 300) est déclarée dans les jetons mais **employée
nulle part** dans les composants ni dans les écrans. Aucune italique de Karla
n'est employée non plus. Les fournir alourdirait le paquet sans rien servir.

### 2.4 La licence

Confirmer que les instances statiques dérivées peuvent être **embarquées dans
une application publiée sur l'App Store et Google Play**. Si la licence réserve
un nom de police, indiquer sous quel nom l'instance modifiée doit être publiée —
les noms de fichiers ci-dessus s'ajusteront en conséquence.

### 2.5 Une porte de sortie, si les binaires sont difficiles à produire

Si la fabrication des huit instances pose problème, **les sources variables
suffisent** : `Fraunces[SOFT,WONK,opsz,wght].ttf` et la Karla variable. Les
instances se cuisent ensuite depuis le dépôt avec `fonttools varLib.instancer`,
sans rien attendre de personne. Dans ce cas, la seule chose encore nécessaire
est le point 2.4 — la licence.

---

## 3. Les décisions natives — à trancher, pas à produire

Ces choix n'ont aucun équivalent dans une planche : le kit web montrait des
vues, pas un système. Aucun fichier n'est attendu ici, seulement des réponses.

Pour que ce soit rapide, chaque ligne porte **une proposition**. Un « oui »
suffit ; un désaccord se dit en une ligne.

### 3.1 Pousser ou monter

| Écran | Proposition | Pourquoi |
|---|---|---|
| Fiche d'un proche | **pousse** | on y séjourne, on y revient |
| Préparation | **pousse** | c'est un séjour, pas une interruption |
| Saisie d'une note | **monte** | s'ouvre depuis partout, se referme vite |
| Formulaire d'événement | **monte** | même raison |
| Feuille d'action payante | **monte, feuille basse** | doit laisser voir ce qu'elle engage |
| Recherche | **monte, plein écran** | le clavier prend l'écran de toute façon |
| Centre de notifications | **pousse** depuis l'en-tête | |
| Détail d'un souhait, d'une occasion | **pousse** | |
| Génération et attente | **plein écran, quittable** | « quitter sans perdre » est une promesse de la spec ; on ressort par *Reprises* |

### 3.2 L'en-tête au défilement

Proposition : **titre qui se replie** sur les écrans de liste (accueil, dates,
proches, notifications), **fixe** partout ailleurs. À confirmer ou corriger.

### 3.3 Le clavier

Trois écrans en dépendent vraiment — la saisie de note, le formulaire
d'événement, la saisie du code.

Proposition : le contenu remonte, et **le bouton plein se colle au-dessus du
clavier** plutôt que de rester au bas de la page. Pour la saisie du code, le
clavier s'ouvre seul à l'arrivée sur l'écran.

### 3.4 La zone sûre

Proposition : `insets.top` consommé par l'en-tête, `insets.bottom` ajouté au bas
du contenu défilant **et** sous la barre d'onglets. Rien ne passe sous l'encoche.
Confirmer qu'aucun écran ne doit déborder volontairement — le portrait, peut-être ?

### 3.5 Le tirer-pour-rafraîchir

Proposition : **oui** sur accueil, dates, proches, à valider, notifications.
**Jamais** sur un formulaire — un geste qui ne recharge rien apprend qu'il ne
sert à rien.

### 3.6 Une valeur à confirmer

Le pilote fixe la cible tactile du bouton à **48 pt** (`touchMin + 4`), en la
commentant « la cible mobile de la charte ». Or `spacing.ts` dit **44**, et le
bouton web mobile fait 44. L'un des deux est faux. Lequel ?

---

## 4. Les corrections à appliquer au reste du port

Le pilote porte huit défauts. Ils sont sans gravité sur trois fichiers, mais ils
se dupliqueraient cinquante fois si la convention partait telle quelle.

**`Button`**
1. `borderWidth: StyleSheet.hairlineWidth * 2` rend 0,67 pt sur un écran 3x et
   1 pt sur un 2x. La charte dit 1 px. Mettre `1`.
2. La variante `destructive` a le même fond pressé que son fond au repos :
   **aucun retour au doigt**, alors que la pression est le seul retour qui reste.
   Le web s'en sortait par `filter: brightness(0.9)`, absent de React Native.
   Il faut une valeur pressée explicite.
3. L'icône est passée comme nœud : elle ne prend plus la couleur du rang. Le web
   l'héritait par `currentColor`. La couleur doit être injectée.
4. `numberOfLines={1}` tronque les libellés. Le châssis iPhone SE existait pour
   **révéler** les libellés trop longs, pas pour les cacher — d'autant que
   l'anglais les allonge d'un tiers.

**`EventCard`**

5. La copie du décompte est cuite dans le composant (`"J−"`, `" day"` / `" days"`).
   La règle du projet est que chaque langue s'écrit **en entier** dans `copy.js` :
   c'est exactement le recollage de morceaux que la spec 3.2 interdit.
6. `enAvant` ne change que le fond. La spec veut **deux actions visibles** sur la
   carte la plus imminente : *préparer* et *marquer envoyé*.

**`AccueilScreen`**

7. `key={e.nom}` — deux proches homonymes, ou deux échéances d'une même personne,
   cassent la liste. Il faut un identifiant.
8. **La phrase d'état de la spec 3.2 a disparu.** Le kit web calculait
   `phraseEtat()` avec ses variantes singulier / pluriel écrites en entier dans
   les deux langues ; le port lit un `t.accueilResume` plat. C'est la logique la
   plus soignée du kit web, et c'est celle qui saute.
9. Ni état vide ni état de chargement, alors que la spec en demande **deux
   distincts** sur l'accueil : premier lancement, et rien d'imminent.
10. `RefreshControl tintColor` n'agit que sur iOS ; Android veut `colors={[…]}`.
11. Tailles en dur hors jetons : 27, 18, 22, 12.

---

## 5. Ce qu'il ne faut PAS fournir

**`tokens.js` ne rejoindra pas le dépôt.** C'est une recopie à la main de
`packages/tokens`, et elle a déjà divergé : elle rend le gris de mention à
`#9C97A8`, soit **2,392:1 sur le lilas** et 2,836:1 sur le papier. Le dépôt a
corrigé cette valeur à `#6B6579` — 4,708:1 et 5,581:1 — et `couleurs.test.ts`
fait respecter le seuil de 4,5:1 sur ces deux fonds précisément.

Le fichier sera **dérivé** de `packages/tokens`, pas recopié : la divergence
devient alors impossible, et les tests de contraste couvrent le natif sans
travail supplémentaire. C'est la *forme* du pilote qui est reprise — objet JS,
thème en argument, interlignage absolu — pas ses valeurs.

Trois autres choses sont déjà réglées et n'appellent aucune livraison :

- **les icônes** — `lucide-react-native` porte les mêmes noms que l'enveloppe web ;
- **les illustrations** — déjà des SVG plats, lisibles par `react-native-svg` ;
- **l'icône d'application et l'écran de lancement** — déjà dans `images/`
  (iOS, Android, adaptive, maskable).

---

## 6. Deux fichiers à remettre à jour

`ui_kits/app/README.md` et `ui_kits/app/A-COMPLETER.md` décrivent l'état du kit à
**six écrans**. Trente-cinq ont été livrés depuis. En l'état, les deux fichiers
induisent en erreur quiconque ouvre le kit — `A-COMPLETER.md` réclame notamment
des écrans qui existent déjà.
