# Spike 157 — oRPC on Elysia + TanStack Start

Time-boxed walking skeleton for [#157](https://github.com/zgeoff/vers/issues/157): proves the
API-layer stack from the #143 evaluation end-to-end before the rebuild (#163/#164/#165) commits to
it. **Reference only — never merges.** Close the PR once the patterns are encoded properly in the
rebuild issues.

## Shape

Self-contained pnpm workspace (deliberately mirrors the target turborepo+pnpm+bun state, and stays
outside the repo's yarn `projects/*` glob so the two package managers never meet):

- `contract/` — `@vers/contract-user`, the unversioned **unbuilt** workspace package pattern:
  `exports` points straight at TS source; consumers typecheck it in their own program.
- `service/` — `@vers/service-user`, oRPC procedures implementing the contract via `implement()`,
  mounted on Elysia (bun runtime) through the fetch handler. Serves the RPC protocol at `/rpc`,
  the OpenAPI REST surface at `/api`, and the generated OpenAPI 3.1.1 document at `/spec.json`
  (generated from the **contract**, not the implementation).
- `web/` — `@vers/app-web`, TanStack Start. Two consumption paths for `getCurrentUser`:
  1. contract-typed client through `@orpc/tanstack-query` utils, prefetched in the route loader,
     SSR-hydrated via `@tanstack/react-router-ssr-query`; browser traffic reaches the service
     through a `/api/rpc/$` proxy server route (the service is private-network in production).
  2. a Start server function wrapping the client with `safe()`, folding the typed error into a
     plain result union.

## Run it

```sh
pnpm install
pnpm dev:service   # user service on :3001 (bun)
pnpm dev:web       # start app on :3000 (vite)
```

Visit http://localhost:3000 — buttons switch the session cookie between valid / expired / absent.
Session tokens are hard-coded stand-ins: `dev-session-token` (valid), `expired-session-token`
(expired), anything else counts as no session.

## Verdict

**oRPC decision holds.** Full round-trip type inference browser → Start server → service from the
contract package alone; typed `UNAUTHORIZED` with its `data.reason` payload survives every hop;
OpenAPI emission works from the contract with the zod v4 converter, including the typed 401 error
schema. All three packages typechecked clean on the first pass. No friction anywhere near
overturning #143 (fallbacks tRPC v11 / Eden not needed).

## Friction notes (none decision-threatening)

- Consumers of a contract-typed client need `@orpc/contract` as a **direct** dependency (for
  `ContractRouterClient`) under pnpm strict isolation — easy to hit as a confusing type-error
  cascade ("unknown is not assignable…") rather than a clear missing-module error at the client.
- SSR dehydration of an **errored** query redacts the `ORPCError` to a plain `Error` (seroval
  drops the subclass, so `defined`/`code`/`data` are lost) and marks the query invalidated; the
  browser refetches through the proxy and gets the typed error back. Net UX: the error-state
  panel SSRs as "Loading…" and resolves client-side. Fine for real apps (auth state usually
  redirects instead), worth knowing. The server-function path sidesteps it entirely — folding the
  typed error into a result union is the pattern to prefer when the error state must SSR.
- `RPCLink` has no default for its context type parameter — annotating a variable/return as bare
  `RPCLink` is a type error; write `RPCLink<Record<never, never>>` or let inference run.
- TypeScript 6.0 is current on npm; the spike pins 5.9.3 to keep TS-major noise out of the
  experiment. The rebuild should evaluate TS 6 separately.
- Elysia routes wrapping the fetch handlers need `{ parse: 'none' }` so Elysia's body parsing
  doesn't consume the request before oRPC reads it (documented, but easy to miss).
- TanStack Start pins `@tanstack/react-router` to an exact version (1.168.27 → 1.170.17); pin the
  same version wherever the router is a direct dependency or risk a dual-router install.

## Out of scope (deliberately)

React Compiler, Panda/Ark, real session verification, tests, turborepo wiring — all covered by
their own rebuild issues.
