## Function naming: project verbs

Project-level additions to the shared function-naming taxonomy, under the same rules.

**Effectful** — consuming draws advances the supplied stream's cursor:

| Prefix | Contract                                                     | Example              |
| ------ | ------------------------------------------------------------ | -------------------- |
| `roll` | consume typed draws from a roll stream to produce an outcome | `rollItemFromStream` |

## Review bots

CodeRabbit and cubic review every PR, configured by `.coderabbit.yaml` and `cubic.yaml` at the repo
root; CodeRabbit reads this file as its guidelines.

- A PR is ready only after both bot reviews are read and every finding is answered on its own
  thread: a fixed finding's reply cites the commit that fixed it; a declined finding's reply states
  the reason — when a finding contradicts this file, this file wins and the reply names the rule.
  Reviews land within a few minutes of opening; read them with `gh pr view <n> --comments` and
  `gh api repos/zgeoff/vers/pulls/<n>/comments`.
- Resolve a thread once its reply is posted, fixed and declined alike (GraphQL
  `resolveReviewThread`). A finding the agent cannot confidently judge is escalation, not
  disposition: reply saying so and leave the thread open for a human.
- Never teach a bot through chat (`@coderabbitai` learnings and the like) — a correction to bot
  behaviour is an edit to `.coderabbit.yaml` or `cubic.yaml`, reviewed in a PR.
- Bots review a PR once, at open; an agent invokes a re-review only when asked, never on its own
  initiative.

## Issue hygiene

Triage a GitHub issue the moment it's opened, not in a later pass:

- assign the delivery-phase milestone and the area, type, and priority labels
- record blocking edges against the issues it depends on
- add it to the delivery board and set its board status

An open issue that isn't on the board with a milestone and status is a defect.

Upkeep issues are the exception: event- or date-triggered maintenance (dropping a dependency
override, deleting an audit ignore) carries the `upkeep` label plus an area label, no milestone, and
stays off the delivery board. The issue body opens with a fenced trigger line —
`trigger: release <pkg> ><version>` or `trigger: date <YYYY-MM-DD>` — that the weekly dep-health
sweep evaluates, commenting and marking the issue `upkeep-ready` when the condition holds. An upkeep
issue without a parseable trigger line fails the sweep.

## Type-only modules

A module whose exports are all types or interfaces is a defect: those exports belong in the
directory's `types.ts`, one per directory, holding every type its files share.

## Invariants

Express a true invariant — a condition only a bug can break — with `tiny-invariant`
(`invariant(value, 'message')`) rather than a hand-rolled `if`/`throw`. A condition real input can
trigger is ordinary control flow, not an invariant.

## Error handling

The full conventions — taxonomy, code registry, trace context, reporting split — live in
`docs/architecture/error-handling.md`. The rules a PR must satisfy:

- A procedure handler throws only its typed `opts.errors.*` constructors or `invariant()`. No
  try/catch for logging or reporting in handlers — the central `onError` interceptor in
  `createService` owns that.
