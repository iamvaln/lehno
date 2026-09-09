# Lehno — l'application mobile, lot de développement

Tous les écrans de l'application, leurs états, la copy des deux langues, les
composants, les jetons et le pilote React Native. Sorti le 27 août 2026.

**Ouvrir `ui_kits/app/prototype.html`.** Le rail de gauche donne les écrans, le
rail de droite les états de l'écran courant, et le bandeau du haut : thème,
langue, modèle d'appareil (SE · Courant · Grand), système, notation du décompte,
et **profil de drapeaux**. Les écrans naviguent entre eux — c'est un prototype
cliquable, pas une planche de vignettes. `ui_kits/app/index.html` est la seconde
vue : tous les écrans côte à côte, pour parcourir d'un coup d'œil.

Références : `ux-app-mobile-lehno.md` pour les sections §3.x, `design-system-lehno.md`
pour les jetons, `ton-et-ecriture-lehno.md` pour la copy, `spec-technique-lehno.md`
§6 pour les drapeaux, `brief-port-react-native-lehno.md` pour le portage.

## Les trois profils de drapeaux

Le sélecteur **Drapeaux** existe parce qu'un drapeau naît éteint : ce que verront
les premiers utilisateurs n'est pas ce qui est dessiné ici en entier.

| Profil | Ce qu'il montre |
| --- | --- |
| **Tout allumé** | L'application complète. C'est l'environnement d'intégration, pas la production. |
| **Lancement** | La configuration décidée : anniversaires seuls, versement manuel, collecte ouverte. Tout le reste éteint. |
| **Crédits éteints** | Le cas qui piège : l'achat fermé, les générations restent — et deviennent gratuites. |

Les écrans qu'un profil éteint **sortent du rail** : rien n'y mène, pas même
l'outil de revue. Les surfaces publiques se filtrent page par page (§3.12 garde
« Une collecte » quand le Mur et la wishlist sont fermés).

## Ce que chaque drapeau retire — et ce qui prend la place

- **`events.other`** — §3.6 perd le choix du type ; ce qu'il disait passe dans la
  barre (« Nouvel anniversaire ») et l'année disparaît. L'accueil, la liste et le
  calendrier ne montrent plus que des anniversaires, d'un seul filtre.
- **`topup.provider`** — §3.9 n'a plus de paliers, de moyens de paiement ni
  d'attente opérateur : le solde, le versement manuel, les mouvements. §3.25 sort.
- **`credits`** — l'achat s'en va, **les générations restent et deviennent
  gratuites**. Aucun prix, aucun solde, aucune feuille de coût nulle part :
  §3.7 (les quatre écrans), §3.21 et §3.29 sont muets sur l'argent.
- **`generation.*`** — la fiche perd « Préparer » et « Ses portraits » : « Ajouter
  une note » devient l'action principale. La carte d'échéance passe à une action,
  « Noter une idée ». §3.21 perd son bloc et gagne un geste en pied. §3.16 ne
  garde que les natures allumées, et se replie sur son état vide si aucune.
- **`wishlist` / `wishlist.own` / `wall` / `wishes` / `reservation`** — les cinq
  sections de **Moi** dépendent d'un drapeau. Toutes fermées, **l'onglet
  disparaît** : la barre passe à quatre, et l'identité (nom, adresse publique,
  accès au profil) remonte en tête des Réglages.
- **`collect`** — ouvert au lancement : « Faire compléter » reste sur la fiche,
  §3.20, §3.8 et la page publique de collecte avec.
- **`referral`** — la ligne d'invitation quitte les Réglages.

La cloche rassemble cinq natures et reste crédible à trois : un intertitre de
journée ne survit pas à son contenu.

## Ce qui est arrêté, et qu'il ne faut pas re-trancher

**Navigation et rythme**

- Cinq onglets, traduisibles, et la barre tient de trois à cinq sans trou.
- Un écran de consultation ne défile pas : l'accueil et Moi se remplissent à la
  hauteur **mesurée** — les rangs de lignes se retirent d'abord, puis une carte
  (deux au minimum sur SE), et « Voir plus » porte le compte de ce qui sort.
