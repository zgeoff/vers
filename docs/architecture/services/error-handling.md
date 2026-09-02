# Error handling

Every failure in the fleet is classified, declared, transported, retried, reported, and traced by
one set of rules, uniform across the services, app-web, and the idle worker. The spine is a
three-class taxonomy: a domain error the caller acts on, an invariant violation only a bug produces,
or an infrastructure fault. Handler bodies stay thin. A handler explicitly throws only its typed
domain errors or an invariant, and lets any other exception propagate to central machinery, which
classifies, reports, and encodes it.

## Taxonomy

Every failure is exactly one of three classes, and the class decides everything downstream: status
range, retry policy, and whether it reaches the error backend.

| Class                    | What it is                                                    | Mechanism                                | Status | Reported |
| ------------------------ | ------------------------------------------------------------- | ---------------------------------------- | ------ | -------- |
| **Domain error**         | An outcome the contract anticipates; the caller can act on it | `opts.errors.<CODE>({ data })`           | 4xx    | never    |
| **Invariant violation**  | A state only a bug can produce                                | `invariant(value, 'message')` or `throw` | 500    | always   |
| **Infrastructure fault** | A dependency failing — database down, upstream timeout        | escapes the handler uncaught             | 5xx    | always   |

One enforcement rule makes the taxonomy mechanical: a procedure handler throws only its typed
`opts.errors.*` constructors or `invariant()`. Anything else that escapes is an invariant violation
or an infrastructure fault by definition, classified centrally. Handlers contain no try/catch for
logging or reporting.

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
  code it doesn't recognize with no status declared. The omission reads as a server fault.

Every `.errors({…})` map is built with `defineErrors` (`@vers/contract-base`), which makes that
policy compile-checked: a bespoke code without `status` and a canonical code restating its built-in
status are both type errors.

`data` carries the machine-readable specifics a client needs to act: a `field` discriminant on a
conflict, a `reason` on an auth failure. Fields are for narrowing and rendering, never freetext.
Clients narrow on `code` (via `isDefinedError`/`safe`) and `data`, never on `message` strings.

### Registry

This table lists every bespoke code in the system, its status, and its meaning. A new bespoke code
lands with its row in this table in the same PR.

Status assignment follows the failure's nature:

- **410 Gone** — a well-formed value the state no longer accepts (expired, already used).
- **422 Unprocessable Content** — a value that was never acceptable.
- **401 Unauthorized** — a failure of authentication state.
- **403 Forbidden** — a caller authentication accepts but the resource's access rule refuses.
- **404 Not Found** — a reference to a resource that doesn't exist.
- **409 Conflict** — an operation whose precondition the resource's current state contradicts.

