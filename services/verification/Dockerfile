ARG BUN_VERSION=1.3.10

FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

# --- prune the workspace down to what @vers/service-verification needs ---
FROM base AS pruner

# a standalone turbo binary — no workspace install needed to run prune
RUN --mount=type=cache,target=/root/.bun/install/cache bun add --global turbo@2.10.0

COPY . .

RUN turbo prune @vers/service-verification --docker

# turbo prune's subset bun.lock keeps the root's hoisting choices, which bun
# re-resolves differently for the smaller workspace set — --frozen-lockfile
# then fails (vercel/turborepo#11007). Install stages instead use the
# committed root lockfile with every workspace manifest present, filtered to
# this service's graph; prune output feeds only the source (out/full) stage.
RUN mkdir /manifests && \
  find . -name package.json -not -path './out/*' -exec cp --parents {} /manifests/ \; && \
  cp bun.lock bunfig.toml /manifests/ && \
  cp -r patches /manifests/patches

# --- compile the service to a single self-contained executable ---
# the full dependency set is needed here: `bun build --compile` inlines every JS
# import (workspace source + external deps) into the binary. The services have no
# native addons, so the result is standalone — no node_modules or source at runtime.
FROM base AS builder

COPY --from=pruner /manifests/ .

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --filter=@vers/service-verification

COPY --from=pruner /app/out/full/ .

WORKDIR /app/services/verification

# musl target matches the alpine runtime below
RUN bun build src/serve.ts --compile --target=bun-linux-x64-musl --outfile /tmp/server

# --- runtime: just the binary on alpine (busybox shell kept for `fly ssh console`) ---
FROM alpine:3.21

# bun's musl binary links against libgcc and libstdc++
RUN apk add --no-cache libgcc libstdc++

COPY --from=builder /tmp/server /usr/local/bin/server

ENV NODE_ENV="production"

USER nobody
EXPOSE 3000

CMD ["server"]
