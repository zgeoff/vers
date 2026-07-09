## Type-only modules

A module whose exports are all types or interfaces is a defect: those exports belong in the
directory's `types.ts`, one per directory, holding every type its files share.

## Invariants

Express a true invariant — a condition only a bug can break — with `tiny-invariant`
(`invariant(value, 'message')`) rather than a hand-rolled `if`/`throw`. A condition real input can
trigger is ordinary control flow, not an invariant.

## Writing

### Banned words

Overused jargon a plainer word covers. Applies to all prose — docs, comments, PR descriptions, issue
text. An exception is allowed only when no other word logically represents the meaning and the
sentence can't be simplified without losing it.

- `load-bearing` / `load bearing` — say what breaks without it: "required", "essential", or name the
  failure.
- `seam` — "boundary", "join", "integration point".
- `surface` — noun: "area", "API", the concrete thing itself; verb: "show", "raise", "report".

## Monorepo layout

Projects live under `projects/*` (the sole bun workspace glob); `docs/000-overview.md` lists them.
Every project has its own `package.json` named `@vers/<name>`: internal deps use the `workspace:*`
protocol, and versions shared by 5+ projects live in the root manifest's `workspaces.catalog`
(referenced as `catalog:`). Libraries are consumed as TypeScript source (`exports` →
`./src/index.ts`); there are no per-library build steps. `bun install` uses the isolated linker
(pnpm-style symlinks, no phantom deps) with exact pins and a 7-day `minimumReleaseAge` — see
`bunfig.toml`. Turborepo drives the task graph: root `turbo.json` declares the
`build`/`typecheck`/`test`/`codegen`/`typegen`/`e2e` pipelines (ordering inferred from each
project's `workspace:*` deps). Per-project `turbo.json` files exist only to declare `boundaries`
tags. CI's changed-project detection is `turbo run --affected`.

TypeScript is 7.0.1-rc (catalog). TS7 has no `baseUrl` and no classic Compiler API, and there is no
path-alias convention here — write imports relative to the importing file. Node is 24.18.0
everywhere (CI, every service's Dockerfile, app-web's `engines` field) — panda 2.0's floor and the
ES2024 `lib` target both need it.

## Boundaries

Projects are tagged `lib`, `service`, or `app` in their own `turbo.json`; the root `boundaries`
block denies `lib` → `service`/`app` and `service` → `app` imports, transitively.
`bun run boundaries` also flags imports of packages missing from the importer's `package.json`. It
walks the filesystem, ignoring `.gitignore` — run it on a clean tree, or stale `dist/`/`build/`/
`styled-system/` output reads as source. CI runs it straight after install, before codegen populates
those directories.

### Package naming

Every importable workspace package lives in a `lib-`-prefixed folder. A package's name is its folder
name minus the taxonomy prefix: `lib-` and `app-` strip (`lib-utils` → `@vers/utils`, `app-web` →
`@vers/web`); `service-` is part of the name and carries through (`service-user` →
`@vers/service-user`).

## Styling

Panda CSS 2.0 spans all four consumers (lib-panda-preset, lib-styled-system, lib-design-system,
app-web). lib-panda-preset composes `presets: [presetBase, presetPanda]` from
`@pandacss/preset-base` and `@pandacss/preset-panda` — Panda 2.0 ships no bundled default preset.
CSS values that aren't theme tokens need the bracket escape hatch (`cursor: '[pointer]'`,
`borderWidth: '[1px]'`) — 2.0's `SystemStyleObject` value types reject arbitrary strings/numbers.

## Running things

- `bun install` — whole workspace (`--frozen-lockfile` in CI; `bun.lock` is committed).
- `bun run typecheck` — `turbo run typecheck` (per-project `tsc --noEmit`); one project via
  `--filter=@vers/<name>`.
- `bun run test` — `turbo run test` (per-project `bun test`); one project via `--filter`.
  Postgres-backed suites need `bun run pg:test-container:start` first. Each package carries its own
  `bunfig.toml` (bunfig is read from cwd, not merged up) — root-invoked `bun test <file>` still
  resolves jest-extended matchers from the root preload.
