# CI/CD de Lehno (GitHub Actions → GHCR → VPS)

Modèle repris de gabee (même propriétaire, même VPS partagé) — voir
`.github/workflows/ci.yml`, `.github/workflows/release.yml` et
`docker-compose.yml` à la racine de ce dépôt.

## Vue d'ensemble

```
  PR / push main ─────────────▶  CI  (lint · typecheck · test · build · secrets)
                                          .github/workflows/ci.yml

  git tag vX.Y.Z + push ──────▶  Release
                                  ├─ build-api  ─┐
                                  ├─ build-web  ─┤─▶ push images sur ghcr.io/iamvaln
                                  └─ deploy ─ SSH ▶ VPS : git checkout tag,
                                                    docker compose pull + up
                                          .github/workflows/release.yml
```

- **Images** : `ghcr.io/iamvaln/lehno-api` et `ghcr.io/iamvaln/lehno-web`,
  taguées avec la version (`v1.0.0`) **et** `latest`.
- **Déploiement** : déclenché uniquement par un **tag git `v*`**. Un push sur
  `main` ne fait que la CI (pas de déploiement).
- Le VPS **ne construit jamais** les images : il tire les images
  pré-construites depuis GHCR (`docker compose pull`).
- Les migrations Prisma tournent dans un service `migrate` dédié
  (`docker-compose.yml`), qui s'arrête une fois appliquées — l'api elle-même
  ne migre plus à son propre démarrage (voir `apps/api/Dockerfile`) : une
  seule exécution garantie, même si l'api tourne un jour à plusieurs
  répliques.

---

## Mise en place (une seule fois)

### 1. Variables de build (publiques — Settings ▸ Secrets and variables ▸ Actions ▸ Variables)

Inlinées dans le bundle client au build de l'image web (voir
`apps/web/Dockerfile`, `NEXT_PUBLIC_*`) :

| Variable | Valeur (exemple) |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.lehno.app` |
| `NEXT_PUBLIC_LANCEMENT` | `0` (pré-lancement) ou `1` (badges de stores) |

```bash
gh variable set NEXT_PUBLIC_API_URL --body "https://api.lehno.app"
gh variable set NEXT_PUBLIC_LANCEMENT --body "0"
```

### 2. Secrets de déploiement (Settings ▸ Secrets ▸ Actions, ou via gh)

| Secret | Contenu |
| --- | --- |
| `VPS_HOST` | IP ou nom d'hôte du VPS |
| `VPS_USER` | utilisateur SSH (ex. `deploy`) |
| `VPS_SSH_KEY` | **clé privée** SSH autorisée sur le VPS |
| `VPS_PORT` | *(optionnel)* port SSH, défaut 22 |
| `VPS_APP_DIR` | *(optionnel)* chemin du dépôt sur le VPS, défaut `~/lehno` |

```bash
# Génère une paire de clés dédiée au déploiement (sur ta machine) :
ssh-keygen -t ed25519 -f ~/.ssh/lehno_deploy -C "github-actions-deploy" -N ""
# Autorise la clé publique sur le VPS :
ssh-copy-id -i ~/.ssh/lehno_deploy.pub deploy@TON_IP
# Enregistre la clé PRIVÉE comme secret :
gh secret set VPS_SSH_KEY < ~/.ssh/lehno_deploy
gh secret set VPS_HOST --body "TON_IP"
gh secret set VPS_USER --body "deploy"
```

> Le pull des images depuis GHCR sur le VPS utilise le `GITHUB_TOKEN` du run
> (transmis le temps du déploiement) — pas besoin de PAT ni de rendre les
> images publiques.

### 3. (Optionnel) garde-fou de déploiement

Le job `deploy` utilise l'environnement GitHub `production`. Dans
**Settings ▸ Environments ▸ production**, une **approbation manuelle** peut
être exigée avant chaque déploiement. Sans configuration, il déploie
directement.

### 4. Prérequis côté VPS

- Docker + le plugin Compose installés, réseau externe `web` créé une fois
  (`docker network create web`), **proxy Traefik** déjà lancé dessus — le
  même que celui décrit dans `deploy/DEPLOY.md` de gabee, si Lehno rejoint
  le même VPS partagé. *(Réserve : ce dépôt ne contient pas encore son
  propre guide de provisionnement VPS — à écrire si Lehno prend son propre
  VPS plutôt que de rejoindre celui de gabee.)*
- Le dépôt cloné dans `~/lehno` (ou `VPS_APP_DIR`).
- Un `.env.production` rempli — **non versionné**, il reste sur le VPS et
  survit aux `git checkout`. Variables attendues par `docker-compose.yml` :

| Variable | Rôle |
| --- | --- |
| `WEB_DOMAIN` | domaine du site public (routage Traefik) |
| `API_DOMAIN` | domaine de l'api (routage Traefik — le formulaire de liste d'attente y poste directement depuis le navigateur) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | identifiants de la base (service `db`) |
| `DATABASE_URL` | `postgresql://<user>:<mdp>@db:5432/<db>` — lue par `api` et `migrate` |
| `OTP_PEPPER`, `JWT_SECRET` | secrets applicatifs — l'api refuse de démarrer si absents (générer avec `openssl rand -base64 32`) |
| `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` | envoi de courriel — l'api refuse de démarrer sans les deux |
| `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID` | connexion fédérée, optionnels, vérifiés à l'usage |
| `SENTRY_DSN` | suivi des erreurs, optionnel |
| `API_URL` | lue côté serveur par le rendu SSR du web — mettre `http://api:3000` (nom du service Docker, réseau interne), pas le domaine public |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_LANCEMENT` | mêmes valeurs que les variables GitHub Actions ci-dessus — utiles seulement à un `docker compose build` local (en production, l'image publiée les porte déjà) |

Ce fichier n'est **pas** commité — voir `.env` et `.env.example` dans
`.gitignore`, la même règle vaut pour `.env.production`. Le propriétaire du
dépôt crée et remplit ce fichier directement sur le VPS.

---

## Utilisation au quotidien

### Déployer une version

```bash
# Sur main, à jour et CI verte :
git tag v1.0.0
git push origin v1.0.0
```

Le workflow `Release` se lance : build des 2 images → push GHCR → SSH sur le
VPS qui fait `git checkout v1.0.0`, `docker compose pull`, `up -d`. Le
service `migrate` applique les migrations Prisma et s'arrête avant que `api`
ne démarre (`depends_on: migrate: condition: service_completed_successfully`).

Suis le déroulé dans l'onglet **Actions** de GitHub.

### Versions

[SemVer](https://semver.org/lang/fr/) : `v1.0.0`, `v1.0.1`, `v1.1.0`… Le tag
git **est** le tag d'image déployé (traçabilité 1:1).

### Retour arrière

Redéploie un tag existant, manuellement :

```bash
ssh deploy@TON_IP 'cd ~/lehno && git checkout v0.9.0 && \
  IMAGE_TAG=v0.9.0 docker compose --env-file .env.production up -d'
