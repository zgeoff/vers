---
name: verifier-service-socket
description:
  Boot a vers domain service as a real process and drive its RPC endpoints over HTTP — for changes
  the in-process test client bypasses (serve entrypoint, env wiring, transport middleware, error
  serialization, trace propagation).
---

# Verifying a domain service at its socket

This skill boots one domain service as a real process against a clone of the test database, mints
throwaway service tokens, and drives its RPC endpoints over HTTP.

- [When to reach for this](#when-to-reach-for-this): only for what the in-process test client never
  executes.
- [Database](#database): clone the migrated test template, and point the service at a database that
  accepts connections.
- [Credentials](#credentials): a token's issuer must equal its `kid` and be a registered issuer.
- [Boot and drive](#boot-and-drive): run `src/serve.ts` with the three env values, and call
  `POST /rpc/<procedure>`.

## When to reach for this

The bun test suites boot the real service factory against a real postgres and call procedures
through [`buildRPCTestClient`](../../../libs/testing/test-utils/src/build-rpc-test-client.ts) with
real token verification, so procedure logic, auth, and declared errors are verified there. Socket
verification covers what that in-process client never executes:

- the `src/serve.ts` entrypoint (such as
  [the avatar service's](../../../services/avatar/src/serve.ts)) and its env wiring (`DATABASE_URL`,
  `SERVICE_AUTH_JWKS`, `PORT`) and `GET /health`
- wire-format contracts: the serialized error envelope, `x-trace-id` response headers, `traceparent`
  continuity
- per-request side effects of the central `onError` interceptor (Sentry reporting, pino output)
- connection-phase database behaviour

For procedure and business-logic changes, the test suite is the verification — skip this pass.

## Database

Boot recipe that works with only the pg test container running (`bun run pg:test-container:start`;
container publishes 5432 on a random port — find it with `docker ps`, credentials `test:test`,
template database `test_template`).

Clone the migrated template instead of standing up the dev stack:

```sh
docker exec <container> psql -U test -d postgres -c "CREATE DATABASE verify_db TEMPLATE test_template"
```

Seed rows with `docker exec <container> psql -U test -d verify_db -c "INSERT …"`. Drop the clone
when done.

**Gotcha:** an unreachable database or a connection-phase failure (bad database name, wrong port)
crashes the service process via an error-path bug in the `postgres` driver (`query.origin.replace`
on undefined, in its `connection.js`) instead of rejecting the query — point the service at a
database that accepts connections.

## Credentials

Services validate s2s tokens against `SERVICE_AUTH_JWKS` — a JSON key set holding each minting
issuer's public key under an issuer-named `kid` (`app-web`, `service-activity`, `service-replay`).
Mint a throwaway keypair + tokens with a scratchpad script using `jose`, the way the test helper
[`createServiceToken`](../../../libs/testing/service-test-utils/src/bun/create-service-token.ts)
does: `generateKeyPair('EdDSA')` → `exportJWK`, wrap as `{"keys":[{...jwk, kid: "app-web"}]}`, then
`SignJWT` with protected header `{ alg: 'EdDSA', kid: 'app-web' }`, issuer equal to the `kid`,
audience = service name (`service-user`), and `sub` for an acting user (omit `sub` for anonymous).
The service rejects a token with a 401 when its `iss` isn't a registered issuer, doesn't equal its
`kid`, or a different issuer's key signs it.

## Boot and drive

```sh
cd services/<name>
DATABASE_URL="postgresql://test:test@127.0.0.1:<port>/verify_db" PORT=3399 \
  SERVICE_AUTH_JWKS="$(jq -r .jwks creds.json)" bun src/serve.ts &
```

Endpoints: `GET /health` (no token), `POST /rpc/<procedure>` with `authorization: Bearer <token>`,
`content-type: application/json`, body `{"json":<input>}`. Responses carry `x-trace-id`; send a
`traceparent` header to assert trace continuity. Error bodies are
`{"json":{"defined":…,"code":…,"status":…,…}}`.
