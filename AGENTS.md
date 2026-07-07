<!-- Generated file — do not edit. Edit agents/project.md here, or agents/shared.md in zgeoff/tools. -->

# Agent Guidelines

## Operations

- AGENTS.md is generated from `agents/shared.md` and `agents/project.md` — edit the partials, never
  AGENTS.md itself. The shared partial is synced from
  [zgeoff/tools](https://github.com/zgeoff/tools); cross-project rule changes belong there.
- Perform all work on a branch in a git worktree under `.worktrees/` (e.g.
  `git worktree add .worktrees/<branch> -b <branch>`) — never commit directly on `main`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.
- When the work is ready, open a PR against `main` using the PR template
  (`.github/PULL_REQUEST_TEMPLATE.md`).
- PR descriptions are condensed by default: lead paragraph ≤2 sentences, one-line bullets, ≤150
  words. Write the short version first — do not draft long and trim.
- After pushing, link the opened PR's URL in your response so it's one click away.
- A PR is not "ready" until its checks are green: after opening or updating one, watch CI
  (`gh pr checks <n> --watch`) and only report it ready once checks pass — otherwise report the
  failure and what you're doing about it.

## Code style

Mechanically enforced rules (oxfmt, oxlint, format-codemod) aren't repeated here — this file covers
what tooling can't check.

- One primary export per file, and the file name kebab-cases that export (`with-jest-context.ts`
  exports `withJestContext`). Exceptions: `index.ts` entrypoints, `types.ts` for a package's shared
  types, and side-effect-only modules, which are named for what they do (`augment-bun-test.ts`).
- Module order: imports, then the primary export, then private helpers in composition order
  (depth-first). Don't lead with helpers. Non-function supporting declarations (consts, interfaces,
  type aliases) sit directly above the first declaration that uses them — never below their last
  use, and never leading the file (types for the primary export's signature are the one exception:
  they may sit just above it).
- Acronyms stay uppercase in identifiers (`runCLI`, `parseCLIArgs`, `ASTNode`, `pkgURL`,
  `isPackageJSON`) — except when one starts a camelCase name, where it lowercases whole (`cliPath`,
  `astNode`). File names are unaffected: kebab-case lowercases everything (`parse-cli-args.ts`
  exports `parseCLIArgs`).

### Comments

- Comments that document a declaration (function, class, interface, member, module-scope const) are
  JSDoc blocks — always multi-line (`/**` alone, one `*`-prefixed line per point, `*/` alone; never
  a single-line `/** … */`) — so editors surface them on hover; `//` is for statement-level
  commentary inside bodies. Attach the block to the declaration it describes — a doc above the wrong
  `const` binds to that const.
- Comment a declaration only if it states a fact this file doesn't already show — an invariant,
  cross-file/runtime behavior, or why a choice is necessary, not just what it does. If the body
  shows both the mechanics and the reason, skip it. A comment that only restates the name or
  signature in different words is a defect — delete it.
- Comments describe the code as it is now — never its history ("the old implementation",
  "previously", "now uses") or the project's current state (issue numbers, phase/milestone labels,
  "not wired yet"). Both belong in the commit message and rot the moment they're stale.
- Comments don't name other declarations — renames silently strand the reference. State the role or
  contract instead: "callers must pass edits sorted last-to-first", not "(buildEditsFromAST's
  contract)". A declaration's own parameters and signature types are fine to name in its doc.

### Function naming

Every function name starts with a prefix from the closed list below: pick from it, or extend this
file in the same PR that introduces the new verb. The prefix is a contract — a reader should know
the function's shape without opening it.

**Predicates** — return boolean, no side effects:

| Prefix   | Contract                | Example          |
| -------- | ----------------------- | ---------------- |
| `is`     | type or state test      | `isVarDecl`      |
| `has`    | containment, possession | `hasBlankLine`   |
| `can`    | capability              | `canResize`      |
| `should` | policy decision         | `shouldSkipFile` |
| `needs`  | requirement             | `needsBlankLine` |