- Dates et Réglages se parcourent, donc ils défilent.
- `PhoneFrame` pose `--ry-haut`, `--ry-titre`, `--ry-bloc`, `--ry-item` et les
  resserre sur SE : c'est ce qui permet au même code de respirer sur un grand
  modèle et de tenir sur un petit.
- Cibles tactiles : 44 px partout, liens de texte compris. `--touch-min`.

**Ce qui se dit, et comment**

- La copy vient du dictionnaire (`ui_kits/app/copy.js`), FR et EN complets. Aucun
  libellé en dur dans un écran, aucune clé absente d'une langue.
- Le genre d'un tiers n'a pas de champ, et la copy n'en a jamais besoin.
- Une parole en italique vient d'une personne : elle ne s'affiche que si la
  donnée en porte une, et jamais sur ce qu'on demande pour soi.
- Précisions, prix, lien, état, décompte : tout vient de l'objet touché, jamais
  du gabarit. Un « où le trouver » disparaît quand l'objet n'en a pas.

**Les gestes**

- Aucun geste muet : chaque bouton mène à un écran ou pose un accusé.
- Rien ne se paie en silence et rien ne se repaie : le coût s'annonce sur place,
  passe par la feuille de confirmation, et ce qui est produit se relit.
- Le partage passe par l'aperçu : on ne diffuse pas une page qu'on n'a pas vue.
- La création est un geste explicite : un souhait neuf, une fiche neuve, une
  wishlist neuve s'ouvrent vierges.
- Une date se pose toujours dans le futur ; l'année est celle de la prochaine
  occurrence.
- Un souhait sait de qui il est : ce que je demande peut devenir public, une idée
  notée **pour** quelqu'un n'a pas de visibilité du tout.
- Un souhait déjà offert ne se modifie plus.

**Interdits**

Pas de bouton grisé, pas de « bientôt », pas de renvoi vers un écran vide, pas de
titre de section sans contenu, pas d'espace laissé tel quel.

## Ce que le lot contient

- `ui_kits/app/` — les écrans, `copy.js` (dictionnaire + données d'aperçu :
  `PROCHES`, `MES_LISTES`, `SOUHAITS_PROCHE`, `MES_DATES`, `MOUVEMENTS`), les deux
  vues de revue, et `A-COMPLETER.md`. `PhoneFrame` et `AppHeader` sont le décor de
  revue : ils ne partent pas en production.
- `components/` — sept familles, chacune avec son `.jsx`, son `.d.ts` et sa note
  d'intention `.prompt.md`.
- `tokens/` + `styles.css` — couleurs, typographie, espacement, formes, durées, en
  trois formats. Aucun écran ne porte de valeur de marque en dur.
- `assets/brand/` — logotypes et icônes. Les illustrations des états vides sont
  dessinées dans `components/brand/Illustration.jsx`.
- `react-native/` — `tokens.js`, `Button.js`, `TextField.js` et `LISEZ-MOI.md`,
  qui fixe les conventions pour les écrans restants.

## Numérotation

`ux-app-mobile-lehno.md` s'arrête à **§3.29 Mes listes de souhaits**. Deux écrans
n'y sont pas encore et prennent les numéros suivants, **à y reporter** :

| Écran | Numéro | Où l'écrire |
| --- | --- | --- |
| Maintenance | 3.30 | après §3.29 |
| Mes données | 3.31 | idem |

L'écran « Compte fermé » n'est pas numéroté : c'est l'issue de la fermeture, hors
navigation.

## Ce qui reste à faire

- **§3.29** : l'état « aucune occasion à moi », et la liste dont l'occasion est
  passée (elle s'archive et cesse d'accepter des réservations).
- **À trancher avec le backend** : `referral` allumé pendant que `credits` est
  éteint promet 2 crédits qui n'achètent rien. Dépendance à ajouter au registre,
  ou promesse qui tient parce que les crédits garderont leur valeur.
- **`prefers-reduced-motion`** n'est traité que sur la maintenance ; à étendre aux
  transitions des feuilles et du calendrier.
