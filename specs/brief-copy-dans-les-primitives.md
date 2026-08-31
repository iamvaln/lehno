# Lehno — Brief : la copy qui vit encore dans les primitives

Relevé pendant le port React Native, sur l'export du 25 août
(`Visual identity for Lehno.zip`). **Dix primitives du produit écrivent des
chaînes visibles dans leur code**, alors que la règle du kit l'interdit :

> *Toute la copy FR / EN vit dans `copy.js` et descend par la prop `t`. **Aucune
> chaîne dans un composant** : les règles de pluriel diffèrent d'une langue à
> l'autre — le zéro prend le singulier en français, le pluriel en anglais — et
> une chaîne écrite dans un composant ne peut pas atteindre le dictionnaire.*
>
> — `ui_kits/app/README.md`

Le port a dû sortir ces chaînes pour avancer. Elles sont donc corrigées **d'un
seul côté**, et c'est ce déséquilibre qui motive cette note : sans la même passe
en amont, le web et le natif diront bientôt des choses différentes.

Le précédent existe déjà. Le pilote React Native a corrigé le décompte dans son
`EventCard.js` — « la règle du projet est que chaque langue s'écrit en entier
dans le dictionnaire » — mais `components/content/EventCard.jsx`, la source,
écrit toujours *Préparer* et *Marquer envoyé* en dur.

---

## 1. Le relevé

### Ce que l'utilisateur lit

| Fichier | Chaînes | Pourquoi ça se voit |
|---|---|---|
| `content/Countdown.jsx` | `"aujourd'hui"`, `"today"`, `J−{n}`, `{n} day{s}` | Le décompte est l'élément le plus lu de l'accueil |
| `content/CategoryTag.jsx` | `"Goût"`, `"Idée cadeau"`, `"No-go"`, `"Souvenir"`, `"À classer"` | Table complète, **français seulement** — en anglais, les cinq restent en français |
| `content/CreditIndicator.jsx` | `"crédit"`, `"crédits"`, `"1 crédit"`, `"il vous en reste "` | Paraît à **chaque action payante** |
| `content/EventCard.jsx` | `"Préparer"`, `"Marquer envoyé"` | Les deux actions de la carte la plus imminente |
| `feedback/LoadingState.jsx` | `"Lehno écrit"` + le texte d'attente complet, en repli | L'attente de génération, écran soigné s'il en est |
| `feedback/PaidActionSheet.jsx` | `"Coût de l'action"`, `"1 crédit"`, `" crédits"` | La feuille qui engage une dépense |
| `feedback/OfflineBanner.jsx` | Les trois phrases complètes, avec accord du pluriel | S'affiche dès que le réseau manque |
| `navigation/TabBar.jsx` | `DEFAULT_TABS` : `"Accueil"`, `"Dates"`, `"Proches"`, `"Moi"` | Les quatre onglets, visibles en permanence |

### Ce que le lecteur d'écran annonce

Moins visible, et c'est ce qui le rend gênant : ces libellés restent en français
pour quelqu'un qui a mis l'application en anglais.

| Fichier | Chaîne |
|---|---|
| `feedback/Banner.jsx` | `aria-label="Fermer"` |
| `feedback/Toast.jsx` | `aria-label="Fermer"` |
| `content/CategoryTag.jsx` | `aria-label={"Reclasser — actuellement : " + libelle}` |

### En dehors du produit

Le back-office porte les mêmes — `admin/Topbar.jsx` (`"Sections"`, `"Thème"`,
`"Compte"`), `admin/Breadcrumb.jsx`, `admin/AuditTrail.jsx`. Ils ne bloquent pas
le port mobile ; ils sont signalés parce que la cause est la même.

---

## 2. Trois raisons, au-delà de la règle

**Le pluriel ne s'accorde pas pareil.** `cout === 1 ? "1 crédit" : cout + " crédits"`
fonctionne en français et casse ailleurs — l'anglais met le zéro au pluriel, et
d'autres langues ont trois formes. La règle vaut mieux que sa formule.

**Une chaîne composée n'est pas traduisible.** `"il vous en reste " + solde`
suppose que la phrase se coupe au même endroit dans toutes les langues. Le kit
le dit ailleurs, à propos de la phrase d'accueil : *« Pas de recollage de
morceaux. »*

**Un repli est une chaîne cachée.** `{titre || "Lehno écrit"}` a l'air d'un défaut
aimable, mais c'est ce repli qui s'affichera partout où l'appelant ne passe rien
— donc, en pratique, souvent. `LoadingState` en porte deux autres au même titre,
`"Chargement"` et `"Envoi en cours"`.

---

## 3. Ce que la correction demande

La forme est la même partout : **le libellé entre par une prop, le composant ne
le fabrique jamais.**

```jsx
// avant
<Countdown days={3} locale="fr" />          // le composant écrit « J−3 »

// après
<Countdown label={t.decompte(3)} today={false} />
```

Pour les cinq catégories et les quatre onglets, le composant garde ses **clés**
(`gout`, `idee`, `nogo`, `souvenir`, `aclasser` ; `accueil`, `dates`, `proches`,
`moi`) et reçoit les libellés — les clés sont de la structure, pas de la copy.

Les `aria-label` suivent la même règle : ce sont des phrases, elles viennent du
dictionnaire.

Pour `LoadingState`, retirer les replis plutôt que les traduire : un composant
qui ne peut pas s'afficher sans son texte oblige l'appelant à le fournir, et
c'est exactement ce qu'on veut.

**Le contrôle est mécanique**, comme celui du genre :

```
grep -nE '"[^"]{3,}"' components/*/*.jsx | grep -vE 'var\(|px|em|%|flex|none|center'
```

---

## 4. Ce que le port a déjà fait de son côté

Les six primitives de contenu portées en React Native prennent toutes leurs
libellés en prop. Deux points s'y sont ajoutés, qui vaudraient aussi pour le web :

**Les guillemets sont de la copy.** `content/Quote.jsx` pose `« … »`,
espaces insécables comprises. L'anglais ne prend pas ces guillemets-là. Ils
arrivent donc du dictionnaire, comme le reste.

**La couleur d'une icône ne s'hérite pas.** Sans rapport avec la copy, mais
relevé au même endroit : `currentColor` n'existe pas en React Native, et une
icône non teintée reste noire dans un bouton violet. Le port injecte la couleur ;
rien à changer côté web, où l'héritage fonctionne.
