# Service Contracts

How the rebuilt services (#156) expose their APIs, and how everything else calls them. Decided
ahead of the scaffold work in #163, building on the oRPC spike (#157, reference implementation in
PR #200).

## The idea, plainly

A restaurant prints its menu before the kitchen opens. The menu is the agreement: diners order
from it, the kitchen cooks to it, and neither side needs to see inside the other. If the kitchen
swaps ovens, the menu doesn't change; if a dish is added, old orders still work.

A **contract package** is that menu. It is a small package that declares, for one service, every
operation the service offers: the URL and method, the shape of the input, the shape of the output,
and the errors a caller might get back. It contains **no implementation** — no database code, no
business logic, nothing about _how_ the service works.

Both sides then derive from it:

- The **service** implements the contract, and TypeScript refuses to compile if the implementation
  drifts from the declaration — a kitchen that physically cannot cook off-menu.
- **Clients** (the web app, the gateway, other services) import the contract and get a fully typed
  client — autocomplete, input checking, and typed errors — without ever importing a line of
  service code.

This is dependency inversion: the service and its callers both depend on the contract; neither
depends on the other.

## The packages

| Package                    | Folder                            | Contains                                                                                                                        | Depended on by                  |
| -------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `@vers/contract-<service>` | `projects/lib-contract-<service>` | one service's API declaration                                                                                                   | that service, gateway, web      |
| `@vers/contract-base`      | `projects/lib-contract-base`      | standard error taxonomy, base builders, conformance-test helper                                                                 | contract packages, gateway, web |
| `@vers/service-runtime`    | `projects/lib-service-runtime`    | Elysia plugins every service composes: s2s token verification, health checks, OpenTelemetry, Sentry, request-id, env validation | services only                   |
| `@vers/validation`         | `projects/lib-validation`         | domain-agnostic zod primitives (ids, timestamps, pagination); no oRPC imports                                                   | everything                      |

Why one contract package per service rather than a single `@vers/contracts` with subpath exports:

- **Precise affected detection.** The task graph invalidates work at package granularity. With one
  shared package, every contract edit would re-run CI for every service; per-service packages
  re-run only the true consumers. Contract edits are frequent during a rebuild — this cost is
  daily.
- **Coupling stays visible.** Inside one package, a contract borrowing another service's schema is
  an innocuous relative import that nothing flags. Across packages, it is an explicit dependency
  edit in `package.json` — reviewable, and the dependency graph stays honest.
- **Ownership is crisp.** "A service owns its API" maps one-to-one to "a service's PR owns its
  contract package."

The per-package boilerplate this creates is exactly what the #163 scaffold template amortizes.

Folder and package naming, repo-wide: `lib-` prefixes every importable workspace package —
contracts included, since service, gateway, and web all import them — while deployables keep their
role prefixes (`service-`, `app-`, `db-`). **A package's name is its folder name minus the `lib-`
prefix** (`projects/lib-validation` → `@vers/validation`,
`projects/lib-contract-user` → `@vers/contract-user`); the prefix is folder taxonomy and would
only stutter at the import site. Deployable folder names carry through unchanged.

## Anatomy of a contract package

Contract packages are private, unversioned, and unbuilt. The load-bearing trick is that `exports`
points straight at TypeScript source:

```json
{
  "name": "@vers/contract-user",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@orpc/contract": "…", "zod": "…" }
}
```

No build step, no `.d.ts` emit, no version drift: consumers typecheck against the live source, so
a breaking change fails the consumer's typecheck in the same commit that made it.

Each procedure is a declaration chain — route, errors, schemas:

```ts
export const getCurrentUser = authedRoute.route({ method: 'GET', path: '/users/me', summary: 'Get the currently authenticated user' }).output(UserSchema);
```

`authedRoute` comes from `@vers/contract-base`: it is the plain `oc` builder with the standard
error set pre-declared, so every authenticated procedure shares one error vocabulary without
re-declaring it. Procedure-specific errors (`NOT_FOUND`, `CONFLICT`, …) are declared in the
contract that owns them. Entity schemas live in the contract package that owns the entity — not in
a shared types package, even at some duplication cost — because sharing entity schemas across
contracts would couple services through the back door.

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
router mounts on Elysia three ways from the same implementation: the RPC protocol under `/rpc`
(what typed clients speak), an OpenAPI-shaped REST surface under `/api`, and a generated OpenAPI
3.1 document at `/spec.json`. The spec is generated from the _contract_, never the implementation,
which is what keeps clients contract-only.

`@vers/service-runtime` provides the shell around this — a `createService(...)` entry composing
the Elysia plugins listed above — so a new service is roughly: a contract package, handlers, and
one `createService` call. OpenTelemetry is wired here from day one (Grafana-flavored sink) so
rebuild-wide gauges (#182) light up as each service comes online.

## The client side

One type annotation buys the whole API:

```ts
const client: ContractRouterClient<UserContract> = createORPCClient(link);
```

In the web app the link is isomorphic: during SSR it calls the service directly (forwarding the
caller's session headers); in the browser it goes through the app's `/api/rpc` proxy route, since
services are not reachable from the public internet.

## Errors and the trust boundary

Two very different things can go wrong with authentication, and the design keeps them apart
(#146):

1. **The user's session is bad** — missing or expired. This is the _caller's_ problem and the
   caller can act on it (sign in again). It is a contract error: `UNAUTHORIZED` with a typed
   `data.reason` of `missing-session` or `expired-session`, declared once in
   `@vers/contract-base`.
2. **The service-to-service token is bad.** Services only accept requests carrying a short-lived
   token minted at the edge, naming the acting user. If that token fails verification, something
   is misconfigured or someone is probing — never something a browser user can fix. This is _not_
   a contract error: middleware in `@vers/service-runtime` rejects it with a plain 401 before any
   handler runs, and the gateway surfaces it as a 5xx plus alerting.

Because the edge validates sessions and mints the token, services never see cookies. The handler
context is simply:

```ts
interface ServiceContext {
  actingUserId: string | null; // null = verified anonymous call
}
```

A subtlety worth stating: the contract describes what the **caller** can receive, not what the
service emits. When a session expires, the gateway itself replies with the contract-shaped
`UNAUTHORIZED { reason: 'expired-session' }` without calling the service at all; services
themselves only ever throw `missing-session` (defense in depth, when an authed procedure is
reached without an acting user). The shared enum is caller-facing vocabulary, not an inventory of
who throws what.

`FORBIDDEN` is declared with an empty `data` payload until a permission model exists — fields are
added additively when it lands.

## Change discipline

Contracts are unversioned, so the rule is **additive-first**: new procedures, new optional fields,
and new error variants are always safe. A breaking change is permitted only when every consumer is
fixed in the same commit — and because consumers typecheck against contract source, CI enforces
exactly that. There is no deprecation window to manage and no version matrix; the monorepo _is_
the compatibility mechanism.

## Testing

Two layers, per the repo's mock-free testing rules:

- **Conformance** (generic, free with the scaffold): a helper from `@vers/contract-base/testing`
  walks a contract against the real Elysia app in-process via `app.handle(request)` — no network,
  no mocks — and asserts the mechanical guarantees per procedure: malformed input is rejected,
  error payloads round-trip with their declared shape, and OpenAPI generation succeeds.
- **Behavioural** (hand-written, per service): what the service actually does, with test data
  declared inline.

The `/testing` subpath export keeps test-time code out of application bundles.

## Known gotchas (from the #157 spike)

- Any package consuming a contract-typed client needs `@orpc/contract` as a **direct** dependency
  (for `ContractRouterClient`). Under strict dependency isolation the failure mode is a confusing
  type-error cascade, not a missing-module error.
- Elysia mounts for oRPC handlers need `{ parse: 'none' }`, or Elysia's body parser consumes the
  request before oRPC can read it.
- SSR dehydration of an errored query redacts `ORPCError` to a plain `Error` (the `code` and
  `data` are lost). When an error state must survive SSR, fold it into a result union with oRPC's
  `safe()` inside a server function; in practice auth errors usually redirect instead.
- `RPCLink` has no default type parameter — annotate `RPCLink<Record<never, never>>` or let
  inference run end-to-end.
