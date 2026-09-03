# Service Contracts

Every service exposes its API through a contract package: a standalone declaration of the service's
operations that holds no implementation. The service implements the contract; every caller
constructs a typed client from it, and neither imports the other. A contract describes what a caller
can receive, never what the service emits internally.

## Contract-first

A contract package declares, for one service, every operation it exposes: route, input/output
schemas, and the errors a caller can receive. It contains no implementation. Both sides derive from
it. The service implements it through oRPC's `implement()`, so an implementation that drifts from
the declaration fails typecheck. Clients construct a fully typed client from the contract alone,
without importing service code. The dependency is inverted: service and callers both depend on the
contract, neither on each other.

## The packages

| Package                    | Folder                         | Depended on by                    |
| -------------------------- | ------------------------------ | --------------------------------- |
| `@vers/contract-<service>` | `contracts/<service>`          | that service and the web app      |
| `@vers/contract-base`      | `contracts/base`               | contract packages and the web app |
| `@vers/service-runtime`    | `libs/service/service-runtime` | services only                     |

A `@vers/contract-<service>` package holds one service's API declaration. `@vers/contract-base`
holds the standard error set and the base route builders every contract shares. The service runtime
(`@vers/service-runtime`) holds the Elysia app every service composes.

Why one contract package per service rather than a single `@vers/contracts` with subpath exports:

- **Precise affected detection.** The task graph invalidates work at package granularity. With one
  shared package, every contract edit would re-run CI for every service; per-service packages re-run
  only the true consumers.
- **Coupling stays visible.** Inside one package, a contract borrowing another service's schema is
  an innocuous relative import that nothing flags. Across packages, it is an explicit dependency
  edit in `package.json`, reviewable, and the dependency graph stays honest.
- **Ownership is crisp.** "A service owns its API" maps one-to-one to "a service's PR owns its
  contract package."

## Anatomy of a contract package

Contract packages are private, unversioned, and unbuilt: `exports` points straight at TypeScript
source.

```json
{
  "name": "@vers/contract-user",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@orpc/contract": "…", "zod": "…" }
}
```

No build step, no `.d.ts` emit, no version drift: consumers typecheck against the live source, so a
breaking change fails the consumer's typecheck in the same commit that made it.

Each procedure is a declaration chain of route, schemas, and errors:

```ts
getCurrentUser: authedRoute
  .route({ method: 'GET', path: '/users/me', summary: 'Get the currently authenticated user' })
  .input(z.object({}))
  .output(UserDataSchema),
```

`authedRoute` comes from `@vers/contract-base`: it is the plain `oc` builder with the standard error
set pre-declared, so every authenticated procedure shares one error vocabulary without re-declaring
it. Procedure-specific errors (`NOT_FOUND`, `CONFLICT`, …) are declared in the contract that owns
them. Entity schemas live in the contract package that owns the entity, not in a shared types
package, even at some duplication cost: sharing entity schemas across contracts would couple
services through the back door.

Schemas are zod schemas, so every contract depends on `zod`. It is referenced through the workspace
catalog (`catalog:`) like every external dependency, and the catalog resolves it to zod 4.

## The service side

The service implements the contract through oRPC's `implement()`:

```ts
const os = implement(userContract).$context<ServiceContext>();

const getCurrentUser = os.getCurrentUser.handler(({ context, errors }) => {
  if (context.actingUserID === null) {
    throw errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }
  // …
});
```

Every handler is typechecked against its declaration: inputs, outputs, and error payloads. The oRPC
router mounts on Elysia at `/rpc` and serves no other path. That path speaks the oRPC RPC protocol
every typed client uses.

The service runtime wraps the handlers. One `createService(...)` call composes its Elysia plugins:
env validation, service-to-service (s2s) token verification ahead of the handler, health checks,
trace-context propagation, and optional Sentry and OpenTelemetry wiring. A new service is a contract
package, handlers, and one `createService` call.

## The client side

Clients are typed by a single annotation against the contract:

