# Feature flags

Feature flags gate incomplete or gradually-rolled-out functionality behind a boolean — read this
when adding, gating, or removing a flag. Every flag is a temporary code path: once a feature is
fully rolled out, the flag and every call site that checks it are deleted.
[OpenFeature](https://openfeature.dev) is the evaluation interface every flag check goes through.
`@vers/flags` registers an in-house provider that serves values from environment variables, so
swapping the evaluation backend stays behind that interface rather than a rewrite of every call
site.

## The registry

`@vers/flags`'s `FLAGS` constant is the single source of truth for every flag. Each entry declares a
`defaultValue` and a `description` of what it gates.

- A flag's key derives its environment variable name mechanically: `FEATURE_` plus the key
  upper-cased with dashes replaced by underscores, so `market` becomes `FEATURE_MARKET`.
- Setting that variable to `"true"` or `"false"` overrides the default for the process that reads
  it. Any other value, or an unset variable, falls back to `defaultValue`.
- Flags are boolean-only — no percentage rollouts, no variants, no targeting rules.
- A flag is named for the state it turns on (`market`), never the state it turns off
  (`disable-market`).

Each flag's `defaultValue` is its safe state: off for a feature still rolling out, on only for a
feature meant to ship enabled everywhere until explicitly turned off.

## Server-side evaluation

Flags evaluate server-side only — inside server functions and oRPC handlers — never in a browser
bundle. `resolveFlags()` evaluates every registered flag and returns a plain
`Record<FlagKey, boolean>`. A client that needs flag state receives that resolved payload rather
than the evaluation machinery itself.

`app-web`'s `/_game` layout route resolves flags once, in its `beforeLoad`, through a server
function wrapping `resolveFlags()`:

```ts
const resolveFlagsFn = createServerFn({ method: 'GET' }).handler(() => resolveFlags());

export const Route = createFileRoute('/_game')({
  beforeLoad: async () => ({ flags: await resolveFlagsFn() }),
  // ...
});
```

Every route and component nested under `/_game` reads the resolved booleans from router context:
`useRouteContext({ from: '/_game' })` in a component, `context.flags` in a descendant route's own
`beforeLoad`. Gating hides the feature rather than forbidding it:

- A route gated by a flag throws `notFound()` when it's off, so the route looks absent.
- A nav entry gated by a flag is filtered out of the list it would otherwise appear in.

## Gating an oRPC procedure

A service procedure gates itself behind a flag with the `requireFlag` middleware from
`@vers/flags/orpc`:

```ts
os.someProcedure.use(requireFlag('market')).handler(/* ... */);
```

The middleware evaluates the flag server-side and throws `NOT_FOUND` when it's off, `next()` when
it's on — the same absent-not-forbidden behavior as a gated route.

## Process boundaries

Each process reads its own environment: `app-web` and each Fly service resolve flags from the
environment variables set on that process, independently of every other process. Flipping a flag
that gates behavior in more than one process means setting its environment variable on every process
that checks it. A flag flipped in `app-web` alone has no effect on a service that also gates on it.

## Adding a flag

1. Add an entry to `FLAGS` in `@vers/flags`, naming it for the state it turns on and giving it a
   `defaultValue` and a `description`.
2. Guard the call sites the feature needs: a route's `beforeLoad`, a nav entry's `flag` field, an
   oRPC procedure's `requireFlag` middleware, or a direct `resolveFlags()`/client read.
3. Set the derived `FEATURE_<KEY>` environment variable to `"true"` on whichever processes should
   serve the feature.

## Removing a flag

Delete the `FLAGS` entry and every call site that reads it, and unset the environment variable
everywhere it was set. A flag that has reached its permanent state — always on or always off — is
dead code, not configuration.
