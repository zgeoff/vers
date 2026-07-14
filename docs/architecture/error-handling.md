# Error handling

How failures are classified, declared, transported, retried, reported, and traced across the
services and app-web.

## Taxonomy

Every failure is exactly one of three classes, and the class decides everything downstream — status
range, retry policy, and whether it reaches the error backend.

| Class                    | What it is                                                    | Mechanism                                | Status | Reported |
| ------------------------ | ------------------------------------------------------------- | ---------------------------------------- | ------ | -------- |
| **Domain error**         | An outcome the contract anticipates; the caller can act on it | `opts.errors.<CODE>({ data })`           | 4xx    | never    |
| **Invariant violation**  | A state only a bug can produce                                | `invariant(value, 'message')` or `throw` | 500    | always   |
| **Infrastructure fault** | A dependency failing — database down, upstream timeout        | escapes the handler uncaught             | 5xx    | always   |

The enforcement rule that makes the taxonomy mechanical: **a procedure handler throws only its typed
`opts.errors.*` constructors or `invariant()`**. Anything else that escapes is class 2 or 3 by
definition and is handled centrally — handlers contain no try/catch for logging or reporting.

A condition real input can trigger is never an invariant: it is either a declared domain error or
ordinary control flow.

## Error codes

Codes come in two kinds:

- **Canonical codes** — oRPC's built-in vocabulary (`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`,
  `NOT_FOUND`, `CONFLICT`, `TOO_MANY_REQUESTS`, …), each with a built-in HTTP status. The default
  choice: reach for a bespoke code only when the client acts differently on it than it would on the
  nearest canonical code.
- **Bespoke codes** — domain-specific, named `NOUN_PROBLEM` (`RESET_TOKEN_EXPIRED`,
  `CODE_ALREADY_USED`), each declaring an explicit HTTP status. oRPC's wire layer answers 500 for a
  code it doesn't recognize and no status declared — the omission reads as a server fault.

Every `.errors({…})` map is built with `defineErrors` (`@vers/contract-base`), which makes that
policy compile-checked: a bespoke code without `status` and a canonical code restating its built-in
status are both type errors.

`data` carries the machine-readable specifics a client needs to act — a `field` discriminant on a
conflict, a `reason` on an auth failure. Fields are for narrowing and rendering, never freetext;
clients narrow on `code` (via `isDefinedError`/`safe`) and `data`, never on `message` strings.

### Registry

Every bespoke code in the system, its status, and its meaning. A new bespoke code lands with its row
added here in the same PR.

Status assignment follows the failure's nature:

- **410 Gone** — a well-formed value the state no longer accepts (expired, already used).
- **422 Unprocessable Content** — a value that was never acceptable.
- **401 Unauthorized** — a failure of authentication state.
- **409 Conflict** — an operation whose precondition the resource's current state contradicts.

| Domain       | Code                   | Status | Meaning                                                                                                                                                       | data                       |
| ------------ | ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| activity     | `ACTIVITY_CAPPED`      | 409    | Append exceeds the avatar's accrued offline-progress budget — the activity lands terminal `capped`; the client resyncs and rebases at the returned stop index | `{ appendedHead }`         |
| activity     | `ACTIVITY_TERMINAL`    | 409    | Append against a terminal activity status — fatal for the stream, the client discards                                                                         | `{ status, appendedHead }` |
| activity     | `CHAIN_QUARANTINED`    | 409    | New start refused while the chain's replay frontier is quarantined                                                                                            | —                          |
| activity     | `CHECKPOINT_INVALID`   | 422    | Checkpoint batch fails structural validation (contiguity, chainIndex, chain link, time monotonicity, or hash)                                                 | `{ reason }`               |
| activity     | `SESSION_EVICTED`      | 403    | Append from a session that is no longer the activity's writer — fatal, the client discards                                                                    | —                          |
| activity     | `SIM_VERSION_EXPIRED`  | 410    | Stamped or current sim version is past retention — the client must resync onto the current version                                                            | `{ currentSimVersion }`    |
| activity     | `SIM_VERSION_UNKNOWN`  | 409    | Stamped or current sim version isn't registered — the client should refresh and retry                                                                         | `{ currentSimVersion }`    |
| replay       | `SIM_VERSION_MISMATCH` | 409    | Request `simVersion` doesn't match this provider's baked engine hash — a dispatch misroute guard                                                              | `{ providerSimVersion }`   |
| user         | `INVALID_RESET_TOKEN`  | 422    | Reset token doesn't match the one on record                                                                                                                   | —                          |
| user         | `PASSWORD_NOT_SET`     | 409    | Operation presumes a password; the account has none                                                                                                           | —                          |
| user         | `RESET_TOKEN_EXPIRED`  | 410    | Reset token was valid but its window has passed                                                                                                               | —                          |
| session      | `REFRESH_TOKEN_REUSED` | 401    | Refresh token replayed — rotation-theft signal, session revoked                                                                                               | —                          |
| session      | `SESSION_EXPIRED`      | 401    | Session exists but its lifetime has passed                                                                                                                    | —                          |
| session      | `TRANSACTION_MISMATCH` | 422    | Step-up consume request doesn't match the pending transaction                                                                                                 | `{ field }`                |
| verification | `CODE_ALREADY_USED`    | 410    | One-time code already consumed                                                                                                                                | —                          |
| verification | `CODE_EXPIRED`         | 410    | Code was valid but its window has passed                                                                                                                      | —                          |
| verification | `INVALID_CODE`         | 422    | Code doesn't verify against the secret                                                                                                                        | —                          |