Every activity code applies to the `advanceActivity` ingest path, an activity start or a
continuation, as well as to the single call its meaning names. No request-path check rejects an
unreachable node: reachability is adjudicated at replay. An append error's `data` carries
`activityID`, naming the request's last fully committed row. It also carries `appendedHead` where
the single-call `data` omits it. An activity code also tells a device whether to keep the pending
activity start it just submitted or drop it;
[the seed chain](../game/seed-chain.md#handing-an-activity-start-to-the-server) owns that split.

| Domain       | Code                   | Status | Meaning                                                                                                                                      | data                                   |
| ------------ | ---------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| activity     | `ACTIVITY_CAPPED`      | 409    | Append exceeds the avatar's accrued offline budget; the activity lands terminal `capped`.                                                    | `{ appendedHead }`                     |
| activity     | `ACTIVITY_TERMINAL`    | 409    | Append against a terminal activity status; fatal for the stream.                                                                             | `{ status, appendedHead }`             |
| activity     | `AVATAR_NOT_ACTIVE`    | 409    | Start admission or reveal refused: the acting avatar is not the account's active one.                                                        | `{ activeAvatarID, activeAvatarName }` |
| activity     | `CHAIN_QUARANTINED`    | 409    | New start or continuation refused while the chain is quarantined.                                                                            | —                                      |
| activity     | `CHECKPOINT_INVALID`   | 422    | Checkpoint batch fails structural or cross-check validation; `reason` names the failed check.                                                | `{ reason }`                           |
| activity     | `NODE_NOT_REVEALED`    | 409    | Scope has no chain row — `revealNodes` was never called for it.                                                                              | —                                      |
| activity     | `NODE_UNKNOWN`         | 404    | Scope id doesn't resolve to a node on the current world map.                                                                                 | —                                      |
| activity     | `SESSION_EVICTED`      | 403    | Append or stop from a session that is no longer the activity's writer; fatal for that stream.                                                | —                                      |
| activity     | `SIM_VERSION_EXPIRED`  | 410    | Stamped or current sim version is past retention, or its engine trails the content the activity would stamp.                                 | `{ currentSimVersion }`                |
| activity     | `SIM_VERSION_UNKNOWN`  | 409    | Stamped or current sim version isn't registered; on a pinned hash the client retries once without it, landing on the registry-current stamp. | `{ currentSimVersion }`                |
| avatar       | `LIMIT_REACHED`        | 409    | Avatar creation refused: the account already holds the cap of avatars for the requested mode.                                                | `{ cap, mode }`                        |
| replay       | `SIM_VERSION_MISMATCH` | 409    | Request `simVersion` doesn't match this provider's baked engine hash; a dispatch misroute guard.                                             | `{ providerSimVersion }`               |
| user         | `INVALID_RESET_TOKEN`  | 422    | Reset token doesn't match the one on record.                                                                                                 | —                                      |
| user         | `PASSWORD_NOT_SET`     | 409    | Operation presumes a password; the account has none.                                                                                         | —                                      |
| user         | `RESET_TOKEN_EXPIRED`  | 410    | Reset token was valid but its window has passed.                                                                                             | —                                      |
| session      | `REFRESH_TOKEN_REUSED` | 401    | Refresh token replayed — rotation-theft signal, session revoked.                                                                             | —                                      |
| session      | `SESSION_EXPIRED`      | 401    | Session exists but its lifetime has passed.                                                                                                  | —                                      |
| session      | `TRANSACTION_MISMATCH` | 422    | Step-up consume request doesn't match the pending transaction.                                                                               | `{ field }`                            |
| verification | `CODE_ALREADY_USED`    | 410    | One-time code already consumed.                                                                                                              | —                                      |
| verification | `CODE_EXPIRED`         | 410    | Code was valid but its window has passed.                                                                                                    | —                                      |
| verification | `INVALID_CODE`         | 422    | Code doesn't verify against the secret.                                                                                                      | —                                      |

`CHECKPOINT_INVALID`'s `reason` is a closed enum, `CheckpointInvalidReasonSchema`, naming the
structural check a batch failed. On `advanceActivity`, `AdvanceCheckpointInvalidReasonSchema`
extends it with the start-admission checks: the predicted build snapshot and the recomputed start
hash. A client narrows on the value rather than matching a string.

## Service layer

`createService` (`@vers/service-runtime`) owns the whole failure path outside handler bodies:

- **Trust boundary.** An invalid service-to-service (s2s) token short-circuits with a plain 401
  before any oRPC handler runs. The response is not contract-shaped by design
  ([service contracts](./service-contracts.md)).
- **Central error interceptor.** One `onError` client-interceptor on the RPC handler classifies
  everything a procedure throws. A defined contract error or any 4xx passes through untouched: no
  log, no report, it is the caller's outcome. For everything else, the interceptor logs at error
  level with the trace id, captures it to the error backend, then oRPC encodes it as a bare
  `INTERNAL_SERVER_ERROR`. Internals never reach the wire.
- **Wire protocol.** Services speak the oRPC RPC protocol at `/rpc` only. Contracts keep their
  `.route()` metadata and stay OpenAPI-generatable, which the conformance suite asserts. Services
  serve no OpenAPI endpoint.

## Reporting

Error reports and logs travel two separate paths. The Sentry SDK, backed by the self-hosted Bugsink,
is the only path to the error backend. pino is a log-only sink. Keeping them apart stops one error
from shipping twice: never wire a log transport to the error backend, and never `captureException`
in code the central hooks already cover.

The service runtime (`@vers/service-runtime`) owns the one path a service takes to the error
backend, through three functions:

- `startErrorReporting` initializes the SDK from `SENTRY_DSN`, a no-op when it's undefined.
- `reportUnexpectedError` captures a failure tagged with the active trace id.
- `flushErrorReports` awaits delivery before a process exits.

The RPC `onError` interceptor calls `reportUnexpectedError` directly. So does every background
swallow point: a worker loop iteration, a job queue's `onError` and dead-letter callbacks, a
fire-and-forget drain, a sweep entrypoint, a shutdown handler. A process that never calls
`createService` (a sweep entrypoint) calls `startErrorReporting` itself before its run.

Reporting happens at four tiers, each with its own hook:

- **Service** — the `onError` interceptor in `createService`, and `reportUnexpectedError` at every
  background swallow point. Reports non-`ORPCError` throws and 5xx `ORPCError`s from a request, and
  any unexpected failure from a worker loop, job queue, drain, or sweep run.
- **app-web client** — the `QueryCache`/`MutationCache` `onError`. Reports non-`ORPCError` failures
  (network, client bugs); service errors were already reported by the service that produced them.
- **app-web render** — the root route `errorComponent`. Reports render and loader errors nothing
  below caught.
- **idle worker** — `reportWorkerFault` at each swallow point, plus the SDK's default global
  handlers. Reports the failures the worker otherwise swallows, one `site` per swallow point.

The idle SharedWorker (`@vers/idle-client`) runs its own SDK instance. `startErrorReporting`
initializes `@sentry/browser` inside the worker scope from `VITE_SENTRY_DSN`, a no-op when it's
undefined, so capture works with every tab closed. `reportWorkerFault` tags each event with a `site`
tag from the closed `WorkerFaultSite` union, naming the swallow point that caught it. The SDK's
default global handlers net any throw those sites miss. Capture never changes the worker's failure
behaviour: a failed resync still folds to an offline status, and a tick-loop crash still stops the
loop. Restarting a simulation that throws deterministically would resubmit the same crash every
tick.

A service report carries a `traceID` event tag when the capture runs inside an active trace scope. A
report emitted outside any scope omits the tag, as does every app-web capture. The RPC interceptor
tags with the request's trace id. A background report (one worker iteration, one job's
handle/complete/fail cycle, a boot drain, one sweep run) carries a fresh trace id scoping that unit
of work. One exception: a request-triggered fire-and-forget drain inherits the originating request's
trace. The RPC path reports exactly once per unexpected throw.

