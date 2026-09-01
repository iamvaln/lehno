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
- **La version** est passée à `0.1.0` : les magasins refusent une version qui
  n'augmente pas, et `0.0.0` n'aurait laissé nulle part où descendre.
- **`EXPO_PUBLIC_API_URL`** diffère selon le profil, et c'est délibéré.
  `development` vise `localhost:3001` : c'est la boucle de développement, l'api
  tourne sur la machine. Mais un téléphone réel ne joint pas ce localhost-là —
  il faudra l'adresse du réseau local, ou un tunnel.
  `preview` et `production` visent `https://api.lehno.io/v1`, l'api déployée.
  Un APK qu'on fait essayer à quelqu'un doit marcher depuis chez lui, pas
  seulement sur le réseau du bureau.

---

## `ONESIGNAL_APP_ID` vit en secret EAS, pas dans le dépôt

`app.config.js` lit `process.env.ONESIGNAL_APP_ID` **sur la machine qui
construit** et la dépose dans `extra.oneSignalAppId`. Or une build EAS tourne
sur les serveurs d'Expo : le `.env.local` de la machine du développeur n'y monte
pas.

Sans elle, la build réussit et l'application se lance — mais
`PousseeProvider` trouve `null`, ne s'abonne à rien, et **aucune notification
n'arrive**. C'est silencieux des deux côtés : rien n'échoue, rien ne le dit.
On le découvre en attendant un rappel qui ne vient pas.

D'où un secret de projet, posé une fois :

```
eas secret:create --scope project --name ONESIGNAL_APP_ID \
  --value "<identifiant>" --type string
```

`--type string` n'est pas optionnel en mode non interactif : sans lui la
commande échoue sur « Secret type may not be empty ».

**Un secret, et non une entrée `env` dans `eas.json`.** L'identifiant n'est pas
secret — il voyage dans chaque installation — mais l'écrire dans `eas.json` le
figerait pour tous les profils, et recette et production partageraient alors le
même flux : un essai ferait sonner de vrais téléphones. C'est le raisonnement
que porte déjà `app.config.js`.

**La clé d'API OneSignal ne suit JAMAIS ce chemin.** Elle autorise à envoyer une
notification à n'importe qui ; un APK se décompresse et ses chaînes se lisent.
Elle reste au serveur, dans `.env.production`.

## Une observation qui trompe

`expo config --json` rend `"oneSignalAppId": {}` quand la variable est absente —
c'est sa façon de sérialiser un `null`, pas un défaut. Avec la variable posée,
la valeur est bien la chaîne. Le garde de `PousseeProvider`
(`typeof === "string"`) traite correctement les deux cas.
