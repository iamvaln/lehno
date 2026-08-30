# Construire l'application — Android et iOS

## Pourquoi EAS et pas une build locale

**iOS** demande Xcode, un certificat et un profil de provisionnement. C'est
faisable sur un Mac, mais la signature est le morceau qui coûte des journées, et
elle se refait à chaque renouvellement.

**Android** demande Android Studio et un émulateur — or l'émulateur fait planter
la machine de développement. Le travail se fera donc **sur un téléphone réel**,
ce qui exige de toute façon une build installable.

EAS tient la signature des deux côtés, et c'est le même outil qui déposera dans
les magasins le jour venu.

---

## Ce qu'on ne reconstruit presque jamais

**Une build de développement s'installe UNE FOIS.** Ensuite le JavaScript se
recharge par le réseau, comme avec Expo Go : `expo start` reste le cycle
quotidien.

On ne reconstruit que lorsqu'une dépendance **native** change. OneSignal en sera
une — une fois. C'est le point qu'on oublie en croyant qu'adopter EAS veut dire
reconstruire à chaque modification.

---

## Les trois profils

**`development`** — porte le client de développement, s'installe sur un
téléphone par lien interne. Android en `apk` et non en `app-bundle` : un bundle
ne s'installe pas à la main, il ne sert qu'au magasin.

`ios.simulator: false` — on vise le téléphone. Une build de simulateur ne reçoit
aucune notification poussée, et c'est justement ce qu'on cherche à éprouver.

**`preview`** — un APK à faire circuler, sans client de développement. C'est ce
qu'on envoie à quelqu'un qui doit juste regarder.

**`production`** — `app-bundle` pour le Play Store, et `autoIncrement` pour que
le numéro de build monte tout seul : un numéro déjà employé fait refuser le dépôt
après la build, c'est-à-dire après l'attente.

---

## Ce qui reste à faire, et qui n'est pas du code

- **Un compte Expo**, puis `eas init` pour lier le projet — il écrit
  `extra.eas.projectId` dans `app.json`.
- **Un compte Apple Developer** (99 $/an) : incontournable dès qu'on installe
  sur un appareil réel, y compris le sien.
- **La version** est à `0.0.0`. À monter avant la première build : les magasins
  refusent une version qui n'augmente pas.
- **`EXPO_PUBLIC_API_URL`** pointe sur `localhost:3001` en développement — donc
  sur la machine du développeur. Un téléphone réel ne l'atteint pas : il faudra
  l'adresse du réseau local, ou un tunnel. C'est le premier mur qu'on rencontre,
  et il n'a rien à voir avec EAS.
