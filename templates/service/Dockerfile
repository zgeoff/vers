# Reference template for a service built on @vers/service-runtime. It cannot be built as-is —
# there is no real service using this scaffold yet — but shows the shape a copying service should
# follow. Unlike the repo-root Dockerfile (node runtime, bun only for installs), services built on
# this runtime run on bun itself; update FROM to match .bun-version when it drifts.
FROM oven/bun:1 AS base

WORKDIR /app

# Copy workspace manifests first so dependency install is cached independently of source changes.
# A copying service lists every workspace manifest its own package.json depends on here — at
# minimum the root manifest, its own project, and lib-contract-<service>/lib-service-runtime.
COPY package.json bun.lock .bun-version ./
COPY projects/lib-contract-base/package.json projects/lib-contract-base/package.json
COPY projects/lib-service-runtime/package.json projects/lib-service-runtime/package.json
# COPY projects/lib-contract-<service>/package.json projects/lib-contract-<service>/package.json
# COPY projects/service-<service>/package.json projects/service-<service>/package.json

RUN bun install --frozen-lockfile --production

# Copy the source for every project listed above.
COPY projects/lib-contract-base projects/lib-contract-base
COPY projects/lib-service-runtime projects/lib-service-runtime
# COPY projects/lib-contract-<service> projects/lib-contract-<service>
# COPY projects/service-<service> projects/service-<service>

USER bun
EXPOSE 3000

# A copying service replaces this with its own entrypoint (its createService caller).
CMD ["bun", "run", "src/serve.ts"]
