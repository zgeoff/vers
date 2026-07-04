ARG NODE_VERSION=20.18.3
# must match .bun-version; the guard below fails the build on drift
ARG BUN_VERSION=1.3.10

FROM oven/bun:${BUN_VERSION}-slim AS bun

FROM node:${NODE_VERSION}-slim AS base

# bun drives installs and workspace scripts; node stays the runtime
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# no .git in the build context, so the husky postinstall must be skipped
ENV HUSKY=0

COPY --link . .

RUN test "$(bun --version)" = "$(cat .bun-version)" || \
  { echo "bun $(bun --version) does not match .bun-version $(cat .bun-version)"; exit 1; }

RUN bun install --frozen-lockfile
