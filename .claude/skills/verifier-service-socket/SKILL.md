---
name: verifier-service-socket
description:
  Boot a vers domain service as a real process and drive its RPC endpoints over HTTP — for changes
  the in-process test client bypasses (serve entrypoint, env wiring, transport middleware, error
  serialization, trace propagation).
---

# Verifying a domain service at its socket

## When to reach for this

The bun test suites boot the real service factory against a real postgres and call procedures
through `buildRPCTestClient` with real token verification, so procedure logic, auth, and declared
errors are verified there. Socket verification covers what that in-process client never executes:

- the `src/serve.ts` entrypoint and its env wiring (`DATABASE_URL`, `SERVICE_AUTH_PUBLIC_KEY`,
  `PORT`) and `GET /health`
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
crashes the service process via a `postgres@3.4.5` error-path bug (`query.origin.replace` on
undefined) instead of rejecting the query — point the service at a database that accepts
connections.

## Credentials

Services validate s2s tokens against `SERVICE_AUTH_PUBLIC_KEY`. Mint a throwaway keypair + tokens
with a scratchpad script using `jose` and `TOKEN_ALGORITHM`/`TOKEN_ISSUER` from
`libs/service/service-auth/src/index.ts` (import by absolute path — scratchpad files can't resolve
workspace names): `generateKeyPair` → `exportSPKI`, then `SignJWT` with issuer, audience = service
name (`service-user`), and `sub` for an acting user (omit `sub` for anonymous).

## Boot and drive

```sh
cd services/<name>
DATABASE_URL="postgresql://test:test@127.0.0.1:<port>/verify_db" PORT=3399 \
  SERVICE_AUTH_PUBLIC_KEY="$(jq -r .publicKeyPEM creds.json)" bun src/serve.ts &
```

Endpoints: `GET /health` (no token), `POST /rpc/<procedure>` with `authorization: Bearer <token>`,
`content-type: application/json`, body `{"json":<input>}`. Responses carry `x-trace-id`; send a
`traceparent` header to assert trace continuity. Error bodies are
`{"json":{"defined":…,"code":…,"status":…,…}}`.
