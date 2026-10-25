ARG BUN_VERSION=1.4.3
ARG NODE_VERSION=24.18.0

FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

# --- prune the workspace down to what @vers/web needs ---
FROM base AS pruner

COPY . .

# a standalone turbo binary at the catalog version, so the pruned lockfile comes from the turbo
# that the workspace pins and Renovate bumps — no workspace install needed to run prune
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun add --global "turbo@$(bun -p "require('./package.json').workspaces.catalog.turbo")" && \
  turbo prune @vers/web --docker

# --- full install (with devDependencies) to run the vite build ---
FROM base AS installer

COPY --from=pruner /app/out/json/ .

# @vers/source (the root manifest) carries the build-driving devDependencies:
# turbo for the codegen graph and the @tsconfig base every tsconfig extends
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --filter=@vers/web --filter=@vers/source

# --- build the client + SSR server bundle ---
FROM installer AS builder

# sentry-cli uploads sourcemaps over TLS through libcurl, which reads the
# system CA store the slim base image omits — without it every upload fails
# certificate verification (bun is unaffected: it bundles its own roots)
RUN apt-get update && \
  apt-get install -y --no-install-recommends ca-certificates && \
  rm -rf /var/lib/apt/lists/*

COPY --from=pruner /app/out/full/ .
# turbo prune only copies workspace packages — the tsconfig every
# project's tsconfig.json extends lives outside any package, so it comes
# straight from the build context
COPY tsconfig.base.json tsconfig.base.json

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ARG VITE_SENTRY_DSN
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ARG VITE_SIM_ENGINE_HASH
ENV VITE_SIM_ENGINE_HASH=$VITE_SIM_ENGINE_HASH
ARG VITE_UMAMI_WEBSITE_ID
ENV VITE_UMAMI_WEBSITE_ID=$VITE_UMAMI_WEBSITE_ID

WORKDIR /app/apps/web

RUN \
  # without removing dev/test env files, vite loads the wrong one in our prod
  # bundle — doesn't reproduce outside docker, not worth chasing further
  rm -f .env.development .env.test && \
  /app/node_modules/.bin/turbo run codegen typegen --filter=@vers/web... && \
  bun run build --mode production && \
  rm -f dist/client/mockServiceWorker.js

# --- production-only deps, hoisted so the SSR bundle can resolve every
# runtime import from one flat node_modules regardless of directory depth ---
FROM base AS prod-deps

COPY --from=pruner /app/out/json/ .

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production --linker=hoisted --ignore-scripts --filter=@vers/web

# --- runtime ---
FROM node:${NODE_VERSION}-alpine

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

ENV NODE_ENV="production"

COPY --link --from=prod-deps /app/node_modules ./node_modules
COPY --link --from=builder /app/apps/web/package.json ./package.json
COPY --link --from=builder /app/apps/web/server.mjs ./server.mjs
COPY --link --from=builder /app/apps/web/dist ./dist

EXPOSE 3000
CMD [ "server.mjs" ]
