ARG BUN_VERSION=1.3.10
ARG NODE_VERSION=20.18.3

FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

# no .git in the build context, so the husky postinstall must be skipped
ENV HUSKY=0

# --- prune the workspace down to what @vers/service-avatar needs ---
FROM base AS pruner

# a standalone turbo binary — no workspace install needed to run prune
RUN bun add --global turbo@2.10.0

COPY . .

RUN turbo prune @vers/service-avatar --docker

# --- full install (with devDependencies) to run the turbo build ---
FROM base AS installer

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

RUN bun install --frozen-lockfile

# --- bundle the service with esbuild ---
FROM installer AS builder

COPY --from=pruner /app/out/full/ .
# turbo prune only copies workspace packages — the shared build driver and
# the tsconfig every project's tsconfig.json extends live outside any
# package, so they come straight from the build context
COPY scripts/build-esbuild.ts scripts/build-esbuild.ts
COPY tsconfig.base.json tsconfig.base.json

# set up certificates so sentry can make a deployment
RUN apt-get update && apt-get install -y ca-certificates

ARG COMMIT_SHA
ENV COMMIT_SHA=$COMMIT_SHA

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

RUN bun run build --filter=@vers/service-avatar

# --- production-only deps, hoisted so the single esbuild bundle can
# resolve externals that came from more than one source package ---
FROM base AS prod-deps

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

RUN bun install --frozen-lockfile --production --linker=hoisted --ignore-scripts

# --- runtime ---
FROM node:${NODE_VERSION}-alpine

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

ENV NODE_ENV="production"

COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/projects/service-avatar/dist/main.js ./main.js
COPY --from=builder /app/projects/service-avatar/dist/main.js.map ./main.js.map

EXPOSE 3005
CMD [ "main.js" ]
