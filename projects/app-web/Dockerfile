ARG BUN_VERSION=1.3.10
ARG NODE_VERSION=24.18.0

FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

# no .git in the build context, so the husky postinstall must be skipped
ENV HUSKY=0

# --- prune the workspace down to what @vers/web needs ---
FROM base AS pruner

# a standalone turbo binary — no workspace install needed to run prune
RUN bun add --global turbo@2.10.0

COPY . .

RUN turbo prune @vers/web --docker

# --- full install (with devDependencies) to run the vite/react-router build ---
FROM base AS installer

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

RUN bun install --frozen-lockfile

# --- build the client + SSR server bundle ---
FROM installer AS builder

COPY --from=pruner /app/out/full/ .
# turbo prune only copies workspace packages — the tsconfig every
# project's tsconfig.json extends lives outside any package, so it comes
# straight from the build context
COPY tsconfig.base.json tsconfig.base.json

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

WORKDIR /app/projects/app-web

RUN \
  # without removing dev/test env files, vite loads the wrong one in our prod
  # bundle — doesn't reproduce outside docker, not worth chasing further
  rm -f .env.development .env.test && \
  # the graphql client (app/gql/**) is committed rather than build-time
  # generated here — turbo prune only carries @vers/web's own dependency
  # graph, not service-api's schema that the root codegen:graphql task reads
  bun run codegen && \
  bun run typegen && \
  bun run build --mode production && \
  rm -f build/client/mockServiceWorker.js

# --- production-only deps, hoisted so the SSR bundle can resolve every
# runtime import from one flat node_modules regardless of directory depth ---
FROM base AS prod-deps

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

RUN bun install --frozen-lockfile --production --linker=hoisted --ignore-scripts

# --- runtime ---
FROM node:${NODE_VERSION}-alpine

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

ENV NODE_ENV="production"

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/projects/app-web/package.json ./package.json
COPY --from=builder /app/projects/app-web/server.mjs ./server.mjs
COPY --from=builder /app/projects/app-web/build ./build

EXPOSE 3000
CMD [ "server.mjs" ]
