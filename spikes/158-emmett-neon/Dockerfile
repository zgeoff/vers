# Deps resolve under node/pnpm (workspace symlinks), runtime is bun — mirrors
# the target stack where pnpm manages the workspace and bun runs services.
FROM node:24-slim AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY store/package.json store/package.json
COPY probe/package.json probe/package.json
RUN pnpm install --frozen-lockfile

FROM oven/bun:1.3-slim
WORKDIR /app
COPY --from=deps /app /app
COPY tsconfig.base.json ./
COPY store/ store/
COPY probe/ probe/
ENV PORT=3002
EXPOSE 3002
CMD ["bun", "probe/src/serve.ts"]
