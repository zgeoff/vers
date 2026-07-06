ARG BUN_VERSION=1.3.10

FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

# --- prune the workspace down to what @vers/service-session needs ---
FROM base AS pruner

# a standalone turbo binary — no workspace install needed to run prune
RUN bun add --global turbo@2.10.0

COPY . .

RUN turbo prune @vers/service-session --docker

# --- production-only deps: no bundle step, so no hoisting needed ---
FROM base AS prod-deps

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock

RUN bun install --frozen-lockfile --production

# --- runtime: runs the pruned bun source directly, no bundle ---
FROM base

# the isolated linker nests a `node_modules` under every workspace package, not just the root, so
# prod-deps' whole tree comes first; out/full then lays real source over its out/json placeholders
COPY --from=prod-deps /app/ .
COPY --from=pruner /app/out/full/ .

WORKDIR /app/projects/service-session

USER bun
EXPOSE 3002

CMD ["bun", "run", "src/serve.ts"]
