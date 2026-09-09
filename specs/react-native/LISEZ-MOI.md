# Lehno — pilote de port React Native

**Trois fichiers, pas un kit.** Le but est d'établir une convention de style que
je réplique ensuite sur les 50+ fichiers restants — et de vérifier tôt que le
rendu tient. Si la convention vous va, le reste suit mécaniquement.

| Fichier | Ce qu'il établit |
|---|---|
| `tokens.js` | Les valeurs, à l'identique du CSS. La seule partie qui traverse sans réécriture |
| `Button.js` | La primitive avec ses états — le survol disparaît, la pression prend sa place |
| `EventCard.js` | La brique la plus réutilisée : bordure + fond, jamais d'ombre |
| `AccueilScreen.js` | Un écran complet, avec défilement, zone sûre et tirer-pour-rafraîchir |

## Ce que le port change, et pourquoi

**Le thème se transporte, il ne s'hérite pas.** RN n'a pas de cascade : `theme(nuit)`
se passe en argument. C'est pour ça que chaque composant reçoit `nuit` — une
classe sur `<body>` n'a pas d'équivalent.

**`border: "1px solid …"` devient deux propriétés.** Le raccourci est ignoré en
silence par RN : le contour disparaît sans erreur. Il y en avait 62 dans le kit.

**`display: "grid"` n'existe pas.** 51 occurrences à repenser en flex — les
grilles à colonnes égales passent en `flexDirection: "row"` + `flex: 1`, celles
qui se replient en `flexWrap`.

**`aria-*` devient `accessibilityRole` / `Label` / `State`.** Le focus clavier
n'existe pas ; le lecteur d'écran le remplace, et il ne lit que ces attributs.

**`minWidth: 0` devient `flexShrink: 1`.** C'est ce qui empêche un nom long de
pousser le décompte hors de la carte.

**Sans effet, à retirer** : `cursor`, `transition`, `boxSizing`, `outline`,
`whiteSpace`, `filter`, `position: sticky|fixed` — environ 190 occurrences.
`overflow: hidden` fonctionne, mais ne rogne pas les enfants sur Android.

## Les polices

`tokens.js` nomme des **instances statiques** (`Fraunces-Medium`, non un axe de
graisse). C'est délibéré : Fraunces est variable, son support l'est aussi sur
Android, et les réglages de marque — SOFT 40, WONK 1 — sont **cuits dans le
.ttf**. Les huit instances existent depuis le lot 0 : Fraunces 400/500 et leurs
italiques, Karla 400/500/600/700, licence comprise. Les noms de `tokens.js`
correspondent aux fichiers.

## Ce que le kit web ne peut pas décider

Ces choix sont natifs et n'ont pas d'équivalent dans une planche :

- **Pousser ou monter** : la préparation, la saisie de note, la feuille payante
- **L'en-tête au défilement** : fixe, ou titre qui se replie
- **Le clavier** : ce qui remonte, où se pose le bouton plein quand il est ouvert
  (critique pour la note, le formulaire d'événement, le code)
- **La zone sûre** : ce qui passe sous l'encoche, ce qui passe sous la barre
- **Le tirer-pour-rafraîchir** : sur quels écrans (ici : oui sur l'accueil, non
  sur les formulaires)
- **L'attente de génération** : « quitter sans perdre » est un comportement, pas
  une image

## Dépendance

`AccueilScreen` utilise `react-native-safe-area-context` — la seule dépendance
externe du pilote. Les insets sont des valeurs du système : les deviner produit
des marges fausses sur un modèle et justes sur un autre.
