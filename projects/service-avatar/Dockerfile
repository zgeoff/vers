FROM oven/bun:1 AS base

WORKDIR /app

# Copy workspace manifests first so dependency install is cached independently of source changes.
COPY package.json bun.lock .bun-version ./
COPY projects/lib-contract-base/package.json projects/lib-contract-base/package.json
COPY projects/lib-service-runtime/package.json projects/lib-service-runtime/package.json
COPY projects/lib-contract-avatar/package.json projects/lib-contract-avatar/package.json
COPY projects/lib-db/package.json projects/lib-db/package.json
COPY projects/lib-data/package.json projects/lib-data/package.json
COPY projects/service-avatar/package.json projects/service-avatar/package.json

RUN bun install --frozen-lockfile --production

# Copy the source for every project listed above.
COPY projects/lib-contract-base projects/lib-contract-base
COPY projects/lib-service-runtime projects/lib-service-runtime
COPY projects/lib-contract-avatar projects/lib-contract-avatar
COPY projects/lib-db projects/lib-db
COPY projects/lib-data projects/lib-data
COPY projects/service-avatar projects/service-avatar

WORKDIR /app/projects/service-avatar

USER bun
EXPOSE 3000

CMD ["bun", "run", "src/serve.ts"]
