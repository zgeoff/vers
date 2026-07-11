ARG BUN_VERSION=1.3.10

FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

# --- prune the workspace down to what @vers/service-verification needs ---
FROM base AS pruner

# a standalone turbo binary — no workspace install needed to run prune
RUN --mount=type=cache,target=/root/.bun/install/cache bun add --global turbo@2.10.0

COPY . .

RUN turbo prune @vers/service-verification --docker

# --- compile the service to a single self-contained executable ---
# the full dependency set is needed here: `bun build --compile` inlines every JS
# import (workspace source + external deps) into the binary. The services have no
# native addons, so the result is standalone — no node_modules or source at runtime.
FROM base AS builder

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

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
