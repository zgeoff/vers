ARG NODE_VERSION=20.18.3

FROM vers/monorepo-base:latest AS build

ENV NODE_ENV="production"

RUN \
  # without removing dev/test env files, vite loads the wrong one in our prod bundle.
  # issue does not exist outside of docker - cannot be bothered spending any more time working out why.
  rm -f projects/app-web/.env.development && \
  rm -f projects/app-web/.env.test && \
  # build application
  bun run build:app-web --mode production && \
  # clean up msw
  rm -f projects/app-web/build/client/mockServiceWorker.js && \
  # make app-web's manifest standalone for the npm install below: drop
  # workspace deps (bundled into the build) and inline catalog versions
  bun scripts/write-standalone-manifest.ts projects/app-web/package.json && \
  # remove our root package.json so no workspace shenanigans
  rm -f package.json && \
  # drop the bun-linked node_modules trees - npm follows their symlinks into
  # the isolated store and chokes running lifecycle scripts there
  rm -rf node_modules projects/app-web/node_modules && \
  # install our minimum required dependencies to run our server
  cd projects/app-web && \
  npm install --omit=dev --legacy-peer-deps

FROM node:${NODE_VERSION}-alpine

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

ENV NODE_ENV="production"

COPY --from=build /app/projects/app-web/package.json /app/projects/app-web/server.mjs /app/
COPY --from=build /app/projects/app-web/node_modules /app/node_modules
COPY --from=build /app/projects/app-web/build /app/build

EXPOSE 3000
CMD [ "npm", "run", "start" ]