- `bun run lint` / `bun run lint:fix` — `turbo run codegen typegen`, then
  `oxlint --type-aware --type-check --report-unused-disable-directives-severity error` over the
  whole tree (`.oxlintrc.json` at the root; oxlint-tsgolint underneath, needs the TS7 toolchain —
  ~5s wall with warm caches). The codegen leg is required: without generated output (panda's
  `styled-system`, router typegen) those imports degrade to `any` and the unsafe-\* rules report
  hundreds of false violations. Every type-aware rule is on. Two exceptions are permanent:
  `only-throw-error`'s documented app-web override, and the inline directives on
  `lib-idle-core`/`lib-aether-core` tick/lifecycle handlers that mutate their entity parameter by
  design. For `typescript/prefer-readonly-parameter-types`, a function's own
  data/config/props/option types are made `readonly` (or the param `Readonly<…>`-wrapped; React
  props `Readonly<Props>`), and framework/library handles that have no readonly form (a
  `Kysely`/`Elysia`/`RPCHandler`/`Request` handle, a `Date`, …) are exempted per-type via the rule's
  `allow` list in `.oxlintrc.json` — never an inline marker. Only a genuinely un-`readonly`-able own
  type (a generic callback-arg object, a `ZodType`-bearing shape, a React-element wrapper) carries a
  single honest inline directive stating why; `allow` covers the rest.
- `bun run format` — `oxfmt .` (`.oxfmtrc.json` at the root), then `format-codemod` (blank-line
  padding) over the whole tree. The codemod's exclusions live in the root `.formatignore` (one glob
  per line, `#` comments) — that file keeps it off committed codegen output (panda's `styled-system`
  dirs, router typegen) and nested checkouts, and it is read from the working directory, so run
  format from the repo root. oxfmt covers the same set through `.oxfmtrc.json` plus `.gitignore`.
  The chain is idempotent: a second run is byte-identical.
- `bun run format:check` — both tools' check legs (`oxfmt --check .`, then `format-codemod --check`
  with the same ignores).