- Every contract `.errors({…})` map is built with `defineErrors` (`@vers/contract-base`). A bespoke
  code (any code outside oRPC's canonical set) declares an explicit `status` and lands with its row
  in the `docs/architecture/error-handling.md` registry table in the same PR; bespoke codes are
  named `NOUN_PROBLEM`.
- Clients narrow on `code` via `isDefinedError`/`safe` and act on `data` fields — never on `message`
  strings.
- The Sentry SDK is the only path to the error backend; pino is a log-only sink. Never wire a log
  transport to the error backend, and never `captureException` in code the central hooks (service
  interceptor, query caches, root error boundary) already cover.
- app-web: form validation returns `submission.reply()`, navigation and access control throw
  `redirect()`/`Response`, faults throw and land on a route `errorComponent`. Retry policy is
  central in `buildQueryClient`; a per-query `retry` override needs a behavioural reason the default
  policy can't express.

## Banned words

Overused jargon a plainer word covers; applies to all prose — docs, comments, PR descriptions, issue
text.

- `bites` (figurative) — "applies", "takes effect", or name the consequence.
- `CAS` (the acronym) — "compare-and-swap" spelled out, or name the behaviour: a guarded update that
  applies only if the cursor still holds its expected value.
- `fence` / `fencing` (the distributed-systems metaphor) — state the rule it enforces: "each
  activity has a single writer", "an append from any other session is rejected". A markdown code
  fence is a different word and stays.
- `load-bearing` — "required", "essential", or name what breaks without it.
- `seam` — "boundary", "join", "integration point".
- `surface` — noun: "area", "API", the concrete thing itself; verb: "show", "raise", "report".

## Monorepo layout

Packages live under kind-first roots; `docs/architecture/overview.md` lists every project.

- Workspace globs: `apps/*`, `services/*`, `contracts/*`, `libs/*/*` (grouped by domain: `core`,
  `data`, `design`, `game`, `service`, `testing`), `infra`, and `scripts`.
- Internal deps use the `workspace:*` protocol; every external version lives in the root manifest's
  `workspaces.catalog`, referenced everywhere as `catalog:` — project manifests carry no version
  pins.
- Libraries are consumed as TypeScript source (`exports` → `./src/index.ts`); there are no
  per-library build steps.
- `bun install` uses the isolated linker with exact pins and a 7-day `minimumReleaseAge`
  (`bunfig.toml`).
- Turborepo drives the task graph from the root `turbo.json`; per-project `turbo.json` files exist
  only to declare `boundaries` tags. CI's changed-project detection is `turbo run --affected`.
- TypeScript is 7.0.2: no `baseUrl`, no path aliases — write imports relative to the importing file.
  Node is 24.18.0 in CI and app-web; the domain services compile to a Bun binary on `alpine`.

## Boundaries

Projects are tagged `lib`, `service`, or `app` in their own `turbo.json`; the root `boundaries`
block denies `lib` → `service`/`app` and `service` → `app` imports, transitively.
`bun run boundaries` also flags imports of packages missing from the importer's `package.json`. It
walks the filesystem ignoring `.gitignore` — run it on a clean tree, or stale
`dist/`/`styled-system/` output reads as source.

Package naming is `@vers/` plus the leaf folder name (`libs/core/utils` → `@vers/utils`, `apps/web`
→ `@vers/web`), except `services/user` → `@vers/service-user` and `contracts/user` →
`@vers/contract-user`. The `libs/<domain>/` grouping is browsing-only — moving a lib between domains
changes nothing but its path.

## Repo scripts

Operational tooling is the `@vers/scripts` workspace package (`scripts/`), covered by typecheck,
test, lint, boundaries, and knip like any project.

- `src/bin/` holds the executable entrypoints — thin shells that sequence I/O and exit codes.
- `src/<domain>/` directories (`deploy/`, `stack/`, `postgres/`) hold the composable logic;
  `src/utils/` accepts only domain-free pieces.
- Decision logic is pure — data in, findings out — with co-located tests; effect modules stay thin
  enough that running the CLI is their coverage.
- Root-manifest entries (`bun run deploy`, `bun run stack`, `pg:*`) invoke the bin files with plain
  `bun`.

## Env files

Each env-consuming project ships a committed `.env.example` documenting its keys. Real values come
from `bun run env:pull`, which pulls each managed file from the `vers` 1Password vault via the `op`
CLI. `.env` files themselves are never committed.

## Deploys

`bun run deploy` drives every Fly rollout from the `deploy.config.ts` manifest at the repo root;
`deploy verify` asserts the fleet is online and current. Mechanics, staleness detection, CI wiring,
container builds, and secrets: `docs/architecture/deployment.md`.

- Database migrations run once per green push in their own never-cancelled `migrate` job — never per
  service.
- Deploy-phase jobs target the `production` GitHub environment; repo-level secrets carry only what
  PR checks need.

## Postgres access (MCP)

The `postgres` MCP server exposes production and dev sources; mechanics and provisioning live in
`docs/architecture/database.md`.

- `execute_sql_prod` / `search_objects_prod` query production read-only — writes are refused at both
  the tool and role layer.
- `execute_sql_dev` / `search_objects_dev` hit a disposable database cloned for the current worktree
  on its first use: no setup step, full read/write, migrated and seeded. Sessions that never query
  postgres never touch the database.
- Tests never point at the dev database — postgres-backed suites own the local test container.
- After removing a worktree, `bun run pg:dev:sweep` drops its database;
  `bun run pg:dev:refresh-base` rebuilds the clone template when seed data changes.

## Styling

Panda CSS 2.0 spans `@vers/panda-preset`, `@vers/styled-system`, `@vers/design-system`, and app-web,
pinned at 2.0.0-beta.8 in the catalog — no stable 2.0 release exists.

- `@vers/panda-preset` composes `presets: [presetBase, presetPanda]` — Panda 2.0 ships no bundled
  default preset.
- CSS values that aren't theme tokens need the bracket escape hatch (`cursor: '[pointer]'`,
  `borderWidth: '[1px]'`) — 2.0's `SystemStyleObject` value types reject arbitrary strings and
  numbers.

