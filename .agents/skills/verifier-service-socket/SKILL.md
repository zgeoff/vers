---
name: verifier-service-socket
description:
  Boots a vers domain service as a real process against a clone of the test database and drives its
  RPC endpoints over HTTP. Use it to check what the in-process test client skips, such as the serve
  entrypoint, env wiring, transport middleware, the serialized error envelope, trace headers, and
  the boot against the database.
---

# Verifying a domain service at its socket

Boot one domain service as a process, sign throwaway service tokens, and call its endpoints over
HTTP. Do this only for code the in-process test client never runs. The service suites already boot
the real service against Postgres and call it through
[`buildRPCTestClient`](../../../libs/testing/test-utils/src/build-rpc-test-client.ts), with real
token checks. For a change to a procedure's logic, its auth or its declared errors, the test suite
is the check, so skip this.

Check these at the socket:

- the `src/serve.ts` entrypoint, its env wiring and `GET /health`;
- the serialized error envelope, the `x-trace-id` response header and `traceparent` continuity;
- what the shared `onError` interceptor logs per request;
- that the service boots and answers `GET /health` once its database accepts connections.

Hand back each call you made, with its status, the headers you checked and the body, and say for
each check whether it passed. Watch for a database the service can't reach, which crashes it, and
for a token that expires between calls.

## Key rules

- [Commands](#commands): start the test container, clone the migrated template, sign tokens, boot,
  call, clean up.
- [Mistakes to avoid](#mistakes-to-avoid): give the service a database that accepts connections, and
  sign tokens that last the whole session.

## Commands

`bun run pg:test-container:start` starts Postgres on `localhost:32999`, with user `test` and
password `test`. It also creates the migrated template database for the current branch and prints
its name, `test_template_<branch>`. The script uses `TEST_DB_URI` in place of the default only while
something listens on `localhost:32999`. Otherwise it starts a new container on host port 32999 and
uses that.

| Step               | Command                                                                                                                                              | Needs                                                                                                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start Postgres     | `bun run pg:test-container:start`                                                                                                                    | Docker                                                                                                                                                                                                                                                                        |
| Clone the template | `docker exec <container> psql -U test -d postgres -c "CREATE DATABASE verify_db TEMPLATE <template>"`                                                | `<container>`: the container that `docker ps` shows on port 32999                                                                                                                                                                                                             |
| Seed a row         | `docker exec <container> psql -U test -d verify_db -c "INSERT …"`                                                                                    | the clone                                                                                                                                                                                                                                                                     |
| Sign tokens        | `bun sign.ts`, from `libs/testing/service-test-utils/`                                                                                               | a scratch `sign.ts` there that prints `jwksJSON` from [`createServiceKeyPair`](../../../libs/testing/service-test-utils/src/bun/create-service-key-pair.ts) and a token from [`createServiceToken`](../../../libs/testing/service-test-utils/src/bun/create-service-token.ts) |
| Boot               | `DATABASE_URL=postgresql://test:test@127.0.0.1:32999/verify_db PORT=3399 SERVICE_AUTH_JWKS='<jwksJSON>' bun src/serve.ts`, from `services/<name>/`   | the clone, and `jwksJSON`                                                                                                                                                                                                                                                     |
| Call               | `curl -i -X POST http://127.0.0.1:3399/rpc/<procedure> -H 'authorization: Bearer <token>' -H 'content-type: application/json' -d '{"json":<input>}'` | a token                                                                                                                                                                                                                                                                       |
| Clean up           | stop the service, delete `sign.ts`, then `docker exec <container> psql -U test -d postgres -c "DROP DATABASE verify_db"`                             | none                                                                                                                                                                                                                                                                          |

Run `sign.ts` from `libs/testing/service-test-utils/`, so its imports resolve. In it:

- Set `audience` to `service-<name>`, such as `service-user` for `services/user`.
- Set `actingUserID` for a call as a user. Leave it out for an anonymous call.
- Set `expiresIn: '1h'`.

`<procedure>` is the procedure's key in the service's contract, such as `getAvatar` in
[`avatar-contract.ts`](../../../contracts/avatar/src/avatar-contract.ts). `GET /health` needs no
token. Each service lists the env it reads in its `src/env-shape.ts`. Add any key beyond
`DATABASE_URL` to the boot command.

To check trace continuity, send a `traceparent` header and compare its trace ID, the second field,
with the response's `x-trace-id`. They match when the service continues the trace. A procedure's
error body has the shape `{"json":{"defined":…,"code":…,"status":…,…}}`. A token the service refuses
gets a plain body, such as `{"error":"issuer-not-permitted"}`.

## Mistakes to avoid

- **A database the service can't connect to crashes the process.** With a wrong database name or
  port, the `postgres` driver throws from its own error path, on `query.origin.replace` in its
  `connection.js`, and never rejects the query. When the service dies at boot, list the databases
  with `docker exec <container> psql -U test -d postgres -c '\l'`, and point `DATABASE_URL` at the
  clone.
- **A token expires after 60 s by default.** `createServiceToken` sets that default. Pass
  `expiresIn: '1h'` for a session of manual calls.
- **The service answers 401 for a token it can't verify.** Sign every token with the key pair whose
  `jwksJSON` the service booted with. `createServiceKeyPair` publishes its key under every issuer in
  `SERVICE_TOKEN_ISSUERS`, in
  [`token-claims.ts`](../../../libs/service/service-auth/src/token-claims.ts), so any issuer
  verifies.
- **The service answers 403 for an issuer it doesn't allow.** Each service lists the issuers it
  takes in the `allowedIssuers` of its `create-<name>-service.ts`, and `createServiceToken` defaults
  to `app-web`. Pass `issuer` to match, such as `service-activity` for `services/replay`.

**Reply:** each call with its status, the headers you checked and the body, and whether each check
passed.
