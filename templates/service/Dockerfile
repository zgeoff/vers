# Reference template for a service built on @vers/service-runtime. It cannot be built as-is —
# there is no real service using this scaffold yet — but shows the shape a copying service should
# follow. Unlike the repo-root Dockerfile (node runtime, bun only for installs), services built on
# this runtime run on bun itself; update FROM to match .bun-version when it drifts.
FROM oven/bun:1 AS base

WORKDIR /app

# Copy workspace manifests first so dependency install is cached independently of source changes.
# A copying service lists every workspace manifest its own package.json depends on here — at
# minimum the root manifest, its own project, and contracts/<service> + libs/service/service-runtime.
COPY package.json bun.lock .bun-version ./
COPY contracts/base/package.json contracts/base/package.json
COPY libs/service/service-runtime/package.json libs/service/service-runtime/package.json
# COPY contracts/<service>/package.json contracts/<service>/package.json
# COPY services/<service>/package.json services/<service>/package.json

RUN bun install --frozen-lockfile --production

# Copy the source for every project listed above.
COPY contracts/base contracts/base
COPY libs/service/service-runtime libs/service/service-runtime
# COPY contracts/<service> contracts/<service>
# COPY services/<service> services/<service>

USER bun
EXPOSE 3000

# A copying service replaces this with its own entrypoint (its createService caller).
CMD ["bun", "run", "src/serve.ts"]