### Screens

Screens and routes are built workable-only:

- Compose existing `@vers/design-system` components and semantic tokens (`bg.*`, `text.*`,
  `border.*`, `accent.*`) — no bespoke visual styling beyond layout, no one-off
  colors/fonts/animations, no polish passes.
- The semantic-token layer is the stable contract: re-skins change token values, never token names,
  so screens that stick to it adapt for free.
- A screen needing a component that doesn't exist yet builds the minimal version in its own PR and
  promotes it into `@vers/design-system` when a second consumer appears.

## Client state (Zustand)

Zustand holds client state; server cache lives in TanStack Query.

- Each package composes its client state into one bound store, built by spreading state-only slice
  factories (`create-<concern>-slice.ts`, each returning its fields' initial values) inside a single
  `create<Store>()(() => ({ … }))`. A package with a second genuinely disjoint domain (game-
  rendering's satellite registry beside its scene state) may hold a second store.
- Stores hold state only — no colocated actions. Mutation goes through external setter modules
  (`set-*.ts`, `toggle-*.ts`) calling `setState`, so writers work outside React (workers, engine
  callbacks). One `setState` per logical event: an event that changes several fields gets one
  consolidated writer, never a per-field fan-out.
- `index.ts` exports selector hooks and setters, never raw store handles. A package-external
  imperative read goes through an exported `get*` reader.
- `useShallow` wraps only selectors that build a fresh object or array; a selector returning a
  primitive or a single stored reference goes bare.
- Middleware wraps only the combined store, never an individual slice.
- Inside the R3F frame loop, reads are imperative `getState()` calls
  (`docs/architecture/game-rendering.md`); DOM components subscribe through selector hooks.

## Running things

- `bun install` — whole workspace (`--frozen-lockfile` in CI; `bun.lock` is committed).
- `bun run typecheck` — `turbo run typecheck`; one project via `--filter=@vers/<name>`.
- `bun run test` — `turbo run test`, each project's own runner; one project via `--filter`. Every
  JS/TS package runs on `bun test` — never add vitest. Postgres-backed suites need
  `bun run pg:test-container:start` first. bunfig is read from cwd, not merged up, but root-invoked
  `bun test <file>` still resolves jest-extended matchers from the root preload.
- `bun run lint` / `bun run lint:fix` — `turbo run codegen typegen`, then type-aware oxlint over the
  whole tree. The codegen leg is required: without generated output (panda's `styled-system`, router
  typegen) those imports degrade to `any` and the unsafe-\* rules report hundreds of false
  violations.
- `bun run format` — `oxfmt .`, then `format-codemod` (blank-line padding). Run from the repo root:
  the codemod's exclusions (`.formatignore`, keeping it off committed codegen output and nested
  checkouts) are read from the working directory. The chain is idempotent.
- `bun run format:check` — both tools' check legs.
- `bun run build` / `bun run e2e` / `bun run boundaries` — `turbo run` each; `e2e` is Playwright
  (`@vers/web-e2e`).
- `bun run deadcode` — knip (`knip.json`); blocking in CI and pre-push. Needs codegen output
  present; a dependency knip can't see gets a `knip.json` ignore in the PR that introduces it.
- Git hooks: lefthook (`lefthook.yml`, installed by `prepare`). Pre-push tests changed files only
  (`turbo run test --affected`); `LEFTHOOK=0` skips all hooks.
- Python (`apps/bugsink` only) runs `pytest` under `uv` via its `test:adapter` script, outside the
  Bun graph; the `python-tests` workflow runs it on change.

## Lint policy

- Every type-aware rule is on (`.oxlintrc.json`; oxlint-tsgolint underneath, ~5s wall with warm
  caches). Two permanent exceptions: `only-throw-error`'s documented app-web override, and the
  inline directives on `@vers/idle-core`/`@vers/worldmap-core` tick/lifecycle handlers that mutate
  their entity parameter by design.
- Pre-existing violations are baselined inline with
  `// oxlint-disable-next-line <rule> -- baseline(#236)`, never turned off in config. The
  unused-directive check is the ratchet: fixing a baselined site strands its comment, and lint fails
  until the comment is deleted.
- `typescript/prefer-readonly-parameter-types` is never baselined: a function's own
  data/config/props/option types go `readonly` (React props `Readonly<Props>`), and framework
  handles with no readonly form (a `Kysely`/`Elysia`/`RPCHandler`/`Request` handle, a `Date`, …) are
  exempted per-type via the rule's `allow` list in `.oxlintrc.json` — never an inline marker. Only a
  genuinely un-`readonly`-able own type (a generic callback-arg object, a `ZodType`-bearing shape)
  carries a single inline directive stating why.

## Testing

`bun test` runs every file in one process with no per-file isolation — lean into it: lifecycle and
cleanup register once in a package's `bunfig.toml` preload and apply process-wide, and test files
contain no `beforeAll`/`beforeEach`/`afterEach`/`afterAll`. Three regimes cover the workspace, by
package kind:

- **Pure packages** — libs and CLIs with no service or database edge. Mock-free: pure modules assert
  on return values, file-touching ones use `mkdtemp` trees, and CLI behaviour is asserted end-to-end
  by spawning the real binary — a module hard to test without mocking moves its I/O to the caller.
- **MSW-mocked packages** — clients of mocked services and app-web.
- **Real-database packages** — services, apps, and DB-backed libraries exercising a real postgres.

Everywhere:

- Never use `describe` — write flat `test(…)` blocks with behavioural titles that start with "it"
  (`test('it pads before a return statement', …)`).
- Test files are co-located with the module they test (`parse-source.ts` beside
  `parse-source.test.ts`) — no `test/`, `tests/` or `__tests__` directories. Declaration emit
  excludes `*.test.ts`, so they never ship.
- A test whose unit consumes a domain object or DTO takes it from the package's faker-defaulted
  `create-mock-*` factory in `test-utils/factories/` (each factory has its own test), overriding
  only the fields the unit reads.
- A unit that parses or validates raw input — a zod schema, a decoder — is tested with inline
  literal payloads, valid and invalid, never factory output: a factory built to satisfy a schema
  cannot falsify it. A rejection test asserts the reported issue path, never bare `success: false` —
  a payload invalid for any reason passes the bare boolean.
- An input that is neither a domain object nor a DTO — a plain argument, an options bag, a config —
  is written inline at the call site, even when tests repeat the literal; repeated data reads, an
  opaque baseline doesn't. Test files declare no baseline-builder helpers and no module-level
  fixtures shared between tests.
- A factory is called in the test that uses its value, never through a helper that pre-configures
  overrides — a second layer of defaults is a shadow factory the test site can't see.
- `setupTest` wires runtime — servers, handlers, clients, recorders — and returns no domain data and
  no data-builders.
- `toStrictEqual`, not `toEqual`, for object assertions; asymmetric matchers inside it are fine.
- Global mock reset lives in the preload's `afterEach` (`mock.restore()`), never per-test.
- A test that mutates global or environment state restores it in an `onTestFinished(...)` callback
  registered inside the test — not `try`/`finally`, not a lifecycle hook — so teardown runs whether
  the test passes or throws. A setup helper may register it for its callers.
- jest-extended matchers come from the `@zgeoff/bun-test-extended` preload; a package-local
  `augment-bun-test.ts` side-effect import brings their types into `tsc`.
- Test titles describe observable behaviour and never cite internal identifiers
  (`it flags the run as invalid`, not `it sets isValid to false`).
- Bound test-result names: `ctx` for a `setupTest(…)` result, `hook` for `renderHook(…)`, `rendered`
  for RTL `render(…)` — member-access off them, never pick properties into loose consts.
- Reach for jest-extended matchers instead of hand-rolling assertions. Frequently useful:
  - arrays: `toIncludeAllMembers`, `toIncludeSameMembers`, `toPartiallyContain`,
    `toIncludeAllPartialMembers`, `toSatisfyAll`
  - objects: `toContainEntry`, `toContainEntries`, `toContainAllKeys`, `toBeFrozen`
  - strings: `toStartWith`, `toEndWith`, `toInclude`, `toEqualCaseInsensitive`,
    `toEqualIgnoringWhitespace`
  - values: `toBeNil`, `toBeOneOf`, `toSatisfy`, `toBeWithin`, `toBeEmpty`
  - dates: `toBeAfter`, `toBeBefore`, `toBeBetween`, `toBeValidDate`
  - mocks: `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`, `toHaveBeenCalledBefore`,
    `toHaveBeenCalledAfter`
  - errors/async: `toThrowWithMessage`, `toResolve`, `toReject` (both return a promise — always
    `await`)
- Matchers also work asymmetrically inside `toEqual`/`toMatchObject`
  (`status: expect.toBeOneOf([…])`).
- Known gaps: `expect.pass`/`expect.fail` are unimplemented upstream and excluded from our types.
  It's `toEqualCaseInsensitive` — not `…Insensitively` as some docs claim; unknown matcher names
  fail typecheck here.

### MSW-mocked packages

- MSW mocks the external HTTP/service boundary — never internal abstractions. One shared `server`
  (`setupServer()`) per package in a `mocks/` module, its lifecycle wired by
  `registerMSWLifecycle(server)` (`@vers/test-utils/bun`) in the preload with
  `onUnhandledRequest: 'error'`. Tests add per-test handlers with `server.use(...)`, including
  override and upstream-failure cases; for oRPC procedures, build them with `buildMockService` /
  `mockService` (`@vers/client-test-utils/orpc`).
- Stateful backends use `@msw/data`: an in-memory store built from a zod schema
  (`new Collection({ schema })`, `.create()`/`.createMany()`, `.findFirst()`/`.findMany()`,
  `.defineRelations()`) read and written directly from the oRPC mock handlers — never `@msw/data`'s
  `factory()` model dictionary. Every row-schema field carries a `.default()` — faker-driven where
  the value is arbitrary — except a discriminator whose value gives a row its meaning; the preload
  seeds faker once so runs are reproducible, and a `.create()` call never restates a default.
- React: React Testing Library on happy-dom (registered in the preload). Prefer the project `render`
  util over bare RTL and the utils it returns over the imported `screen`; load data through the MSW
  handlers and `@msw/data` store rather than stubbing hooks or poking Zustand; `waitFor` the fetch
  before asserting.

### RSC and server functions

- Server functions are thin ambient shells: they read request context (`getRequestHeaders`, cookies)
  and load data, then delegate to a pure component or handler taking that data as explicit
  props/args. A unit that needs ambient server context in a test has its ambient read in the wrong
  place — move the read up to the shell.
- A function that returns React elements is a component: write it as one and test it by rendering.
  Pure server components render under RTL + happy-dom like any component — render per state, assert
  visible behaviour.
- Server-fn bodies are named exported handlers that `createServerFn` wraps, so tests call the body
  directly.
- An uncompiled `createServerFn` dispatch relays only a `Response` or a thrown redirect/error to its
  caller; a plain result object resolves as `undefined`. Component tests cover the branches that
  round-trip that way — plain-object branches are asserted at the handler layer.
- The Flight pipeline (`renderServerComponent`, composite components) and ambient reads cannot run
  under bun test (one module graph, no `react-server` export condition); their coverage is the
  real-runtime smoke suite.
- Ambient request context (`@tanstack/react-start/server`) is a mockable boundary: stub it only
  through the shared `withRequestContext` util, installed once in the preload behind a mutable
  holder — never Start's RSC/render APIs, never modules we own. A direct `mock.module` in a test
  file is a review finding. Every stubbed ambient path is also crossed by the smoke suite.

### Forms (Conform)

- A form island drives a Conform form through the shared `useFormSubmit` hook (`lib/forms/`): pass
  the form's server function and it dispatches the `FormData`, returning `lastResult` for `useForm`,
  an in-flight flag, and the submit handler. The handler runs `parseWithZod(formData)` and returns
  `submission.reply()`; the honeypot check stays a server-side helper. Validation imports from
  `@conform-to/zod/v4`.
- The hook also takes an optional seed `lastResult`, which an island forwards from props beside the
  action. Cover a form's result→UI mapping by rendering with a hand-built
  `submission.reply()`-shaped `lastResult` and asserting the errors — a form-level message under the
  empty-string key, a field message under the field name. This reaches every branch with no submit
  and no server. Inject an action to drive pending state and the `Response` fallback.

### Real-database packages

`service-avatar` is the reference example.

- **Production service factory.** A service exposes one `create<Service>Service({ db? })` in `src/`,
  owning its `createService` config; the production entrypoint and every test call that same
  factory. `db` is injected only in tests, for transaction isolation — never clone the
  `createService` config into tests.
- **Single-statement atomicity is the default.** A conditional `UPDATE`/`DELETE ... RETURNING`,
  `INSERT ... ON CONFLICT`, or a data-modifying CTE claims a single-row invariant and survives a
  serverless process kill with no orphaned transaction state. Reach for an interactive
  `db.transaction()` only for a genuine multi-row invariant that doesn't reduce to one statement —
  and give that handler's suite `schema` isolation, since the default transaction-isolation handle
  cannot nest.
- **Isolation strategy.** Acquire the database through `@vers/service-test-utils/bun`:
  `createTestDB()` returns an `await using` handle over one of three isolation levels. `transaction`
  (rollback on dispose) is the default. `schema` (a real, committed clone of `public` in its own
  schema on a shared database) is the opt-out for code that commits mid-op or continues after a
  caught constraint violation, cases where a rolled-back transaction can't nest and an aborted
  statement poisons the rest of a shared test transaction. `database` (a real, committed clone
  database) is reserved for database-scoped state (advisory locks, LISTEN/NOTIFY), DDL and migration
  exercises, and structures `LIKE` can't reproduce (partitioned parents). Inject the handle's `db`
  into the code under test — code that opens its own connection bypasses the isolation.
- **Test setup.** A local `setupTest()` per suite — typed config in, named props out, no `if` —
  builds the db and boots the service, with no data. Never centralise it: a shared `setupTest`
  accretes conditionals as services multiply.
- **Test data — factories + composites.** Every domain entity/DTO gets a faker-defaulted
  `create-mock-*.ts` factory in `test-utils/factories/` (a plain object, never persisted, never
  requiring a parent), each with its own test. Persisted or wired data goes through a
  composite/entity-util (`create-*.ts`, no `-mock-`) that sources its defaults from the factory.
- **Composites build/register/return DATA, never runtime utils** (no clients, apps, servers).
  Default to the shared factories/composites even on first use; a test with more refined needs may
  still build actors bespoke. `createViewer`/`createAnonymousViewer`
  (`@vers/service-test-utils/bun`) are the shared s2s-actor composites; build the client in-test via
  `buildRPCTestClient(app, { token })`.
- **Failure paths are contract.** Assert on the rejection directly —
  `expect(promise).rejects.toMatchObject({ code })` — never try/catch, and test each declared error.
  Bun's matcher types declare `.rejects`/`.resolves` chains synchronous, so they are not `await`ed;
  `toResolve()`/`toReject()` are the two matchers typed as promises and are `await`ed.
- **Naming.** Prefix titles `#procedureName` only when one file holds several procedures' tests;
  plain `it …` when a file covers one unit.
- **Env.** Permanent env is a direct `process.env` assignment in the preload; per-test overrides go
  through `updateEnv`, restored by `removeEnvOverrides` in the preload's `registerBunTestCleanup()`.
- **Auth.** s2s tests use the real verification path: an asymmetric keypair from
  `getTestServiceKeyPair()`, tokens minted with `createServiceToken`.
