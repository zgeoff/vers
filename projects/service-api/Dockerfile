ARG NODE_VERSION=20.18.3

FROM vers/monorepo-base:latest AS build

WORKDIR /app

ENV NODE_ENV="production"

ARG BUILD_MODE=production
ENV BUILD_MODE $BUILD_MODE

ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN $SENTRY_AUTH_TOKEN

# set up certificates so sentry can make a deployment
RUN apt-get update && apt-get install -y ca-certificates

RUN \
  yarn run build:service-api --mode "$BUILD_MODE" && \
  cd projects/service-api/dist && \
  # disable pnp so we can simply resolve our modules 
  yarn config set nodeLinker node-modules && \
  yarn install

FROM node:${NODE_VERSION}-alpine

LABEL fly_launch_runtime="Node.js"

WORKDIR /app

ENV NODE_ENV="production"

COPY --from=build /app/projects/service-api/dist /app

EXPOSE 3000
CMD [ "main.js" ]
