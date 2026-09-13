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
X-Client-Type    mobile_ios | mobile_android   ← en MINUSCULES (§2 bis)
X-App-Version    1.4.2          ← app.json, `expo.version`
X-App-Build      412            ← le BUILD, entier monotone (§3 bis)
X-App-OS         ios:17.4       ← Platform.OS + Platform.Version
X-App-Env        prod | staging | dev
```

### §2 bis — la casse, et pourquoi ce paragraphe existe

*Ajouté le 13 septembre. La première version de ce document annonçait
`MOBILE_IOS`, en majuscules, repris de monjeton qui range ses types ainsi.*

**Le contrat de Lehno compare à `mobile_ios`, en minuscules.** Un build qui aurait
suivi le brief serait passé en phase 1 — où rien ne refuse — et se serait fait
mettre dehors **le jour où l'on allume la phase 2**. Invisible pendant des
semaines, catastrophique d'un coup.

Le serveur normalise désormais la casse, donc les deux passent. **Envoyez quand
même les minuscules** : c'est ce que le contrat déclare, et se fier à une
tolérance revient à parier qu'elle ne changera pas.

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

### Le build, et pourquoi il compte plus que la version

*Ajouté le 12 septembre avec `spec-registre-des-versions.md`.*

**La version est ce qu'un humain lit ; le build est ce qui compare.** Comparer
des `semver` en chaînes rendrait « 1.10.0 » plus ancien que « 1.9.0 », et ce
défaut ne se voit qu'au dixième correctif mineur — au moment où l'on en a le plus
besoin.

| | où le prendre |
| --- | --- |
| iOS | `CFBundleVersion` — l'entier que le magasin exige croissant |
| Android | `versionCode` — idem, exigé par Play |

**Corrigé le 13 septembre — la première version de ce paragraphe était fausse
pour ce dépôt.** Elle disait de déclarer `ios.buildNumber` et
`android.versionCode` dans `app.config.ts`. Or `eas.json` porte déjà
`appVersionSource: "remote"` et `autoIncrement: true` : **le numéro vit chez EAS**,
et le figer dans le dépôt entre en conflit avec le versionnage distant — Expo en
avertit, et on obtiendrait deux sources pour un même nombre, dont celle qui perd
est silencieuse.

**Il se lit par `expo-application`, champ `nativeBuildVersion`** : ce que le
binaire porte réellement, donc ce que le magasin a stampé. La chaîne fait déjà ce
que ce document réclamait ; c'est le chemin de lecture qui était mal décrit.

### Quand il n'y a pas de build : **on omet l'en-tête**

Ni chaîne vide, ni valeur convenue comme `dev`. L'absence est honnête ; `"dev"`
serait une chaîne magique à traiter à part partout, et une chaîne vide ne se
distingue pas d'un bug.

**Et l'absence n'atteint jamais la décision**, parce que les builds qui n'ont pas
de numéro sont hors production, donc exemptés — voir §3 ter. Le serveur, lui,
n'accepte que des entiers : toute autre valeur vaut « pas de build ».

### §3 ter — hors production, le registre ne s'applique pas

*Ajouté le 13 septembre, en réponse au blocage signalé par la session mobile.*

Un build de développement, Expo Go, une diffusion interne **n'ont aucun numéro de
build** — c'est la conséquence directe d'`appVersionSource: "remote"`. Sans
exemption, allumer la garde des versions mettrait dehors toute l'équipe et tous
les testeurs, avec un « mettez à jour » qu'aucun magasin ne peut satisfaire.

**L'exemption se décide sur l'environnement du client ENREGISTRÉ**, pas sur
`x-app-env`. Un build de production qui déclarerait `dev` ne s'exempterait de
rien : c'est la **paire présentée** qui tranche, et elle est en base. C'est aussi
la raison d'être des six paires — l'environnement fait partie de l'identité du
client, pas de ce qu'il raconte.

**Ce que ça demande au mobile** : les builds de développement et de recette
présentent la paire `staging`, les builds du magasin la paire `prod`. C'est tout.

**Et sans client reconnu, rien n'est jugé non plus** : le type et l'environnement
viennent de la paire, jamais des en-têtes. Décider sur une déclaration
reviendrait à laisser le client choisir s'il veut être jugé.

### Le système

`Platform.OS` donne `ios` ou `android` ; `Platform.Version` donne `17.4` ou le
niveau d'API Android (un entier, `34`, pas `14`). **Attention** : le serveur
range cette valeur telle quelle, donc Android remontera des niveaux d'API. C'est
utilisable, mais il faut le savoir en lisant les journaux — ou convertir côté
client, ce qui demande une table à tenir à jour. **Proposé** : on envoie brut, et
la spec backend porte la mention.

### `X-Client-Type`

Il se **déduit** de `Platform.OS`, il ne se configure pas. Une constante de build
qui dirait `MOBILE_IOS` dans un build Android serait une erreur qu'aucun test ne
verrait — et le serveur la refuserait en phase 2, sur tous les appareils à la
fois.

---

## 4. Ce qui arrive quand le serveur refuse

### 403 `client_unknown` — l'application n'est pas reconnue

**En phase 1, ça n'arrive pas** : le serveur ne refuse rien. En phase 2, c'est le
signe d'un build mal configuré ou d'une clé révoquée.

Ce n'est **pas** rattrapable par l'utilisateur : ni reconnexion, ni réessai. Un
écran d'arrêt, comme celui de la maintenance — `ArretProvider` existe déjà et
porte cette forme.

**Le code d'enveloppe est `client_unknown`**, et il est distinct de `forbidden` —
c'était une promesse de ce document que le serveur ne tenait pas encore le
13 septembre : la garde levait un `forbidden` ordinaire, indiscernable d'un
compte suspendu, et l'écran aurait montré « votre compte est refusé » à quelqu'un
dont le compte va très bien. C'est corrigé.

**Ne pas le confondre avec une expiration de jeton.** La couche d'appel renouvelle
sur un 401 ; sur `client_unknown`, elle ne doit **ni renouveler ni réessayer** —
rien ne changera, et l'application tournerait en boucle sur un jeton qui n'est pas
le problème.

**Cinq causes, une seule réponse** : identifiant absent, inconnu, client coupé,
clé fausse, type discordant. Le serveur ne dit pas laquelle — le dire
apprendrait à un script lesquelles il a devinées — et l'écran n'a rien d'utile à
en faire de toute façon.

### 426 — mettez à jour (phase 3)

Le corps porte l'URL du magasin **et la version attendue**. Écran bloquant, un
seul bouton : ouvrir le magasin. Rien d'autre à l'écran — c'est le seul geste
possible.

**Trois causes, une seule réponse**, et c'est délibéré : la version est déclassée,
elle est sous un `forcesUpdate`, ou elle est **inconnue du registre**. Le
troisième cas est celui d'un build parti au magasin sans être enregistré — l'écran
ne doit pas le distinguer, parce que le geste est le même et qu'il n'y a rien
d'utile à dire de plus à quelqu'un qui attend d'ouvrir son application.

**Ne jamais retenter**, et ne pas confondre avec un jeton expiré : la couche
d'appel renouvelle sur un 401, et boucler ici tournerait à vide.

### En-tête de suggestion (phase 3)

Le serveur ajoute un en-tête quand une version plus récente existe sans que la
courante soit hors service. **Non bloquant**, et il ne doit surtout pas
interrompre : une bannière discrète, une fois par session au plus.

**Les deux en-têtes**, et ils voyagent ensemble :

| en-tête | ce qu'il porte |
| --- | --- |
| `x-app-update-available` | le numéro de la version plus récente — `1.4.0` |
| `x-app-update-url` | où la prendre. Absent quand le registre ne connaît pas de lien |

**Le lien accompagne la version**, et ce n'est pas un confort : annoncer une
version sans dire où la prendre demande d'aller la chercher soi-même, et c'est la
même faute que « mettez à jour » sans lien — un mur, en plus poli.

**Les deux sont facultatifs, séparément.** Une valeur qu'un en-tête ne peut pas
porter — le registre est une saisie d'administration, et rien n'interdit un
retour à la ligne dans un numéro de version — **n'est pas posée** plutôt que de
faire tomber la requête. Node refuse une telle valeur, et la garde tourne sur
CHAQUE appel : une frappe malheureuse aurait rendu 500 sur tout le trafic, sans
que le lien avec le registre saute aux yeux. Le client doit donc traiter
l'absence, y compris celle de `x-app-update-url` seule.

**La bannière n'est pas bloquante** : discrète, une fois par session au plus, et
elle n'interrompt rien.

> **Câblé le 13 septembre**, et le paramètre a changé de portée en même temps.
>
> `versions.service.ts` calculait l'état `suggeree` depuis toujours ; la garde ne
> posait aucun en-tête, et la suggestion ne quittait jamais le serveur.
>
> **Ce qui bloquait vraiment** n'était pas l'en-tête manquant mais la place du
> paramètre : `version_guard_enabled` était lu **en tête de garde** et coupait
> celle-ci ENTIÈRE. La bannière n'aurait donc pu exister qu'une fois le refus
> allumé — c'est-à-dire une fois qu'on accepte de mettre des gens dehors. Le plus
> doux des deux gestes attendait le plus dur.
>
> **Le paramètre ne gouverne plus que le REFUS.** Éteint, un build périmé reçoit
> la bannière au lieu du 426 : c'est la phase « on note, on ne bloque pas » que
> le §8.3 du registre des versions proposait et qui n'existait nulle part. On
> regarde le parc bouger, puis on allume.
>
> Les deux exemptions, elles, ne bougent pas : **sans client reconnu** on ne sait
> ni quelle plateforme ni quel environnement, et **hors production** il n'y a pas
> de numéro de build à comparer. Dans les deux cas il n'y a rien à suggérer non
> plus.

> **Lu côté client le 13 septembre au soir** — #246, et la phase 3 est entière.
>
> La suggestion voyage sur les réponses qui **réussissent**, d'où un témoin à
> elle : `surEchec` porte l'arrêt et le refus, qui arrivent en échec, et n'aurait
> vu la suggestion que le jour où quelque chose casse. Elle s'observe au seul
> `fetch` du paquet, au même endroit que les en-têtes de client et pour la même
> raison — une réponse qui passerait à côté ne suggérerait jamais rien.
>
> **Les quatre absences sont traitées** : version seule (bandeau conservé, texte
> qui cesse de promettre un geste), lien seul (rien — il ne nomme aucune
> version), les deux absents, et l'en-tête présent mais vide qu'un relais a
> vidé. Sans ce dernier cas, on annonce « La version  est disponible ».
>
> **Une fois par session**, et le drapeau de renvoi n'est pas un confort :
> l'en-tête revient sur CHAQUE appel, donc fermer le bandeau le ferait revenir à
> la requête suivante. Il vit en mémoire — sur le disque, quelqu'un qui a fermé
> le bandeau en mars n'entendrait plus jamais parler d'aucune version.
>
> **Ce qui n'est pas éprouvé de bout en bout**, et il faut le dire : le
> déclenchement. Les deux exemptions ci-dessus font qu'aucun build de
> développement ne recevra jamais ces en-têtes. La lecture a ses cas, le rendu a
> été vu à l'écran par une sonde, mais la jonction des deux ne se verra qu'en
> production.

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
- Un 403 `client_unknown` ne déclenche **pas** le renouvellement de jeton.
- **Et il ne fait pas effacer les jetons pendant `/auth/refresh`.** La mécanique
  de renouvellement les efface sur n'importe quel échec ; `client_unknown` doit
  en être exclu explicitement. Sans ça, un build mal configuré déconnecterait
  tout le monde au lieu d'afficher son écran — et la reconnexion échouerait pour
  la même raison, en boucle. Rien à faire côté serveur ; tout côté client, donc
  ce cas doit exister.
- Le format de `X-App-OS` est bien `<os>:<version>`, y compris quand
  `Platform.Version` est un entier.

Le premier est celui qui compte : c'est l'oubli d'un en-tête sur une voie d'appel
qui rendrait le journal incomplet sans que rien ne tombe.

---

## 7. À trancher avant d'écrire

1. *(tranché le 13 septembre — plus une question.)* **Les OTA ne sont pas
   employées** : ni `updates` ni `runtimeVersion` dans la configuration.
   `x-app-build` porte donc le binaire seul, et deux appareils sur le même build
   font tourner le même code. Écrit ici pour que ça ne redevienne pas une
   question.
2. *(tranché — plus une question.)* **Le niveau d'API Android part brut**,
   comme proposé. La lecture des journaux porte la mention : Android remonte un
   niveau d'API (`34`), pas une version commerciale (`14`).
3. **Où vivent les deux constantes** : EAS proposé, à confirmer avec qui tient la
   chaîne de compilation.
