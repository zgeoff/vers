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

Mechanically enforced rules (oxfmt, oxlint, format-codemod) aren't repeated — these are the rules
tooling can't check.

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
  `astNode`). ID counts as an acronym: `userID`, `sessionID` — never `userId` — and `idToken` when
  it starts a name. File names are unaffected: kebab-case lowercases everything (`parse-cli-args.ts`
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

Every function name starts with a prefix from this closed taxonomy: pick from it, or extend this
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

**Framework conventions** — where the ecosystem depends on the prefix, it wins:

| Prefix          | Contract                                                                                                                | Example          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `use<X>`        | React hook — the prefix drives rules-of-hooks linting; helpers inside a hook follow the normal taxonomy                 | `useDebounce`    |
| `on<Event>`     | event-callback prop or parameter                                                                                        | `onRowClick`     |
| `handle<Event>` | local implementation passed to an `on<Event>` prop — the idiomatic React pair; the `handle` ban applies everywhere else | `handleRowClick` |

**Banned** — each is a vaguer or synonymous form of a listed verb; use that one instead: `handle`
(except React's `handle<Event>` pair), `process`, `manage`, `do`, `perform` (say what it does),
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
- Matchers work asymmetrically inside `toEqual`/`toMatchObject`
  (`status: expect.toBeOneOf([…])`).
- Known gaps: `expect.pass`/`expect.fail` are unimplemented upstream and excluded from our types.
  It's `toEqualCaseInsensitive` — not `…Insensitively` as some docs claim; unknown matcher names
  fail typecheck here (upstream's own types are looser and would let typos through).

## Dependencies

- Pin exact versions — no `^`/`~` ranges. (`bun add` saves exact automatically via `exact = true` in
  bunfig.toml — the rule applies to hand-written edits.)

## Issue hygiene

Triage a GitHub issue the moment it's opened, not in a later pass: assign the delivery-phase
milestone, apply the area, type, and priority labels, record blocking edges against the issues it
depends on, add it to the delivery board, and set its board status. An open issue that isn't on the
board with a milestone and status is a defect.

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

Projects live under `projects/*` (the sole bun workspace glob); `docs/overview.md` lists them. Every
project has its own `package.json` named `@vers/<name>`: internal deps use the `workspace:*`
protocol, and every external dependency's version lives in the root manifest's `workspaces.catalog`,
referenced everywhere as `catalog:` — project manifests carry no direct version pins. Libraries are
consumed as TypeScript source (`exports` → `./src/index.ts`); there are no per-library build steps.
`bun install` uses the isolated linker (pnpm-style symlinks, no phantom deps) with exact pins and a
7-day `minimumReleaseAge` — see `bunfig.toml`. Turborepo drives the task graph: root `turbo.json`
declares the `build`/`typecheck`/`test`/`codegen`/`typegen`/`e2e` pipelines (ordering inferred from
each project's `workspace:*` deps). Per-project `turbo.json` files exist only to declare
`boundaries` tags. CI's changed-project detection is `turbo run --affected`.

TypeScript is 7.0.2 (catalog). TS7 has no `baseUrl` and no classic Compiler API, and there is no
path-alias convention here — write imports relative to the importing file. Node is 24.18.0 in CI and
`app-web` (its runtime image and `engines` field); the domain services compile to a Bun binary on
`alpine`. Panda 2.0's floor and the ES2024 `lib` target both need Node 24.

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
app-web), pinned at 2.0.0-beta.8 — no stable 2.0 release exists — through `bunfig.toml`'s
`minimumReleaseAgeExcludes`. lib-panda-preset composes `presets: [presetBase, presetPanda]` from
`@pandacss/preset-base` and `@pandacss/preset-panda` — Panda 2.0 ships no bundled default preset.
CSS values that aren't theme tokens need the bracket escape hatch (`cursor: '[pointer]'`,
`borderWidth: '[1px]'`) — 2.0's `SystemStyleObject` value types reject arbitrary strings/numbers.

### Screens

Screens and routes are built workable-only: compose existing `lib-design-system` components and
semantic tokens (`bg.*`, `text.*`, `border.*`, `accent.*`) — no bespoke visual styling beyond
layout, no new one-off colors/fonts/animations, no polish passes. The semantic-token layer is the
stable contract: re-skins change token values, never token names, so screens that stick to it adapt
for free. A screen needing a component that doesn't exist yet builds the minimal version in its own
PR and promotes it into `lib-design-system` when a second consumer appears.

## Running things

- `bun install` — whole workspace (`--frozen-lockfile` in CI; `bun.lock` is committed).
- `bun run typecheck` — `turbo run typecheck` (per-project `tsc --noEmit`); one project via
  `--filter=@vers/<name>`.
- `bun run test` — `turbo run test`, each project's own runner; one project via `--filter`. The
  repo's test runner is `bun test`; a package runs vitest exactly when it has a `vitest.config.ts`
  (the root `vitest.workspace.ts` globs those, and deleting the config drops the package from the
  vitest run). Never add vitest to a new package, and never re-add it to a converted one to "match"
  a vitest neighbour. Postgres-backed suites need `bun run pg:test-container:start` first. bun-test
  packages each carry their own `bunfig.toml` (bunfig is read from cwd, not merged up) —
  root-invoked `bun test <file>` still resolves jest-extended matchers from the root preload.
- `bun run lint` / `bun run lint:fix` — `turbo run codegen typegen`, then
  `oxlint --type-aware --type-check --report-unused-disable-directives-severity error` over the
  whole tree (`.oxlintrc.json` at the root; oxlint-tsgolint underneath, needs the TS7 toolchain —
  ~5s wall with warm caches). The codegen leg is required: without generated output (panda's
  `styled-system`, router typegen) those imports degrade to `any` and the unsafe-\* rules report
  hundreds of false violations. Every type-aware rule is on. Two exceptions are permanent:
  `only-throw-error`'s documented app-web override, and the inline directives on
  `lib-idle-core`/`lib-aether-core` tick/lifecycle handlers that mutate their entity parameter by
  design. Pre-existing violations are baselined inline with
  `// oxlint-disable-next-line <rule> -- baseline(#236)` comments rather than turned off in config;
  the unused-directive check is the ratchet — fixing a baselined site makes its comment stale and
  lint fails until the comment is deleted. `typescript/prefer-readonly-parameter-types` is never
  baselined: a function's own data/config/props/option types are made `readonly` (or the param
  `Readonly<…>`-wrapped; React props `Readonly<Props>`), and framework/library handles that have no
  readonly form (a `Kysely`/`Elysia`/`RPCHandler`/`Request` handle, a `Date`, …) are exempted
  per-type via the rule's `allow` list in `.oxlintrc.json` — never an inline marker. Only a
  genuinely un-`readonly`-able own type (a generic callback-arg object, a `ZodType`-bearing shape, a
  React-element wrapper) carries a single honest inline directive stating why; `allow` covers the
  rest.
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
- `bun run deadcode` — knip (`knip.json`); blocking in CI and pre-push. Needs codegen output
  present; a dependency knip can't see gets a `knip.json` ignore in the PR that introduces it.
- Git hooks: lefthook (`lefthook.yml`, installed by `prepare`). Pre-push tests changed files only
  (`turbo run test --affected`, so each affected project's own runner is used) — the full suite is
  CI's. `LEFTHOOK=0` skips all hooks.

## Docker

Every server Dockerfile is multi-stage around `turbo prune <pkg> --docker`, whose **pruner** stage
runs a standalone `turbo` binary to cut the workspace to the target's dependency graph: `out/json`
(manifests only, for layer caching), `out/full` (source), a pruned `out/bun.lock`. `bun install`
layers read a BuildKit cache mount (`--mount=type=cache,target=/root/.bun/install/cache`), so builds
reuse the package cache.

`service-avatar`, `service-session`, `service-user`, and `service-verification` compile to a single
executable in stages:

1. **pruner** — as above.
2. **builder** — a full `bun install`, then
   `bun build src/serve.ts --compile --target=bun-linux-x64-musl` inlines every dependency (the
   services carry no native addons) into one binary.
3. **runtime** — `alpine` with `libgcc` and `libstdc++` and the binary alone: no `node_modules`, no
   source. The busybox shell keeps `fly ssh console` usable.

`app-web` bundles an SSR server in stages: **pruner**; **installer** (full `bun install` for the
build tooling); **builder** (`turbo run codegen typegen --filter=@vers/web...` so a workspace dep's
generated output — `@vers/styled-system`'s panda CSS — exists before its own `build` script runs,
plus `tsconfig.base.json` from outside any package); **prod-deps**
(`bun install --production --linker=hoisted`, whose flat `node_modules` lets the bundle resolve
external imports like `pino` from one location); and a `node:24.18.0-alpine` **runtime** holding
`node_modules`, `server.mjs`, and `dist`.

`app-design-reference` ships as a plain static-nginx image.

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

### Forms (Conform)

- A form island drives a Conform form through the shared `useFormSubmit` hook (`lib/forms/`): pass
  the form's server function and it dispatches the `FormData`, returning `lastResult` for `useForm`,
  an in-flight flag, and the submit handler. The handler runs `parseWithZod(formData)` and returns
  `submission.reply()`; the honeypot check stays a server-side helper. Validation imports from
  `@conform-to/zod/v4`, matching app-web's zod v4.
- The hook also takes an optional seed `lastResult`, which an island forwards from props beside the
  action. Cover a form's result→UI mapping by rendering it with a hand-built
  `submission.reply()`-shaped `lastResult` and asserting the errors — a form-level message under the
  empty-string key, a field message under the field name. This reaches every branch with no submit
  and no server, including the plain-object branch a live `createServerFn` dispatch collapses to
  `undefined` under bun test. Inject an action to drive pending state and the `Response` fallback.

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
