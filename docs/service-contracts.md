# Service Contracts

How services expose their APIs, and how everything else calls them.

## Contract-first

A contract package declares, for one service, every operation it exposes — route, input/output
schemas, and the errors a caller can receive — and contains no implementation. Both sides derive
from it: the service implements it through oRPC's `implement()`, so an implementation that drifts
from the declaration fails typecheck; clients construct a fully typed client from the contract
alone, without importing service code. The dependency is inverted — service and callers both depend
on the contract, neither on each other.

## The packages

| Package                    | Folder                         | Contains                                                                                                                        | Depended on by                    |
| -------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `@vers/contract-<service>` | `contracts/<service>`          | one service's API declaration                                                                                                   | that service and the web app      |
| `@vers/contract-base`      | `contracts/base`               | standard error taxonomy, base builders, conformance-test helper                                                                 | contract packages and the web app |
| `@vers/service-runtime`    | `libs/service/service-runtime` | Elysia plugins every service composes: s2s token verification, health checks, OpenTelemetry, Sentry, request-id, env validation | services only                     |

Why one contract package per service rather than a single `@vers/contracts` with subpath exports:

- **Precise affected detection.** The task graph invalidates work at package granularity. With one
  shared package, every contract edit would re-run CI for every service; per-service packages re-run
  only the true consumers.
- **Coupling stays visible.** Inside one package, a contract borrowing another service's schema is
  an innocuous relative import that nothing flags. Across packages, it is an explicit dependency
  edit in `package.json` — reviewable, and the dependency graph stays honest.
- **Ownership is crisp.** "A service owns its API" maps one-to-one to "a service's PR owns its
  contract package."

The per-package boilerplate this creates is exactly what the service scaffold template amortizes.

Folder and package naming, repo-wide: **a package's name is `@vers/` plus its leaf folder name**
(`libs/core/utils` → `@vers/utils`, `apps/web` → `@vers/web`). Two roots drop a prefix the name
keeps: `services/user` → `@vers/service-user` and `contracts/user` → `@vers/contract-user`.

## Anatomy of a contract package

Contract packages are private, unversioned, and unbuilt: `exports` points straight at TypeScript
source:

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

Each procedure is a declaration chain — route, errors, schemas:

```ts
export const getCurrentUser = authedRoute
  .route({ method: 'GET', path: '/users/me', summary: 'Get the currently authenticated user' })
  .output(UserSchema);
```

`authedRoute` comes from `@vers/contract-base`: it is the plain `oc` builder with the standard error
set pre-declared, so every authenticated procedure shares one error vocabulary without re-declaring
it. Procedure-specific errors (`NOT_FOUND`, `CONFLICT`, …) are declared in the contract that owns
them. Entity schemas live in the contract package that owns the entity — not in a shared types
package, even at some duplication cost — because sharing entity schemas across contracts would
couple services through the back door.

Schemas are zod schemas, so every contract depends on `zod`, referenced through the workspace
catalog (`catalog:`) like every external dependency — the catalog resolves it to zod 4.

## The service side

The service implements the contract through oRPC's `implement()`:

```ts
const os = implement(userContract).$context<ServiceContext>();

const getCurrentUser = os.getCurrentUser.handler(({ context, errors }) => {
  if (context.actingUserId === null) {
    throw errors.UNAUTHORIZED({ data: { reason: 'missing-session' } });
  }
  // …
});
```

Every handler is typechecked against its declaration — inputs, outputs, and error payloads. The
router mounts on Elysia under `/rpc`, the RPC protocol typed clients speak, and serves no other
path.

`@vers/service-runtime` provides the shell around this — a `createService(...)` entry composing the
runtime's Elysia plugins — so a new service is a contract package, handlers, and one `createService`
call. The shell exports OpenTelemetry traces to Axiom.

## The client side

Clients are typed by a single annotation against the contract:

```ts
const client: ContractRouterClient<UserContract> = createORPCClient(link);
```

In the web app the link is isomorphic: during SSR it calls the service directly (forwarding the
caller's session headers); in the browser it goes through the app's `/api/rpc` proxy route, since
services are not reachable from the public internet.

## Errors and the trust boundary

Authentication has two distinct failure classes, kept deliberately separate:

1. **The user's session is bad** — missing or expired. This is the _caller's_ problem and the caller
   can act on it (sign in again). It is a contract error: `UNAUTHORIZED` with a typed `data.reason`
   of `missing-session` or `expired-session`, declared once in `@vers/contract-base`.
2. **The service-to-service token is bad.** Services only accept requests carrying a short-lived
   token minted at the edge, naming the acting user. If that token fails verification, something is
   misconfigured or someone is probing — never something a browser user can fix. This is _not_ a
   contract error: middleware in `@vers/service-runtime` rejects it with a plain 401 before any
   handler runs, and the edge reports it as a 5xx plus alerting.

Because the edge validates sessions and mints the token, services never see cookies. The handler
context is simply:

```ts
interface ServiceContext {
  actingUserId: string | null; // null = verified anonymous call
}
```

The contract describes what the **caller** can receive, not what the service emits. When a session
expires, the edge itself replies with the contract-shaped
`UNAUTHORIZED { reason: 'expired-session' }` without calling the service at all; services themselves
only ever throw `missing-session` (defense in depth, when an authed procedure is reached without an
acting user). The shared enum is caller-facing vocabulary, not an inventory of who throws what.

`FORBIDDEN` is declared with an empty `data` payload — no permission model exists, and any fields a
permission model needs arrive additively.

## Change discipline

Contracts are unversioned, so the rule is **additive-first**: new procedures, new optional fields,
and new error variants are always safe. A breaking change is permitted only when every consumer is
fixed in the same commit — and because consumers typecheck against contract source, CI enforces
exactly that. There is no deprecation window to manage and no version matrix; the monorepo _is_ the
compatibility mechanism.

## Testing

Two layers, per the repo's mock-free testing rules:

- **Conformance** (generic, free with the scaffold): a helper from `@vers/contract-base/test-utils`
  walks a contract against the real Elysia app in-process via `app.handle(request)` — no network, no
  mocks — and asserts the mechanical guarantees per procedure: malformed input is rejected, error
  payloads round-trip with their declared shape, and OpenAPI generation succeeds.
- **Behavioural** (hand-written, per service): what the service actually does, with test data
  declared inline.

The `/test-utils` subpath export keeps test-time code out of application bundles.

## Known gotchas

- Any package consuming a contract-typed client needs `@orpc/contract` as a **direct** dependency
  (for `ContractRouterClient`). Under strict dependency isolation the failure mode is a confusing
  type-error cascade, not a missing-module error.
- Elysia mounts for oRPC handlers need `{ parse: 'none' }`, or Elysia's body parser consumes the
  request before oRPC can read it.
- SSR dehydration of an errored query redacts `ORPCError` to a plain `Error` (the `code` and `data`
  are lost). When an error state must survive SSR, fold it into a result union with oRPC's `safe()`
  inside a server function; in practice auth errors usually redirect instead.
- `RPCLink` has no default type parameter — annotate `RPCLink<Record<never, never>>` or let
  inference run end-to-end.