- `bun run build` — `turbo run build`; one project via `--filter`.
- `bun run e2e` — `turbo run e2e` (Playwright, `app-web-e2e`).
- `bun run boundaries` — `turbo boundaries`.
- Git hooks: lefthook (`lefthook.yml`, installed by `prepare`). Pre-push tests changed files only
  (`turbo run test --affected`, so each affected project's own runner is used) — the full suite is
  CI's. `LEFTHOOK=0` skips all hooks.

## Docker

Each server deployable (`app-web`; `service-avatar`, `service-session`, `service-user`,
`service-verification`) has a multi-stage Dockerfile around `turbo prune <pkg> --docker`;
`app-design-reference` ships as a plain static-nginx image:

1. **pruner** — a standalone `turbo` binary prunes to the target's dependency graph: `out/json`
   (manifests only, for layer caching), `out/full` (source), a pruned `out/bun.lock`.
2. **installer** — full `bun install` against `out/json` for build-time tooling.
3. **builder** — copies `out/full` plus `scripts/build-esbuild.ts` and `tsconfig.base.json` (outside
   any package, so prune doesn't carry them), then runs the project's `build` script.
4. **prod-deps** — `bun install --production --linker=hoisted`. Hoisting is essential: a bundle
   inlines source from several packages, and its external imports (`pino`, …) must resolve from the
   bundle's own location — only a flat `node_modules` serves them all.
5. **runtime** — `node:24.18.0-alpine` with the prod-deps `node_modules` and built output only.

app-web's builder runs its `codegen`/`typegen`/`build` scripts directly, not `turbo run build`.

## Testing (bun test, 0-isolation)

`bun test` runs every file in one process with no per-file isolation — lean into it. All lifecycle
and cleanup is registered once in a package's `bunfig.toml` preload and applies process-wide; test
files contain no `beforeAll`/`beforeEach`/`afterEach`/`afterAll`. This is what keeps the suite fast.

- **MSW is the sanctioned mock at the external HTTP/service boundary** — mock there, never internal
  abstractions. Each package with HTTP tests keeps one shared `server` (`setupServer()`) in a
  `mocks/` module; its lifecycle (`listen({ onUnhandledRequest: 'error' })`, `resetHandlers`,
  `close`) is wired globally by `registerMSWLifecycle(server)` (from `@vers/client-test-utils`) in
  the preload. Tests add per-test handlers with `server.use(...)` — including override and
  upstream-failure cases. For oRPC procedures, build those handlers with `buildMockService` /
  `mockService` (`@vers/client-test-utils/rpc-msw`).
- **Global mock reset** lives in the preload's `afterEach` (`mock.restore()`), never per-test.
- **A test that mutates global or environment state** restores it in an `onTestFinished(...)`
  callback registered inside the test — not `try`/`finally`, not a lifecycle hook — so teardown runs
  after the test whether it passes or throws. A setup helper may register the `onTestFinished`
  itself, giving callers restoration without wrapping their body.
- **jest-extended matchers** come from the `@zgeoff/bun-test-extended` preload; a package-local
  `augment-bun-test.ts` side-effect import brings their types into `tsc`.
- `toStrictEqual`, not `toEqual`, for object assertions.
- Bound test-result names: `ctx` for a `setupTest(…)` result, `hook` for `renderHook(…)`, `rendered`
  for RTL `render(…)` — member-access off them, never pick properties into loose consts.
- Behavioural test names describe observable behaviour and never cite internal identifiers
  (`it flags the run as invalid`, not `it sets isValid to false`).
- Declare test data inline per test in MSW-mocked packages (a client hitting a mocked service, or
  app-web): each test states the fields its behavior and assertions depend on and leans on the
  collection schemas' defaults for the rest — no factory builders (`createUser`), no shared mutable
  module-level fixtures, no restating a default. One-off helpers stay inline — reusable ones live in
  `test-utils/`. Packages whose tests exercise a real postgres follow the real-database
  factories-and-composites standard.
- **Stateful backends** use `@msw/data`: build an in-memory store from a zod schema
  (`new Collection({ schema: z.object({ … }) })`, `.create()`/`.createMany()`,
  `.findFirst((q) => q.where(…))`/`.findMany()`, `.defineRelations()`) and read/write it directly
  from the oRPC mock handlers. Models are zod schemas — never `@msw/data`'s `factory()` model
  dictionary. Every field of a row schema carries a `.default()` — faker-driven where the value is
  arbitrary — except a discriminator whose value gives a row its meaning; the preload seeds faker
  once so runs are reproducible.
- **React:** React Testing Library on happy-dom (bootstrapped via `@happy-dom/global-registrator` in
  the preload); prefer a project `render` util over bare RTL and the utils it returns over the
  imported `screen`; load data through the centralized MSW handlers + `@msw/data` in-memory store
  rather than stubbing hooks or poking Zustand; `waitFor` the fetch before asserting.

### RSC and server functions

- Server functions are thin ambient shells: they read request context (`getRequestHeaders`, cookies)
  and load data, then delegate to a pure component or handler that takes that data as explicit
  props/args. A unit that needs ambient server context in a test has its ambient read in the wrong
  place — move the read up to the shell.
- A function that returns React elements is a component: write it as one and test it by rendering.
  Pure server components (props in, no ambient or server-only imports) render under RTL + happy-dom
  like any component — render per state, assert visible behaviour; that covers branch selection.
- Server-fn bodies are named exported handlers that `createServerFn` wraps, so tests call the body
  directly.
- An uncompiled `createServerFn` dispatch relays only a `Response` or a thrown redirect/error to its
  caller; a plain result object resolves as `undefined`. Component tests cover the branches that
  round-trip that way — plain-object branches are asserted at the handler layer.
- The Flight pipeline (`renderServerComponent`, composite components) and ambient reads cannot run
  under bun test (one module graph, no `react-server` export condition). Their coverage is the
  real-runtime smoke suite, not unit tests.
- **Ambient request context** (`@tanstack/react-start/server`) is a mockable boundary: stub it only
  through the shared `withRequestContext` util, installed once in the preload behind a mutable
  holder. Never Start's RSC/render APIs, never modules we own; a direct `mock.module` in a test file
  is a review finding. Every stubbed ambient path is also crossed by the smoke suite. Explicit args
  stay preferred where they cost nothing.

### Real-database services (service/app/DB packages)

Services, apps, and DB-backed libraries whose tests exercise a real postgres follow this standard —
`service-avatar` is the reference example.

- **Production service factory.** A service exposes one `create<Service>Service({ db? })` in `src/`,
  owning its `createService` config; the production entrypoint and every test call that same
  factory. `db` is injected only in tests, for transaction isolation — never clone the
  `createService` config into tests.
- **Single-statement atomicity is the default.** A conditional `UPDATE`/`DELETE ... RETURNING`,
  `INSERT ... ON CONFLICT`, or a data-modifying CTE claims a single-row invariant and survives a
  serverless process kill with no orphaned transaction state. Reach for an interactive
  `db.transaction()` only for a genuine multi-row invariant that doesn't reduce to one statement —
  and give that handler's suite `database` isolation (`createTestDB('database')`), since the default
  transaction-isolation handle cannot nest.
- **Isolation strategy.** Acquire the database through `@vers/service-test-utils/bun`:
  `createTestDB()` returns an `await using` handle; `transaction` isolation (rollback on dispose) is
  the default, `database` isolation (a real, committed clone) is the opt-out for code that commits
  mid-op, takes advisory locks, or asserts something that only fires at COMMIT. Inject the handle's
  `db` into the code under test — for a service, through its factory — since code that opens its own
  connection bypasses the rollback.
- **Test-setup layering, by scope.** A local `setupTest()` per suite — typed config in, named props
  out, no `if`, declarative wiring — builds the db and boots the service, with no data. Never
  centralise it: a shared `setupTest` accretes conditionals as services multiply.
- **Composites build/register/return DATA, never runtime utils** (no clients, apps, servers) — the
  approved-reuse shortcut, not a mandate; a test with more refined needs may still build actors
  bespoke. Default to shared factories/composites for domain entities and DTOs, even on first use,
  for consistency. `createViewer`/`createAnonymousViewer` (`@vers/service-test-utils/bun`) are the
  shared s2s-actor composites, returning `{ user, token }` / `{ token }`; build the client in-test
  via `buildRPCTestClient(app, { token })`.
- **Test data — factories + composites, always.** Every domain entity/DTO gets a faker-defaulted
  `create-mock-*.ts` factory in `test-utils/factories/` (a plain object, never persisted, never
  requiring a parent), each with its own test. Persisted or wired data goes through a
  composite/entity-util (`create-*.ts`, no `-mock-`) that sources its defaults from the factory.
- **Assertions.** `toStrictEqual` + asymmetric matchers (`expect.toBeString()`, `expect.toInclude`,
  …) for whole-shape assertions; a single-field `.toBe` after a mutation is fine.
- **Naming.** Behavioural, plain English, never citing internal identifiers. Prefix `#procedureName`
  only when one file holds several procedures' tests; plain `it …` when a file covers one unit.
- **One export per file, filename = its kebab-cased export.** `types.ts`/`index.ts` excepted.
- **Comments.** No JSDoc that only restates a name/signature; document only genuinely non-obvious
  contract; never name another declaration in a comment.
- **Failure paths are contract.** Assert on the rejection directly —
  `expect(promise).rejects.toMatchObject({ code })` — never try/catch. Bun's own matcher types
  declare every `.rejects`/`.resolves` chain synchronous (`void`), matching its own doc examples, so
  these calls are not `await`ed; awaiting one is exactly what oxlint's type-aware rules flag.
  `toResolve()`/`toReject()` are the two matchers actually typed as promises, and are `await`ed.
  Test each declared error.
- **Env.** Permanent env is set in the preload via a direct `process.env` assignment; per-test
  overrides go through `updateEnv`, restored by `removeEnvOverrides` in the preload's
  `registerBunTestCleanup()`.
- **Auth.** s2s tests use the real verification path: an asymmetric keypair from
  `getTestServiceKeyPair()`, tokens minted with `createServiceToken`.

## TO BE CLEANED UP

Temporary states of the tree, each tagged with the issue that retires it — delete a bullet when its
issue closes.

- **Vitest survives in unswept packages (#266).** The repo's test runner is `bun test`; a package is
  on vitest exactly when it has a `vitest.config.ts` (the root `vitest.workspace.ts` globs those,
  `turbo run test` uses each package's own runner, and deleting the config drops the package from
  the vitest run). Never add vitest to a new package, and never re-add it to a converted one to
  "match" a still-on-vitest neighbour. Where `agents/shared.md` assumes bun test everywhere (e.g.
  "run `bun test` from the repo root"), still-on-vitest packages follow their own config until
  swept.
- **Lint baseline backlog (#236).** ~550 pre-existing sites are baselined inline with
  `// oxlint-disable-next-line <rule> -- baseline(#236)` comments rather than turned off in config;
  the unused-directive check is the ratchet — fixing a baselined site makes its comment stale and
  lint fails until the comment is deleted. `typescript/prefer-readonly-parameter-types` is never
  baselined: new code makes its own types `readonly` and exempts framework handles via the rule's
  `allow` list.
- **Panda CSS is a beta pin.** 2.0.0-beta.8 — no stable release exists, so the packages are pinned
  through `bunfig.toml`'s `minimumReleaseAgeExcludes`, with a removal issue tracking the jump to
  stable.
- **Screens are functional-first until the design-system rebuild (#246, fed by the #245 design pass)
  closes.** Screens and routes are built workable-only: compose existing `lib-design-system`
  components and semantic tokens (`bg.*`, `text.*`, `border.*`, `accent.*`) — no bespoke visual
  styling beyond layout, no new one-off colors/fonts/animations, no polish passes. The
  semantic-token layer is the stable contract: the #246 re-skin keeps token names unchanged, so
  screens that stick to it adapt for free. A screen needing a component that doesn't exist yet
  builds the minimal version in its own PR and promotes it into `lib-design-system` when a second
  consumer appears.
