ARG BUN_VERSION=1.4.3

FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

# --- prune the workspace down to what @vers/service-replay needs ---
FROM base AS pruner

COPY . .

# a standalone turbo binary at the catalog version, so the pruned lockfile comes from the turbo
# that the workspace pins and Renovate bumps — no workspace install needed to run prune
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun add --global "turbo@$(bun -p "require('./package.json').workspaces.catalog.turbo")" && \
  turbo prune @vers/service-replay --docker

# --- compile the service to a single self-contained executable ---
# the full dependency set is needed here: `bun build --compile` inlines every JS
# import (workspace source + external deps) into the binary. The services have no
# native addons, so the result is standalone — no node_modules or source at runtime.
FROM base AS builder

# the sim version this image serves: bakes the engine hash into the compiled binary's
# `process.env.SIM_ENGINE_HASH` read, so the value is fixed at build time and the deployed
# binary answers with it regardless of the runtime environment.
ARG SIM_ENGINE_HASH

COPY --from=pruner /app/out/json/ .

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --filter=@vers/service-replay

COPY --from=pruner /app/out/full/ .

WORKDIR /app/services/replay

# musl target matches the alpine runtime below
RUN bun build src/serve.ts --compile --target=bun-linux-x64-musl \
  --define "process.env.SIM_ENGINE_HASH='$SIM_ENGINE_HASH'" \
  --outfile /tmp/server

# the drain binary: the hourly scheduled machine runs one queue drain and exits
RUN bun build src/drain.ts --compile --target=bun-linux-x64-musl \
  --define "process.env.SIM_ENGINE_HASH='$SIM_ENGINE_HASH'" \
  --outfile /tmp/drain

# the provider binary: only `replaySegment`, on a narrowed env shape with no database, keys
# service, or signing key — per-version provider apps run this instead of `server`
RUN bun build src/serve-provider.ts --compile --target=bun-linux-x64-musl \
  --define "process.env.SIM_ENGINE_HASH='$SIM_ENGINE_HASH'" \
  --outfile /tmp/provider

# --- runtime: the three binaries on alpine (busybox shell kept for `fly ssh console`) ---
FROM alpine:3.24

# bun's musl binaries link against libgcc and libstdc++
RUN apk add --no-cache libgcc libstdc++

COPY --from=builder /tmp/server /usr/local/bin/server
COPY --from=builder /tmp/drain /usr/local/bin/drain
COPY --from=builder /tmp/provider /usr/local/bin/provider

ENV NODE_ENV="production"

USER nobody
EXPOSE 3000

CMD ["server"]
