# syntax=docker/dockerfile:1
#
# Image du back-office (@lehno/admin — Vite, application d'une seule page).
# Construction depuis la racine du dépôt, contexte = monorepo entier :
#
#   docker build -f apps/admin/Dockerfile -t lehno-admin .
#
# Étapes :
#   base    — image commune, pnpm activé
#   install — installation figée du monorepo entier (verrou respecté)
#   builder — vite build, sortie statique dans dist/
#   runtime — nginx, qui ne sert que des fichiers
#
# POURQUOI NGINX ET PAS NODE, contrairement au site public : celui-ci est un
# serveur Next qui rend à la demande ; le back-office est un tas de fichiers
# figés. Lui donner un exécutable Node ajouterait une surface et un processus
# pour ne rien calculer.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
# Même réglage que les deux autres images du dépôt (« repris de gabee ») :
# résilience réseau, et copies réelles plutôt que liens durs entre couches.
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=600000 \
    npm_config_network_concurrency=4 \
    npm_config_package_import_method=copy

FROM base AS install
COPY . .
RUN pnpm install --frozen-lockfile

FROM install AS builder
# VITE_API_URL est GRAVÉE dans le paquet au moment du build, comme les
# NEXT_PUBLIC_* du site public : elle ne peut pas être fournie à l'exécution.
# Une image construite pour la recette ne peut donc pas servir la production.
#
# Le « /v1 » fait partie de la base ici — contrairement au mobile, où le client
# l'ajoute lui-même. Le repli de session.ts porte la même forme.
ARG VITE_API_URL=http://localhost:3001/v1
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm --filter @lehno/admin build

FROM nginx:1.27-alpine AS runtime
# Le repli d'application d'une seule page : toute adresse inconnue rend
# index.html, et c'est le routeur du navigateur qui décide. Sans lui, un
# rechargement sur /utilisateurs répondrait 404 — la page marche à la première
# visite et casse au rafraîchissement, ce qui se découvre tard.
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
# Les en-têtes de sécurité, inclus depuis chaque bloc `location` : `add_header`
# ne s'hérite pas, et un seul posé dans un bloc annule tous ceux du dessus.
COPY apps/admin/entetes.conf /etc/nginx/conf.d/entetes.conf
COPY --from=builder /repo/apps/admin/dist /usr/share/nginx/html

EXPOSE 80

# wget vient de busybox, déjà présent dans l'image : rien à installer pour
# savoir si le serveur répond.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
