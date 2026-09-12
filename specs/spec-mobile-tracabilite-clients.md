# Traçabilité des clients — le mobile

*12 septembre 2026. Détaille `plan-tracabilite-des-clients-2026-09-12.md`.
À lire avec la spec backend, qui décide des noms d'en-têtes et des refus.*

---

## 1. Ce qu'il y a à faire, en une phrase

**Six en-têtes sur chaque appel, posés une seule fois, dans `lib/api.ts`.**

Tout le reste de ce document est la conséquence de cette phrase : où les valeurs
se prennent, ce qu'elles coûtent, et ce qui arrive quand le serveur refuse.

---

## 2. Les en-têtes

```
X-Client-Id      la constante du build
X-Client-Key     la constante du build
X-Client-Type    MOBILE_IOS | MOBILE_ANDROID
X-App-Version    1.4.2          ← app.json, `expo.version`
X-App-OS         ios:17.4       ← Platform.OS + Platform.Version
X-App-Env        prod | staging | dev
```

**Ils se posent au seul endroit qui appelle le réseau.** `lib/api.ts` construit
déjà ses en-têtes à un point unique ; c'est là, et nulle part ailleurs. Les poser
appel par appel garantirait qu'un appel écrit dans six mois les oublie.

**`appel()` ET les surfaces publiques.** `lib/api.ts` porte deux fonctions — une
authentifiée, une publique. Le serveur n'exige rien sur `/public/*`, mais les
envoyer quand même ne coûte rien et rend le journal complet : savoir combien
d'ouvertures de liens viennent de l'application a sa valeur.

---

## 3. Où les valeurs se prennent

### Les deux constantes du build

Elles arrivent par la configuration de compilation, **jamais par `.env` du
dépôt** — qui n'est édité que par le propriétaire, et qui n'est pas le bon
endroit pour une valeur qui diffère par build.

**Proposé** : `extra` de `app.config.ts`, alimenté par les variables EAS, lu par
`Constants.expoConfig.extra`. C'est le chemin qu'Expo prévoit, et il met les
valeurs dans le binaire au moment de la compilation.

> **Elles seront lisibles dans le `.ipa` et dans l'`.apk`.** C'est attendu, c'est
> écrit au §3 du plan, et ça ne doit surprendre personne à la relecture : ces
> valeurs identifient un build, elles ne le protègent pas.

### La version

`app.json` porte déjà `expo.version` — `0.1.0` aujourd'hui. Elle se lit par
`Constants.expoConfig.version`.

**Une décision à prendre** : les mises à jour par-dessus l'air (OTA) changent le
code **sans** changer `expo.version`. Deux appareils sur la même version affichée
peuvent donc faire tourner deux codes différents.

Si les OTA sont employées, `X-App-Version` devrait porter aussi
`runtimeVersion` ou l'identifiant de la mise à jour — sinon la traçabilité
s'arrête au numéro du magasin, et c'est précisément le cas où l'on cherche.
**À trancher avec le backend**, parce que ça change le format de l'en-tête.

### Le système

`Platform.OS` donne `ios` ou `android` ; `Platform.Version` donne `17.4` ou le
niveau d'API Android (un entier, `34`, pas `14`). **Attention** : le serveur
range cette valeur telle quelle, donc Android remontera des niveaux d'API. C'est
utilisable, mais il faut le savoir en lisant les chiffres — ou convertir côté
client, ce qui demande une table à tenir à jour. **Proposé** : on envoie brut, et
la lecture du panneau porte la mention.

### `X-Client-Type`

Il se **déduit** de `Platform.OS`, il ne se configure pas. Une constante de build
qui dirait `MOBILE_IOS` dans un build Android serait une erreur qu'aucun test ne
verrait — et le serveur la refuserait en phase 2, sur tous les appareils à la
fois.

---

## 4. Ce qui arrive quand le serveur refuse

### 403 — client inconnu, clé fausse, type discordant

**En phase 1, ça n'arrive pas** : le serveur ne refuse rien. En phase 2, c'est le
signe d'un build mal configuré ou d'une clé révoquée.

Ce n'est **pas** rattrapable par l'utilisateur : ni reconnexion, ni réessai. Un
écran d'arrêt, comme celui de la maintenance — `ArretProvider` existe déjà et
porte cette forme.

**Ne pas le confondre avec une expiration de jeton.** La couche d'appel renouvelle
le jeton sur un 401 ; un 403 de client doit s'en distinguer par son code
d'enveloppe, sinon l'application tournerait en boucle à renouveler un jeton qui
n'est pas le problème.

### 426 — version trop ancienne (phase 3)

Le corps porte l'URL du magasin. Écran bloquant, un seul bouton : ouvrir le
magasin. Rien d'autre à l'écran — c'est le seul geste possible.

### En-tête de suggestion (phase 3)

Le serveur ajoute un en-tête quand une version plus récente existe sans que la
courante soit hors service. **Non bloquant**, et il ne doit surtout pas
interrompre : une bannière discrète, une fois par session au plus.

---

## 5. Ce qu'il ne faut pas faire

- **Ne pas envoyer `X-Device-Id`.** Il existe ailleurs dans le produit, pour la
  poussée. Le joindre à ceci ferait d'un outil d'exploitation un outil de suivi
  par appareil, ce que ce lot n'est pas.
- **Ne pas mettre les constantes dans un fichier versionné.** Elles changent par
  build et par environnement ; les figer dans le dépôt les enverrait toutes au
  même endroit.
- **Ne pas retenter sur un 403.** Voir plus haut.

---

## 6. Ce qu'il y a à éprouver

- Les six en-têtes partent sur un appel authentifié **et** sur un appel public.
- `X-Client-Type` suit `Platform.OS`, et ne vient pas d'une constante.
- Un 403 de client ne déclenche **pas** le renouvellement de jeton.
- Le format de `X-App-OS` est bien `<os>:<version>`, y compris quand
  `Platform.Version` est un entier.

Le premier est celui qui compte : c'est l'oubli d'un en-tête sur une voie d'appel
qui rendrait le journal incomplet sans que rien ne tombe.

---

## 7. À trancher avant d'écrire

1. **Les OTA** (§3). Si elles sont employées, le format de `X-App-Version` change.
2. **Le niveau d'API Android** : brut ou converti (§3).
3. **Où vivent les deux constantes** : EAS proposé, à confirmer avec qui tient la
   chaîne de compilation.
