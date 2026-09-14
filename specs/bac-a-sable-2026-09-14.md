# Le bac à sable

*14 septembre 2026*

## Pourquoi

Éprouver le mobile demandait jusqu'ici de faire tourner **deux serveurs en
local** — l'API Nest et Metro — sur une machine de 8 Go dont Docker prend déjà
la moitié. Trois pannes de conteneur en une journée sont venues de là.

Le bac à sable porte l'API à la place de la machine. Le mobile s'y connecte, on
ne lance plus que Metro.

## Ce qu'il est

Une **seconde pile** sur le même VPS, à côté de la production — le motif existe
déjà sur cette machine avec `gabee-staging` et `celva-preprod`.

| | production | bac à sable |
|---|---|---|
| répertoire | `$HOME/lehno` | `$HOME/lehno-sandbox` |
| branche | tag `v*` sur `main` | **`develop`**, à chaque fusion |
| image | `:vX.Y.Z` | `:develop` |
| environnement | `.env.production` | `.env.sandbox` |
| `STACK` | `lehno` | `lehno-sandbox` |
| API | `api.lehno.io` | `api.sandbox.lehno.io` |
| site | `lehno.io` | `sandbox.lehno.io` |
| panneau | `admin.lehno.io` | `admin.sandbox.lehno.io` |
| sauvegarde | oui | **non** |

`docker-compose.yml` était déjà variabilisé (`${STACK}`, `${API_DOMAIN}`,
`${IMAGE_TAG}`), à UNE ligne près — et cette ligne a coûté une panne de
production.

**Le nom du projet était figé : `name: lehno`.** Le préfixe par nom de
répertoire, qu'on croit acquis, ne s'applique QUE si ce champ est absent ; il
l'emporte sur tout. Les deux répertoires pilotaient donc le MÊME projet Compose.
Un `up` lancé depuis `lehno-sandbox` a recréé les conteneurs de la
**production** avec l'environnement d'ici : `migrate` a échoué sur des
identifiants de base inexistants, la séquence s'est interrompue avant `api` et
`web`, et `lehno.io` a rendu 404 le temps qu'on la relance. Les données n'ont
rien eu — Postgres n'applique `POSTGRES_*` que sur un volume vierge.

Le nom suit désormais `STACK` (`name: ${STACK:-lehno}`, et `STACK` vaut déjà
`lehno` en production, donc rien n'est rebaptisé). Et le déploiement ne s'en
remet pas à la configuration : il **demande** son nom de projet à Compose et
s'arrête si ce n'est pas `lehno-sandbox`.

Le reste s'isole bien : volumes, conteneurs et réseau interne sont propres à
chaque projet. Seul le réseau `web` est partagé — c'est par lui que Traefik
route les deux.

## Trois décisions

**Il suit `develop`, pas `main`.** Une sandbox alimentée par `main` serait une
copie de la production : elle ne dirait rien de plus qu'elle, et il faudrait
continuer à lancer l'API en local pour éprouver une correction. C'est
exactement ce qu'on cherche à éviter.

**Il n'a pas de barrière de vérification**, contrairement à `release.yml`. La
release en a une parce qu'une version cassée en production coûte des
utilisateurs ; un bac à sable cassé coûte une fusion de plus, et c'est
précisément là qu'on veut que ça casse. La remettre ajouterait quinze minutes à
chaque fusion sur `develop` pour protéger un environnement dont la raison d'être
est d'encaisser les coups.

**Il a sa propre base et ses propres secrets.** Un bac à sable qui porte les
vraies données est une fuite : on y essaie des gestes destructeurs, on y ouvre
des accès larges, et les adresses qui s'y trouvent sont réelles. Des secrets
partagés feraient qu'un jeton émis ici ouvrirait la vraie application.

## Le piège qu'il a fallu éviter

`NEXT_PUBLIC_API_URL` et `VITE_API_URL` sont **gravées dans les paquets clients
à la construction**. Reprises des variables du dépôt — qui portent l'adresse de
production — le site et surtout le **panneau d'administration** du bac à sable
auraient modifié les vraies données en se croyant isolés. `sandbox.yml` les
fixe explicitement.

De même, `docker compose pull` sans nommer les services réclame
`lehno-backup:develop`, que rien ne construit : son absence aurait emporté le
déploiement entier, API comprise.

## Côté mobile

Le profil EAS `preview` pointait sur la **production**. Il pointe désormais le
bac à sable, et l'environnement `preview` d'EAS porte les paires client
`staging` — `mobile_android_staging_97d6f5cd` et `mobile_ios_staging_1cd95a16`,
semées pour ça et jamais employées jusqu'ici.

Ces paires doivent être semées **dans la base du bac à sable**, qui est neuve :
`apps/api/src/scripts/semer-clients-api.ts`.

## Ce qui reste à faire à la main

1. **DNS** — trois enregistrements A vers le VPS : `api.sandbox`, `sandbox`,
   `admin.sandbox`. En « DNS only » le temps que Let's Encrypt réponde au défi
   HTTP ; derrière le nuage orange de Cloudflare, la validation échoue.
2. **Le répertoire** — cloner le dépôt dans `$HOME/lehno-sandbox`, sur
   `develop`.
3. **`.env.sandbox`** — depuis `.env.sandbox.example`. Il porte des secrets,
   donc il s'écrit sur le serveur, jamais depuis une session.
4. **Semer les paires client** dans la base neuve.
