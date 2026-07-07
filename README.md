# vers

## usage

```sh
# start postgres container for tests
yarn pg:test-container:start

# lint, typecheck, unit tests
yarn lint
yarn typecheck
yarn test

# build, dev, test specific project
yarn build:<project>
yarn dev:<project>
yarn test:<project>

# run panda css codegen
yarn codegen:styles

# regenerate tsconfig's paths after adding/renaming a package
yarn codegen:paths

# spin up full backend via docker compose
yarn stack start

# rebuild full backend
yarn stack build

# install e2e browsers
yarn playwright install

# run all e2e tests
yarn e2e

# stop full backend
yarn stack stop

# stop specific service
yarn stack stop:<service>
```

## generating keys for JWT signing & verification

```sh

# generate rs256 private key
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 | openssl pkcs8 -topk8 -nocrypt > privkey.pem

# extract pubkey
openssl pkey -pubout -in privkey.pem -out pubkey.crt
```

## creating a new fly deployment

```sh
cd projects/<project-name>

# initial deployment
fly launch

# attach our service to our postgres instance
fly pg attach vers-pg --database-name=vers

# create secrets if needed
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) HONEYPOT_SECRET=$(openssl rand -hex 32)

# setting jwt signing secrets
fly secrets set --app=vers-<project-name> JWT_SIGNING_PRIVKEY=- < privkey.pem
```

## development with agents

See [AGENTS.md](AGENTS.md) for agent guidelines (generated from `agents/shared.md` and
`agents/project.md` — edit the partials, never `AGENTS.md` itself).