## Trace context

One W3C trace id follows a request from the browser through app-web into whichever service it lands
on, and shows up in three places: every pino log line the request writes, the Bugsink event if one
fires, and the `x-trace-id` header on every service response. Grepping a trace id from an error
screen or a support report finds it directly in the logs and the event. How the id is minted,
propagated across hops, and stamped onto spans, log lines, and the response header is telemetry the
[observability](../platform/observability.md#traces) doc owns.

## app-web

- **Server functions.** Errors signal three ways, by kind:
  - a thrown `redirect()`/`Response` for navigation and access control;
  - Conform's `submission.reply()` return value for form validation;
  - a thrown error for genuine faults, caught by the nearest route `errorComponent`.

  Field-level validation is never a thrown error.

- **Route error boundaries.** The root route mounts `RootErrorScreen` as the last-resort boundary.
  Routes with a meaningful degraded state mount their own `errorComponent` beneath it.

### Retry policy

Three lanes carry outbound HTTP traffic between the browser and the services, each owning its own
retry.

The query client (`buildQueryClient`) owns retry for every call the browser makes through it. 4xx
and defined service errors never retry, since retrying can't change the outcome; network failures
and 5xx retry twice. A per-query `retry` override needs a behavioural reason the default policy
can't express.

A server function's direct service-client call bypasses the query client. Its service link
(`buildServiceLink`) bounds each attempt to a short per-attempt timeout and retries the procedures
the contract declares GET or HEAD; every other procedure gets a single bounded attempt with no
retry.

The browser's call through the `/api/rpc/$service` proxy gets a single bounded attempt with no
retry: the query client owns retry for that path.
