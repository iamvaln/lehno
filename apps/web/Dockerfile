# syntax=docker/dockerfile:1
#
# Image du site public (@lehno/web — Next.js App Router). Construction à
# exécuter depuis la racine du dépôt, contexte = monorepo entier :
#
#   docker build -f apps/web/Dockerfile -t lehno-web .
#
# Étapes :
#   base    — image commune, pnpm activé
#   install — installation figée du monorepo entier (verrou respecté)
#   builder — next build, avec output: "standalone" (next.config.mjs) :
#             Next calcule lui-même le sous-ensemble de node_modules utile
#             et le copie dans .next/standalone — pas besoin de pnpm deploy
#             ici, le traçage de fichiers de Next joue le même rôle
#   runtime — image finale minimale, utilisateur non privilégié

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo
# Résilience réseau + copies réelles plutôt que liens durs entre couches —
# voir le commentaire équivalent dans apps/api/Dockerfile (« repris de
# gabee ») : cette image copie elle aussi un node_modules déjà lié
# (COPY --from=builder de .next/standalone plus bas) d'une couche à l'autre.
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_fetch_timeout=600000 \
    npm_config_network_concurrency=4 \
    npm_config_package_import_method=copy

FROM base AS install
COPY . .
RUN pnpm install --frozen-lockfile

FROM install AS builder
# Les variables NEXT_PUBLIC_* sont lues au moment du build et gravées dans
# le bundle client — contrairement à API_URL (lu côté serveur), elles ne
# peuvent pas être fournies seulement à l'exécution du conteneur. Valeurs de
# repli identiques à apps/web/.env.example.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @lehno/web build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
# 0.0.0.0 : le serveur autonome de Next écoute sur HOSTNAME (défaut
# "localhost"), injoignable depuis l'extérieur du conteneur sinon.
ENV HOSTNAME=0.0.0.0

# .next/ reste toujours sous apps/web/ (Next l'écrit à côté du code source,
# quel que soit outputFileTracingRoot — ce dernier ne change que la racine
# du calcul de traçage, pas l'emplacement de la sortie). outputFileTracingRoot
# pointant sur la racine du monorepo, le contenu de standalone/ reproduit
# lui-même apps/web/server.js sous ce même chemin, avec les node_modules
# tracés à la racine — on les copie tels quels.
COPY --chown=node:node --from=builder /repo/apps/web/.next/standalone ./
# La sortie autonome ne copie ni les assets statiques ni public/ (documenté
# par Next) : à faire à la main.
COPY --chown=node:node --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --chown=node:node --from=builder /repo/apps/web/public ./apps/web/public

WORKDIR /repo/apps/web
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/fr').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
