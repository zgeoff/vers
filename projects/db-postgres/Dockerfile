ARG NODE_VERSION=20.18.3

FROM vers/monorepo-base:latest AS build

WORKDIR /app

ENV NODE_ENV="production"

# used for vite build mode
ARG BUILD_MODE=production
ENV BUILD_MODE $BUILD_MODE

RUN \
  bun run build:db-postgres --mode "$BUILD_MODE" && \
  # make the generated manifest standalone: drop workspace deps (bundled)
  # and inline catalog versions so npm can install it
  bun scripts/write-standalone-manifest.ts projects/db-postgres/dist/package.json && \
  cd projects/db-postgres/dist && \
  npm install --omit=dev

FROM node:${NODE_VERSION}-alpine

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

ENV NODE_ENV="production"

COPY --from=build /app/projects/db-postgres/dist /app
COPY --from=build /app/projects/db-postgres/migrations /app/migrations

CMD [ "migrate.js" ]