**Pure producers** — result comes from arguments alone, no side effects:

| Prefix                        | Contract                                                                  | Example             |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------- |
| `build<Result>[From<Source>]` | default constructor for values; drop `From<Source>` when no single source | `buildEditsFromAST` |
| `parse`                       | unstructured input → structure, invalid input reported                    | `parseSource`       |
| `plan`                        | compute an action without performing it                                   | `planGapEdit`       |
| `pick`                        | select among known alternatives                                           | `pickMode`          |
| `find`                        | search that can miss — null/undefined on miss                             | `findPrevious`      |
| `get`                         | cheap access that cannot miss (throwing on a broken invariant is fine)    | `getNodeEnd`        |
| `collect`                     | gather from a traversal or scan                                           | `collectChildNodes` |
| `count`                       | how many                                                                  | `countNewlines`     |
| `split`                       | one value → parts                                                         | `splitLines`        |
| `merge`                       | parts → one value                                                         | `mergeWindows`      |
| `sort`                        | reorder                                                                   | `sortEdits`         |
| `format`                      | value → human-readable string                                             | `formatRange`       |
| `render`                      | structure → output text or markup                                         | `renderHunk`        |
| `normalize`                   | variant forms → the canonical form                                        | `normalizePath`     |
| `resolve`                     | follow indirection to a concrete value                                    | `resolveBinPath`    |
| `expand`                      | compact form → full form                                                  | `expandInputs`      |
| `to<Result>`                  | cheap representation change                                               | `toPosixPath`       |
| `transform`                   | a package's own source→source operation                                   | `transform`         |

**Effectful** — touches the world (filesystem, streams, processes, registries):

| Prefix     | Contract                                                                                                                                | Example           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `apply`    | perform previously planned changes                                                                                                      | `applyEdits`      |
| `create`   | bring a resource into existence (file, directory, process)                                                                              | `createWorkDir`   |
| `read`     | pull raw content from filesystem or network into memory                                                                                 | `readSource`      |
| `load`     | read **and** parse into a ready structure                                                                                               | `loadConfig`      |
| `write`    | persist to the filesystem                                                                                                               | `writeOutput`     |
| `remove`   | delete a resource                                                                                                                       | `removeStaleDist` |
| `update`   | mutate existing state or resource in place                                                                                              | `updateIndex`     |
| `print`    | write to stdout/stderr                                                                                                                  | `printHelp`       |
| `run`      | execute a subprocess, task, or whole pipeline                                                                                           | `runCLI`          |
| `check`    | evaluate and report findings; effects allowed per mode                                                                                  | `checkFile`       |
| `try<X>`   | X with failures captured as a value instead of a throw                                                                                  | `tryCheckFile`    |
| `register` | add to a registry the caller doesn't own                                                                                                | `registerMatcher` |
| `assert`   | throw when an invariant doesn't hold                                                                                                    | `assertSpan`      |
| `emit`     | dispatch an event or notification                                                                                                       | `emitProgress`    |
| `send`     | transmit a payload to a remote receiver (fire-and-forget or RPC — no resource semantics; REST mutations are `create`/`update`/`remove`) | `sendWebhook`     |

**Wrappers and factories** — the result is behaviour, not data:

| Prefix    | Contract                                  | Example           |
| --------- | ----------------------------------------- | ----------------- |
| `with<X>` | HOF that runs a callback inside a context | `withJestContext` |
| `make<X>` | factory whose result is itself a function | `makeExcluder`    |

**Framework conventions** — where the ecosystem's prefix is load-bearing, it wins:

| Prefix          | Contract                                                                                                                | Example          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `use<X>`        | React hook — the prefix drives rules-of-hooks linting; helpers inside a hook follow the normal taxonomy                 | `useDebounce`    |
| `on<Event>`     | event-callback prop or parameter                                                                                        | `onRowClick`     |
| `handle<Event>` | local implementation passed to an `on<Event>` prop — the idiomatic React pair; the `handle` ban applies everywhere else | `handleRowClick` |

