# Error handling

The services, the web app, and the idle worker share one set of rules for every failure in the
fleet: its class, its status, and whether it reaches the error backend. Each failure is a domain
error the caller acts on, an invariant violation only a bug produces, or an infrastructure fault. A
handler throws only its typed domain errors or an invariant and lets any other exception propagate
to central machinery, which classifies, reports, and encodes it.

## Taxonomy

Every failure is exactly one of three classes. The class decides its status range and whether it
reaches the error backend, and whether it may retry: only an infrastructure fault retries, and only
on a call that can be resent ([retry policy](#retry-policy)). The one exception to the Reported
column is a domain error that a web app server function lets escape ([reporting](#reporting)).

| Class                    | What it is                                                           | Mechanism                                | Status | Reported |
| ------------------------ | -------------------------------------------------------------------- | ---------------------------------------- | ------ | -------- |
| **Domain error**         | An outcome the contract anticipates; the caller can act on it        | `opts.errors.<CODE>({ data })`           | 4xx    | never    |
| **Invariant violation**  | A state only a bug can produce                                       | `invariant(value, 'message')` or `throw` | 500    | always   |
| **Infrastructure fault** | A dependency failing, such as a database down or an upstream timeout | escapes the handler uncaught             | 5xx    | always   |

A procedure handler throws only its typed `opts.errors.*` constructors, `invariant()`, or a bare
`throw` for a state only a bug can produce. Anything else that escapes, other than a 4xx, is an
invariant violation or an infrastructure fault by definition, classified centrally, and handlers
contain no try/catch for logging or reporting. The central interceptor treats any 4xx as the
caller's outcome and never reports it, whatever threw it ([service layer](#service-layer)). A
condition real input can trigger is never an invariant: it is either a declared domain error or
ordinary control flow.

## Error codes

Codes come in two kinds. Canonical codes are oRPC's built-in vocabulary, each with a built-in HTTP
status, and they are the default: add a bespoke code only when the client acts differently on it
than on the nearest canonical code. Bespoke codes are domain-specific, named `NOUN_PROBLEM`, and
each declares an explicit HTTP status, because oRPC answers 500 for a code it does not recognize
with no status declared. Build every contract error map with `defineErrors`, which makes that policy
compile-checked: a bespoke code without a status and a canonical code restating its built-in status
are both type errors. The contract that declares a code is its registry. The code's status, message,
and `data` schema live in its `defineErrors` map, and a grep for `defineErrors` finds every one.

Pick the status from the failure's nature:

- 410 Gone: a well-formed value the state no longer accepts (expired, already used).
- 422 Unprocessable Content: a value that was never acceptable.
- 401 Unauthorized: a failure of authentication state.
- 403 Forbidden: a caller authentication accepts but the resource's access rule refuses.
- 404 Not Found: a reference to a resource that does not exist.
- 409 Conflict: an operation whose precondition the resource's current state contradicts.

`data` carries the machine-readable specifics a client needs to act: a discriminant on a conflict, a
reason on an auth failure. Fields are for narrowing and rendering, never freetext, and never a
secret or a submitted input, because the central interceptor logs a declared error's `data`. Clients
narrow on `code` and `data`, never on `message` strings, and a `reason` field is a closed enum, so a
client narrows on the value rather than matching a string.

An activity code has two readers. The single call whose meaning it names and the offline catch-up
call that admits a start or a continuation both answer it, and the device reads it to decide whether
to keep or drop the pending activity start it just submitted
([seed chain](../game/seed-chain.md#handing-an-activity-start-to-the-server)). A request-path code
never rejects an unreachable node, because replay adjudicates reachability.

## Service layer

The service runtime owns the whole failure path outside handler bodies:

- Trust boundary. An invalid service-to-service token short-circuits with a plain 401 before any
  handler runs ([service contracts](./service-contracts.md#errors-and-the-trust-boundary)).
- Central error interceptor. One error interceptor on the RPC handler classifies everything a
  procedure throws. A defined contract error or any 4xx is the caller's outcome: the interceptor
  logs it at warn with its code and status, plus a defined error's `data`, and never reports it. The
  logged `data` lets refusals group in Axiom by its fields. For everything else, the interceptor
  logs at error level with the trace id, captures it to the error backend, then oRPC encodes it as a
  bare `INTERNAL_SERVER_ERROR`. Internals never reach the wire.
- Wire protocol. Services speak the oRPC RPC protocol at `/rpc` only
  ([service contracts](./service-contracts.md#the-service-side)).

## Reporting

Error reports and logs travel two separate paths. The Sentry SDK, backed by the self-hosted Bugsink,
is the only path to the error backend, and LogTape is a log-only sink. Keeping them apart stops one
error from shipping twice: never wire a log transport to the error backend, and never capture an
exception in code the central hooks already cover.

The service runtime owns the one path a service takes to the error backend: it initializes the SDK
from the DSN, a no-op when the DSN is unset, captures a failure tagged with the active trace id, and
flushes before a process exits. A process that never boots the service runtime initializes reporting
itself before its run. Each layer reports through its own hook:

- Service: the error interceptor for a request, and a capture call at any point that swallows an
  exception outside a request, such as a worker iteration or a queue callback.
- Web app server functions: the global function middleware reports every throw a server function
  lets escape other than a redirect, a not-found, or a `Response`, then rethrows it. That includes a
  service's domain error that a server function lets escape.
- Web app client: the query and mutation cache error hooks report failures that are not service
  errors, because a service error is either a domain error the caller owns or a fault the service
  already reported. A redirect, a not-found, and a network failure are outcomes, and the hooks leave
  them unreported.
- Web app render: the root route's error component reports render and loader errors nothing below
  caught.
- Idle worker: a capture call at each swallow point, tagged with the site that caught it, plus the
  SDK's default global handlers. Capture never changes the worker's failure behaviour.

A service report carries a trace id tag when the capture runs inside an active trace scope. The RPC
interceptor and the web app's server-function middleware tag with the request's trace id, and a
background report carries a fresh trace id scoping that unit of work. A request-triggered
fire-and-forget drain is the exception: it inherits the originating request's trace. The RPC path
reports exactly once per unexpected throw.

## Trace context

One W3C trace id follows a request from the browser through the web app into whichever service it
lands on, and shows up in three places: every log line the request writes, the Bugsink event if one
fires, and the `x-trace-id` header on every service response. Grepping a trace id from an error
screen or a support report finds it directly in the logs and the event. The
[observability](../platform/observability.md#traces) doc covers how the id is minted, propagated
across hops, and stamped onto spans, log lines, and the response header.

## app-web

Server functions signal each kind of error in its own way: a thrown redirect or `Response` for
navigation and access control, the form library's reply value for form validation, and a thrown
error for a genuine fault, which the server-function middleware reports. A loader's fault lands on
the nearest route error component, and a form submission's lands on the shared form-submit hook,
which renders `Something went wrong. Please try again.` Field-level validation is never a thrown
error. The root route mounts the last-resort error boundary, and a route with a meaningful degraded
state mounts its own beneath it. A request over its rate limit is answered with a 429 before it
reaches a route ([rate limits](./rate-limits.md)).

### Retry policy

Two owners retry outbound traffic between the browser and the services. The query client owns retry
for every query the browser makes through it: 4xx and defined service errors never retry, since
retrying cannot change the outcome, and network failures and 5xx retry a fixed number of times. A
mutation never retries. Override it per query only for a behavioural reason the default policy
cannot express. A game route gate is the exception: it never retries, because it falls back to its
last-known value on a network failure ([offline navigation](#offline-navigation)).

Every call the web app's server makes to a service runs one bounded-attempt policy: a server
function's direct client call, the RPC proxy forwarding a browser call, and the session lookups both
of those run first. A procedure whose contract declares it GET or HEAD is resent when an attempt
hits its bound, fails in transport, or is answered 5xx, and the bounds escalate so the last one
holds a cold-started machine's wake window open. Every other procedure gets one attempt bounded at
that same window, because a mutation cannot be resent. Attempts run with no pause between them,
because Fly's proxy holds the connection open while the machine starts. A last attempt answered 5xx
delivers that response to the caller. A last attempt that fails in transport or hits its bound
raises `SERVICE_UNAVAILABLE`, which the proxy answers as a 503, and the browser's query client
retries that 503 when it answers a query. The whole budget stays under the slow-request alarm
([observability](../platform/observability.md#alarms)).

### Offline navigation

A player whose game is loaded keeps moving between game screens with the network down, because each
route gate in the game falls back to the last value it read. The gates are the game layout's flag
read, its sign-in check and its QA-hook check, and each screen's active-avatar check. A screen whose
loader reads server content, such as the avatar panel, the account settings and the avatar roster,
falls back the same way. Each gate and each content read goes through the query cache, and the
server-side render seeds the cache, so the first navigation after a page load has a value to fall
back to. The browser's server-function fetch turns a request that got no response into a network
failure, and only a network failure takes the fallback. A redirect or any other error from a gate
propagates, so a signed-out player still lands on sign-in once the network returns.

A gate with no last-known value fails with the network failure. The game route's error component
then shows an offline notice whose retry reloads the routes, and it shows the root error screen for
any other error. The game layout also loads every game route's code chunk and each declared font
face when it mounts, because the browser otherwise fetches each one on first use and that fetch
fails offline. The play itself continues in the worker, as
[offline reconcile](../game/offline-reconcile.md) describes.
