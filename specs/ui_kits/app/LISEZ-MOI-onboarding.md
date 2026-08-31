# Lehno — onboarding mobile, lot de développement

Le parcours d'entrée (§3.1 de la spec UX) prêt à être développé : cinq écrans,
leurs états, la copy des deux langues, les jetons et les composants dont ils
dépendent. Rien d'autre du produit n'est dans ce dossier — c'est volontaire.

Ouvrir `ui_kits/app/onboarding.html` : le bandeau du haut donne l'écran, l'état,
le thème, la langue, le modèle d'appareil et le système. Le bouton principal de
chaque écran enchaîne sur le suivant.

## Les écrans, dans l'ordre

| Écran | Fichier | États |
| --- | --- | --- |
| Ouverture | `ui_kits/app/SplashScreen.jsx` | nominal |
| Connexion | `ui_kits/app/ConnexionScreen.jsx` | nominal, erreur |
| Code reçu | `ui_kits/app/CodeScreen.jsx` | nominal, erreur, code expiré |
| Pseudo | `ui_kits/app/PseudoScreen.jsx` | nominal, pseudo pris |
| Bienvenue | `ui_kits/app/BienvenueScreen.jsx` | nominal |

Chaque état est une tâche : les six états non nominaux sont dessinés, pas à
inventer côté développement.

## Ce que le lot contient

- `ui_kits/app/` — les cinq écrans, le châssis d'appareil (décor de revue, il ne
  part pas en production) et `copy.js`, le dictionnaire FR/EN complet.
- `components/` — les six composants utilisés : `core/Button`, `core/Icon`,
  `forms/TextField`, `feedback/Banner`, `brand/Wordmark`, `brand/Illustration`.
- `tokens/` + `styles.css` — couleurs, typographie, espacement, formes, durées.
  Un écran ne porte aucune valeur en dur : tout passe par un jeton.
- `assets/` — logotypes et les deux illustrations du parcours, en clair et en
  sombre.
- `react-native/` — le pilote React Native : `tokens.js`, `Button.js`, et les
  deux notes qui fixent les conventions (nommage, structure, décisions natives).

## Ce qui est arrêté, et qu'il ne faut pas re-trancher

- **L'ouverture est une animation, pas une image.** Le logotype s'écrit trait
  par trait, la teinte arrive après. `prefers-reduced-motion` la coupe.
- **Le logotype seul sur la connexion et l'ouverture** — l'icône identifie
  l'application au lancement du système, pas à l'intérieur.
- **Le code a deux horloges** : sa validité (dix minutes) et le délai avant de
  pouvoir en redemander un. Elles ne se confondent pas.
- **Le pseudo pris est un état du champ**, pas une page d'erreur.
- **Cibles tactiles : 44 px partout**, y compris la flèche de retour et les
  petits boutons de texte. `--touch-min` porte la valeur.
- **Tout tient sur un iPhone SE** dans les deux langues, sans défilement, sur
  les cinq écrans. L'anglais est le cas long : c'est lui qui casse les libellés.

## Les jetons de police

`tokens/fonts.css` sert Fraunces et Karla depuis Google Fonts. Pour React
Native, il faut les binaires : huit instances statiques (Fraunces 400/500 +
italiques, Karla 400/500/600/700) avec les axes de marque cuits, ou les sources
variables que le dépôt cuira. `react-native/tokens.js` attend ces huit noms.
C'est le seul point bloquant du lot.

## Le reste du produit

Le parcours complet (28 écrans, la planche de revue et le prototype cliquable)
vit dans le projet de design, pas ici. Ce dossier suit le parcours d'entrée :
si un jeton ou un composant change là-bas, il change ici.
