ARG NODE_VERSION=20.18.3

FROM vers/monorepo-base:latest AS build

WORKDIR /app

ENV NODE_ENV="production"

COPY --link . .

RUN \
  bun run build:db-mongo && \
  cd projects/db-mongo && \
  node --experimental-sea-config sea-config.json && \
  cp $(command -v node) dist/run-flycheck-server && \
  npx postject dist/run-flycheck-server NODE_SEA_BLOB dist/sea-prep.blob \
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
  
FROM mongo:6.0

COPY projects/db-mongo/scripts/* /usr/local/bin/
COPY projects/db-mongo/start.sh /usr/local/bin/
COPY projects/db-mongo/mongod.conf /etc/mongod.conf
COPY --from=build /app/projects/db-mongo/dist/run-flycheck-server /usr/local/bin/

EXPOSE 27017
EXPOSE 5500

ENTRYPOINT [ "start.sh" ]