## Service layer

`createService` (`@vers/service-runtime`) owns the whole failure path outside handler bodies:

- **Trust boundary.** An invalid s2s token short-circuits with a plain 401 before any oRPC handler
  runs; the response is not contract-shaped by design (docs/architecture/service-contracts.md).
- **Central error interceptor.** One `onError` client-interceptor on the RPC handler classifies
  everything a procedure throws: a defined contract error or any 4xx passes through untouched — no
  log, no report, it's the caller's outcome. Everything else is logged at error level with the trace
  id and captured to the error backend, then encoded by oRPC as a bare `INTERNAL_SERVER_ERROR` —
  internals never reach the wire.
- **Wire protocol.** Services speak the oRPC RPC protocol at `/rpc` only. Contracts keep their
  `.route()` metadata and stay OpenAPI-generatable (the conformance suite asserts this), but no
  OpenAPI endpoint is served.

## Reporting

The Sentry SDK (backed by the self-hosted Bugsink) is the **only** path to the error backend; pino
is a log-only sink. This split is what keeps one error from shipping twice, so never wire a log
transport to the error backend and never `captureException` in code the central hooks already cover.

What reports, by tier:

| Tier           | Hook                                     | Reports                                                                                                                  |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| service        | `onError` interceptor in `createService` | non-`ORPCError` throws and 5xx `ORPCError`s                                                                              |
| app-web client | `QueryCache`/`MutationCache` `onError`   | non-`ORPCError` failures (network, client bugs) — service errors were already reported by the service that produced them |
| app-web render | root route `errorComponent`              | render/loader errors nothing below caught                                                                                |

Every service report carries the request's trace id as a `traceID` event tag.

## Trace context

One W3C trace id follows a request from the browser through app-web into whichever service it lands
on, and appears in three places: every pino log line the request writes (an
`AsyncLocalStorage`-backed mixin), the Bugsink event if one fires, and the `x-trace-id` header on
every service response. A trace id from an error screen or a support report greps straight to the
logs and the event.

- The browser mints a fresh `traceparent` per RPC call (`createTraceparent`, app-web).
- app-web's server-side service links continue the ambient request's trace when it carries one and
  start a fresh trace otherwise; the browser-lane RPC proxy forwards headers wholesale, so browser
  traces pass through untouched.
- Services parse inbound `traceparent`, mint their hop's span id, and run the whole request inside
  `withTraceContext` (`@vers/service-utils`), which is what the pino mixin and Sentry tag read.

The primitives (`parseTraceparent`, `buildTraceparent`, `createTraceContext`, `withTraceContext`,
`findTraceContext`) live in `@vers/service-utils` and speak the frozen W3C format, so anything
OpenTelemetry-instrumented interoperates at the header level.

## app-web

- **Server functions** signal errors three ways, by kind: a thrown `redirect()`/`Response` for
  navigation and access control; Conform's `submission.reply()` return value for form validation; a
  thrown error for genuine faults, caught by the nearest route `errorComponent`. Field-level
  validation is never a thrown error.
- **Route error boundaries.** The root route mounts `RootErrorScreen` as the last-resort boundary;
  routes with a meaningful degraded state mount their own `errorComponent` beneath it.
- **Retry policy** lives in one place — `buildQueryClient`: 4xx and defined service errors never
  retry (retrying can't change the outcome); network failures and 5xx retry twice. Per-query `retry`
  overrides need a behavioural reason the default policy can't express.