```

Les images des anciennes versions restent dans GHCR (les deux plus récentes
sont aussi conservées localement sur le VPS, voir le script de déploiement),
donc le retour arrière est instantané — pas de reconstruction. Une version
plus ancienne peut avoir été élaguée localement ; dans ce cas
`docker compose pull` la retéléchargera avant de redémarrer.

**Migrations et retour arrière** : Prisma n'annule pas une migration en
revenant à un tag antérieur — une migration déjà appliquée le reste. Un
retour arrière qui doit défaire un changement de schéma exige une migration
compensatoire écrite à la main, pas seulement un `git checkout` d'un tag
plus ancien.

---

## Ce qui est vérifié en CI

- `pnpm install --frozen-lockfile` — le verrou fait foi, jamais réinstallé
  différemment de ce qui a été vérifié en local.
- `pnpm --filter @lehno/api exec prisma generate` — explicite, pour que
  typecheck et test résolvent les types du client Prisma sans dépendre
  silencieusement d'un hook `postinstall`.
- `pnpm lint` (ESLint, tout le monorepo)
- `pnpm typecheck` (tsc, via turbo, dans les 7 paquets)
- `pnpm test` — Testcontainers lève ses propres bases Postgres éphémères via
  le Docker du runner (voir `apps/api/test/db.ts`) ; contrairement à gabee,
  aucun service `postgres` n'est déclaré dans le job — inutile, et aucune
  configuration ne suppose une base déjà présente sur un port fixe.
- `pnpm build` — construit le site public (`next build`) ; les paquets sans
  script `build` (api, contracts, i18n, tokens) en sont dispensés par
  construction (voir `turbo.json`), ce n'est pas une lacune de la chaîne.
- `gitleaks/gitleaks-action@v2` — recherche de secrets dans tout
  l'historique (`fetch-depth: 0`), bloquant.

> Le build des images Docker n'est pas refait à chaque PR (pour garder la CI
> rapide) ; il est validé au moment du tag. Pour tester le build d'image sans
> déployer : `docker build -f apps/api/Dockerfile -t lehno-api .` (idem pour
> `apps/web/Dockerfile`), ou `docker compose build` en local.

---

## Hors périmètre (délibérément)

gabee porte en plus une machinerie de sécurité (`ops/security`, semgrep,
osv-scanner, trivy, garde-fous propres avec dérogations tracées), des
budgets de taille de bundle, Lighthouse CI et des tests Playwright de bout
en bout. Aucun de ces éléments n'a d'équivalent ici — à envisager plus tard
si Lehno en a besoin, mais ce n'est pas ce que cette tâche couvre.
