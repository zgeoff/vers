ARG BUN_VERSION=1.4.3

FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

# --- prune the workspace down to what @vers/service-${SERVICE} needs ---
FROM base AS pruner

# the service's folder under services/, which each app's fly.toml and compose service set
ARG SERVICE

COPY . .

# a standalone turbo binary at the catalog version, so the pruned lockfile comes from the turbo
# that the workspace pins and Renovate bumps — no workspace install needed to run prune
RUN --mount=type=cache,target=/root/.bun/install/cache \
  test -n "$SERVICE" && \
  bun add --global "turbo@$(bun -p "require('./package.json').workspaces.catalog.turbo")" && \
  turbo prune "@vers/service-${SERVICE}" --docker

# --- compile the service's entrypoints to self-contained executables ---
# the full dependency set is needed here: `bun build --compile` inlines every JS
# import (workspace source + external deps) into the binary. The services have no
# native addons, so the result is standalone — no node_modules or source at runtime.
FROM base AS builder

ARG SERVICE

# the sim version a replay image serves: bakes the engine hash into the compiled binary's
# `process.env.SIM_ENGINE_HASH` read, so the value is fixed at build time and the deployed
# binary answers with it regardless of the runtime environment.
ARG SIM_ENGINE_HASH

COPY --from=pruner /app/out/json/ .

RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --filter="@vers/service-${SERVICE}"

COPY --from=pruner /app/out/full/ .

WORKDIR /app/services/${SERVICE}

# each entrypoint a service has becomes the binary its fly.toml and scheduled machines run:
# serve.ts the server, drain.ts the scheduled replay drain, serve-provider.ts the per-version
# replay provider, and sweep.ts the scheduled email sweep. musl matches the alpine runtime below.
RUN mkdir /tmp/bin && \
  for entry in serve:server drain:drain serve-provider:provider sweep:sweep; do \
    source="src/${entry%%:*}.ts"; \
    if [ -f "$source" ]; then \
      bun build "$source" --compile --target=bun-linux-x64-musl \
        ${SIM_ENGINE_HASH:+--define "process.env.SIM_ENGINE_HASH='$SIM_ENGINE_HASH'"} \
        --outfile "/tmp/bin/${entry#*:}" || exit 1; \
    fi; \
  done

# --- runtime: the binaries on alpine (busybox shell kept for `fly ssh console`) ---
FROM alpine:3.24

# bun's musl binaries link against libgcc and libstdc++
RUN apk add --no-cache libgcc libstdc++

COPY --from=builder /tmp/bin/ /usr/local/bin/

ENV NODE_ENV="production"

USER nobody
EXPOSE 3000

CMD ["server"]