```ts
export const userClient: ContractRouterClient<typeof userContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('user', userContract));
```

In app-web the link is isomorphic (`buildServiceLink`). On the server it mints a short-lived s2s
token for the target service and attaches it ([auth](./auth.md#service-to-service-tokens)). Every
attempt the server link makes is bounded, and a GET or HEAD procedure is resent under the
[retry policy](./error-handling.md#retry-policy). In the browser it routes through the app's
same-origin `/api/rpc/$service` proxy, so the session cookie rides along, since services are not
reachable outside the private mesh ([overview](../overview.md)).

## Errors and the trust boundary

Authentication fails in two classes, kept deliberately separate, and only one is a contract error.

- **A bad session is a contract error.** The session is missing or expired. That is the caller's own
  problem, which the caller can act on by signing in again. It is `UNAUTHORIZED` with a typed
  `data.reason` of `missing-session` or `expired-session`, declared once in `@vers/contract-base`.
- **A bad s2s token is not.** Services accept only a short-lived token from a registered issuer,
  naming the acting user when the call has one ([auth](./auth.md#service-to-service-tokens)). A
  token that fails verification means something is misconfigured or someone is probing, never
  something a browser user can fix. The service runtime rejects it with a plain 401 before any
  handler runs, and the edge reports it as a 5xx with alerting
  ([error handling](./error-handling.md#service-layer)).

Services never see cookies ([auth](./auth.md)). Identity reaches a handler as the verified token's
claims:

```ts
interface ServiceContext {
  actingSessionID: null | string;
  actingUserID: null | string; // null = verified anonymous call
  logger: pino.Logger;
  traceID: string;
}
```

`actingUserID` and `actingSessionID` come from the verified token. `logger` and `traceID` are the
runtime's per-request infrastructure ([error handling](./error-handling.md#trace-context)).

When a session expires, the edge itself replies with the contract-shaped
`UNAUTHORIZED { reason: 'expired-session' }` without calling the service at all. Services themselves
only ever throw `missing-session`, as defense in depth when a caller reaches an authed procedure
without an acting user. The shared enum is caller-facing vocabulary, not an inventory of who throws
what.

`FORBIDDEN` is declared with an empty `data` payload: no permission model exists, and any fields a
permission model needs arrive additively.

## Change discipline

Contracts are unversioned, so the rule is **additive-first**: new procedures, new optional fields,
and new error variants are always safe. A breaking change is permitted only when every consumer is
fixed in the same commit. Because consumers typecheck against contract source, CI enforces exactly
that. There is no deprecation window to manage and no version matrix; the monorepo is the
compatibility mechanism.

## Testing

Two layers cover a contract, per the repo's mock-free testing rules:

- **Conformance** (generic, one call per service). `collectConformanceCases` (`@vers/test-utils`)
  walks a contract and runs the mechanical cases every procedure must satisfy against the real
  Elysia app in-process via `app.handle(request)`, with no network and no mocks. The app rejects
  malformed input with `BAD_REQUEST`, rejects an anonymous call to an authed procedure with
  `UNAUTHORIZED { reason: 'missing-session' }`, and generates a valid OpenAPI document from the
  contract.
- **Behavioural** (hand-written, per service): what the service actually does, with test data
  declared inline.

## Known gotchas

- Any package consuming a contract-typed client needs `@orpc/contract` as a **direct** dependency
  (for `ContractRouterClient`). Under strict dependency isolation the failure mode is a type-error
  cascade, not a missing-module error.
- Elysia mounts for oRPC handlers need `{ parse: 'none' }`, or Elysia's body parser consumes the
  request before oRPC can read it.
- SSR dehydration of an errored query redacts `ORPCError` to a plain `Error`, losing the `code` and
  `data`. When an error state must survive SSR, fold it into a result union with oRPC's `safe()`
  inside a server function. An auth error instead throws `redirect()`
  ([error handling](./error-handling.md#app-web)).
- `RPCLink` has no default type parameter: annotate `RPCLink<Record<never, never>>` or let inference
  run end-to-end.