**Banned** — each is a vaguer or synonymous form of a listed verb; use that one instead: `handle`
(except React's `handle<Event>`, above), `process`, `manage`, `do`, `perform` (say what it does),
`execute` (→ `run`), `compute` (→ `build`), `fetch` (→ `read`), `save`/`store` (→ `write`), `delete`
(→ `remove`), `search`/`lookup` (→ `find`/`get`).

Algorithm-native vocabulary (`walk`, `backtrack`, `slideDiagonal`) is allowed inside the module
implementing that algorithm — forcing list verbs onto textbook terms hides the algorithm.

## Testing

- Never use `describe` — write flat `test(…)` blocks with behavioural titles that start with "it"
  (`test('it pads before a return statement', …)`).
- Test files are co-located with the module they test (`parse-source.ts` beside
  `parse-source.test.ts`) — no `test/`, `tests/` or `__tests__` directories. Declaration emit
  excludes `*.test.ts`, so they never ship.
- Run `bun test` from the repo root: the jest-extended preload lives in the root `bunfig.toml`, so
  package-cwd runs are missing the extra matchers.
- Tests declare their own data inline — no fixtures shared between tests, even if that means
  duplication.
- Tests are mock-free: pure modules assert on return values, file-touching ones use `mkdtemp` trees,
  and CLI behaviour is asserted end-to-end by spawning the real binary. If a module is hard to test
  without mocking, move its I/O to the caller.
- Reach for jest-extended matchers instead of hand-rolling assertions. Frequently useful:
  - arrays
    - `toIncludeAllMembers`
    - `toIncludeSameMembers`
    - `toPartiallyContain`
    - `toIncludeAllPartialMembers`
    - `toSatisfyAll`
  - objects
    - `toContainEntry`
    - `toContainEntries`
    - `toContainAllKeys`
    - `toBeFrozen`
  - strings
    - `toStartWith`
    - `toEndWith`
    - `toInclude`
    - `toEqualCaseInsensitive`
    - `toEqualIgnoringWhitespace`
  - values
    - `toBeNil`
    - `toBeOneOf`
    - `toSatisfy`
    - `toBeWithin`
    - `toBeEmpty`
  - dates
    - `toBeAfter`
    - `toBeBefore`
    - `toBeBetween`
    - `toBeValidDate`
  - mocks
    - `toHaveBeenCalledOnce`
    - `toHaveBeenCalledExactlyOnceWith`
    - `toHaveBeenCalledBefore`
    - `toHaveBeenCalledAfter`
  - errors/async
    - `toThrowWithMessage`
    - `toResolve` (returns a promise — always `await`)
    - `toReject` (returns a promise — always `await`)
- Matchers also work asymmetrically inside `toEqual`/`toMatchObject`
  (`status: expect.toBeOneOf([…])`).
- Known gaps: `expect.pass`/`expect.fail` are unimplemented upstream and excluded from our types.
  It's `toEqualCaseInsensitive` — not `…Insensitively` as some docs claim; unknown matcher names
  fail typecheck here (upstream's own types are looser and would let typos through).

## Dependencies

- Pin exact versions — no `^`/`~` ranges. (`bun add` saves exact automatically via `exact = true` in
  bunfig.toml — the rule applies to hand-written edits.)

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

34 projects live under `projects/*` (the sole bun workspace glob). Every project has its own
`package.json` named `@vers/<name>`: internal deps use the `workspace:*` protocol, and versions
shared by 5+ projects live in the root manifest's `workspaces.catalog` (referenced as `catalog:`).
Libraries are consumed as TypeScript source (`exports` → `./src/index.ts`); there are no per-library
build steps. `bun install` uses the isolated linker (pnpm-style symlinks, no phantom deps) with
exact pins and a 7-day `minimumReleaseAge` — see `bunfig.toml`. Turborepo drives the task graph:
root `turbo.json` declares the `build`/`typecheck`/`test`/`codegen`/`typegen`/`e2e` pipelines
(ordering inferred from each project's `workspace:*` deps). Per-project `turbo.json` files exist
only to declare `boundaries` tags. CI's changed-project detection is `turbo run --affected`. See
`docs/000-overview.md` for the project list.

TypeScript is 7.0.1-rc (catalog), which dropped `baseUrl` and the classic Compiler API entirely —
every project's tsconfig lost its `baseUrl`/`paths` block and every former `~/*` import is a
relative import instead. There is no path-alias convention here; write new imports relative to the
importing file. Node is 24.18.0 everywhere (CI, every service's Dockerfile, app-web's `engines`
field) — panda 2.0's floor and the ES2024 `lib` target both need it.

## Boundaries

Projects are tagged `lib`, `service`, or `app` in their own `turbo.json`; the root `boundaries`
block denies `lib` → `service`/`app` and `service` → `app` imports, transitively.
`bun run boundaries` also flags imports of packages missing from the importer's `package.json`. It
walks the filesystem, ignoring `.gitignore` — run it on a clean tree, or stale `dist/`/`build/`/
`styled-system/` output reads as source. CI runs it straight after install, before codegen populates
those directories.

### Package naming

Every importable workspace package lives in a `lib-`-prefixed folder. A package's name is its folder
name minus the taxonomy prefix: `lib-` and `app-` strip (`lib-validation` → `@vers/validation`,
`app-web` → `@vers/web`); `service-` is part of the name and carries through (`service-user` →
`@vers/service-user`).

## Styling

Panda CSS 2.0 spans all four consumers (lib-panda-preset, lib-styled-system, lib-design-system,
app-web). lib-panda-preset composes `presets: [presetBase, presetPanda]` from
`@pandacss/preset-base` and `@pandacss/preset-panda` (2.0 dropped the bundled
`@pandacss/dev/presets` default). CSS values that aren't theme tokens need the bracket escape hatch
(`cursor: '[pointer]'`, `borderWidth: '[1px]'`) — 2.0 tightened `SystemStyleObject`'s value types to
stop silently accepting arbitrary strings/numbers.

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
  `styled-system`, react-router's `+types`) those imports degrade to `any` and the unsafe-\* rules
  report hundreds of false violations. Every type-aware rule is on; `only-throw-error`'s app-web
  override is the one permanent, documented exception, and `lib-idle-core`/`lib-aether-core`
  tick/lifecycle handlers that mutate their entity parameter by design carry a real inline reason —
  also permanent. For `typescript/prefer-readonly-parameter-types`, a function's own
  data/config/props/option types are made `readonly` (or the param `Readonly<…>`-wrapped; React
  props `Readonly<Props>`), and framework/library handles that have no readonly form (a
  `Kysely`/`Elysia`/`RPCHandler`/`Request` handle, a `Date`, …) are exempted per-type via the rule's
  `allow` list in `.oxlintrc.json` — never an inline marker. Only a genuinely un-`readonly`-able own
  type (a generic callback-arg object, a `ZodType`-bearing shape, a React-element wrapper) carries a
  single honest inline directive stating why; `allow` covers the rest.
- `bun run format` — `oxfmt .` (`.oxfmtrc.json` at the root), then `format-codemod` (blank-line
  padding) over the whole tree. The codemod has no ignore file, so its `--ignore` flags are what
  keep it off committed codegen output (`app/gql`, panda's `styled-system` dirs, react-router's
  typegen) and nested checkouts — oxfmt covers the same set through `.oxfmtrc.json` plus
  `.gitignore`. The chain is idempotent: a second run is byte-identical.
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
`service-verification`) has a multi-stage Dockerfile around `turbo prune <pkg> --docker`
(`app-design-reference` ships as a plain static-nginx image outside this pattern):

1. **pruner** — a standalone `turbo` binary prunes to the target's dependency graph: `out/json`
   (manifests only, for layer caching), `out/full` (source), a pruned `out/bun.lock`.
2. **installer** — full `bun install` against `out/json` for build-time tooling.
3. **builder** — copies `out/full` plus `scripts/build-esbuild.ts` and `tsconfig.base.json` (outside
   any package, so prune doesn't carry them), then runs the project's `build` script.
4. **prod-deps** — `bun install --production --linker=hoisted`. Hoisting is essential: a bundle
   inlines source from several packages, and its external imports (`pino`, …) must resolve from the
   bundle's own location — only a flat `node_modules` serves them all.
5. **runtime** — `node:24.18.0-alpine` with the prod-deps `node_modules` and built output only.

app-web's builder runs its `codegen`/`typegen`/`build` scripts directly instead of
`turbo run build`.

## Testing (bun test, 0-isolation)

`bun test` runs every file in one process with no per-file isolation — lean into it. All lifecycle
and cleanup is registered once in a package's `bunfig.toml` preload and applies process-wide; test
files contain no `beforeAll`/`beforeEach`/`afterEach`/`afterAll`. This is what keeps the suite fast.

- **MSW is the sanctioned boundary mock** — the one carve-out from the shared partial's "mock-free"
  rule. Mock at the external HTTP/service boundary with MSW, never internal abstractions. Each
  package with HTTP tests keeps one shared `server` (`setupServer()`) in a `mocks/` module; its
  lifecycle (`listen({ onUnhandledRequest: 'error' })`, `resetHandlers`, `close`) is wired globally
  by `registerMSWLifecycle(server)` (from `@vers/client-test-utils`) in the preload. Tests add
  per-test handlers with `server.use(...)` — including override and upstream-failure cases. For oRPC
  procedures, build those handlers with `buildMockService` / `mockService`
  (`@vers/client-test-utils/rpc-msw`).
- **Global mock reset** lives in the preload's `afterEach` (`mock.restore()`), never per-test.
- **jest-extended matchers** come from the `@zgeoff/bun-test-extended` preload; a package-local
  `augment-bun-test.ts` side-effect import brings their types into `tsc`.
- `toStrictEqual`, not `toEqual`, for object assertions.
- Bound test-result names: `ctx` for a `setupTest(…)` result, `hook` for `renderHook(…)`, `rendered`
  for RTL `render(…)` — member-access off them, never pick properties into loose consts.
- Behavioural test names describe observable behaviour and never cite internal identifiers
  (`it flags the run as invalid`, not `it sets isValid to false`).
- Declare test data inline per test for MSW-mocked packages (a client hitting a mocked service, or
  app-web): no factory builders (`createUser`) and no shared mutable module-level fixtures. One-off
  helpers stay inline — reusable ones live in `test-utils/`. Service/app/DB packages that hit a real
  database follow the factory-and-composite rule below instead — the two are scoped to different
  boundaries, not in tension.
- **Stateful backends** use `@msw/data`: build an in-memory store from a zod schema
  (`new Collection({ schema: z.object({ … }) })`, `.create()`/`.createMany()`,
  `.findFirst((q) => q.where(…))`/`.findMany()`, `.defineRelations()`) and read/write it directly
  from the oRPC mock handlers. Models are zod schemas, not the legacy `factory()` model dictionary.
- **React:** React Testing Library on happy-dom (bootstrapped via `@happy-dom/global-registrator` in
  the preload); prefer a project `render` util over bare RTL and the utils it returns over the
  imported `screen`; load data through the centralized MSW handlers + `@msw/data` in-memory store
  rather than stubbing hooks or poking Zustand; `waitFor` the fetch before asserting.

### RSC and server-function testing (phases 1+)

- Server functions are thin ambient shells: they read request context (`getRequestHeaders`, cookies)
  and fetch, then delegate to a pure component or handler that takes data as explicit props/args. If
  a unit needs ambient server context to test, the ambient read is in the wrong place — move it up
  to the shell.
- Pure server components (props in, no ambient/server-only imports) are tested with RTL on happy-dom
  like any component: render per state, assert visible behaviour. Branch selection is covered by
  these render tests — never by asserting which element a function returned.
- `pick*` selectors return data (strings, unions), never React elements.
- The Flight pipeline (`renderServerComponent`, composite components) and ambient reads are not
  unit-testable under bun test (single module graph, no `react-server` export condition). Their
  coverage is the real-runtime smoke suite, not unit tests.
- **Ambient-context mock (cautious carve-out, alongside MSW):** `@tanstack/react-start/server`'s
  ambient request APIs may be stubbed in tests — installed once in the preload behind a mutable
  holder, driven per-test through the shared `withRequestContext` util. Rules: only Start's ambient
  request APIs, never RSC/render APIs and never modules we own; tests use the util, a direct
  `mock.module` in a test file is a review finding; every stub-covered ambient path must also be
  crossed by the real-runtime smoke; explicit args stay preferred where free. Server-fn bodies are
  written as named exported handlers that `createServerFn` wraps, so tests call the body directly.
  (Util lands with phase 1.)

### Real-database services (service/app/DB packages)

Services, apps, and DB-backed libraries that exercise a real postgres instead of MSW follow this
standard instead of the inline-data rule above — `service-avatar` is the reference example.

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
- **One export per file, filename = its kebab-cased export.** `types.ts`/`index.ts` excepted — hold
  this line on new files; it's the violation reviewers keep catching.
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

Everything above reads as final-state. The gaps between that and today's tree live here, each with
its tracking issue — delete a bullet when its issue closes.

- **Vitest survives in unswept packages (#266).** The single runner is `bun test`; a package is on
  vitest exactly when it has a `vitest.config.ts` (the root `vitest.workspace.ts` globs those, and
  `turbo run test` uses each package's own runner meanwhile — deleting the config drops the package
  from the vitest run). app-web converts as #165 ports it. Never add vitest to anything new, and
  don't re-add it to a converted package to "match" a still-on-vitest neighbour. Where
  `agents/shared.md` assumes bun test everywhere (e.g. "run `bun test` from the repo root"),
  still-on-vitest packages follow their own config until swept.
- **Lint baseline backlog (#236).** ~550 legacy sites are baselined inline with
  `// oxlint-disable-next-line <rule> -- baseline(#236)` comments rather than turned off in config;
  the unused-directive check is the ratchet — fixing a baselined site makes its comment stale and
  lint fails until the comment is deleted. `typescript/prefer-readonly-parameter-types` is never
  baselined; new code follows the readonly rules above.
- **Panda CSS is a beta pin.** 2.0.0-beta.8 — no stable release exists yet, so the packages are
  pinned through `bunfig.toml`'s `minimumReleaseAgeExcludes`, with a removal issue tracking the jump
  to stable.
- **Screens are functional-first until the final design language lands (#245 → #246).** The current
  visual direction is round 1; a second Claude Design pass (#245) supersedes it once game design
  matures, and the design system gets rebuilt to that final language (#246). Until #246 closes,
  screens and routes are built workable-only: compose existing `lib-design-system` components and
  semantic tokens (`bg.*`, `text.*`, `border.*`, `accent.*`) — no bespoke visual styling beyond
  layout, no new one-off colors/fonts/animations, no polish passes. The semantic-token layer is the
  stable contract; the re-skin lands in #246 under unchanged token names, so screens that stick to
  it adapt for free. A screen needing a component that doesn't exist yet builds the minimal version
  in its own PR and promotes it into `lib-design-system` when a second consumer appears.
- **app-web still carries frozen GraphQL artifacts (#165).** `app/gql/**` and root `schema.graphql`
  are committed artifacts of a deleted gateway — never regenerate or edit them; both die with #165's
  web-shell rebuild.
