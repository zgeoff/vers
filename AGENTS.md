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
  JSDoc blocks (`/** … */`) so editors surface them on hover; `//` is for statement-level commentary
  inside bodies. Attach the block to the declaration it describes — a doc above the wrong `const`
  binds to that const.
- Comments describe the code as it is. Never reference its history ("the old implementation",
  "previously", "now uses") or the change that produced it — that context lives in commit messages
  and goes stale the moment it merges.
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

## Monorepo layout

26 projects live under `projects/*` (the sole bun workspace glob). Every project has its own
`package.json` named `@vers/<name>`: internal deps use the `workspace:*` protocol, and versions
shared by 5+ projects live in the root manifest's `workspaces.catalog` (referenced as `catalog:`).
Libraries are consumed as TypeScript source (`exports` → `./src/index.ts`); there are no per-library
build steps. `bun install` uses the isolated linker (pnpm-style symlinks, no phantom deps) with
exact pins and a 7-day `minimumReleaseAge` — see `bunfig.toml`. Turborepo drives the task graph:
root `turbo.json` declares the `build`/`typecheck`/`test`/`codegen`/`typegen`/`e2e` pipelines
(ordering inferred from each project's `workspace:*` deps) plus a root `//#codegen:graphql` task for
the one codegen step that reads across packages (service-api's schema, app-web's documents).
Per-project `turbo.json` files exist only to declare `boundaries` tags. CI's changed-project
detection is `turbo run --affected`. See `docs/000-overview.md` for the project list.

## Boundaries

Projects are tagged `lib`, `service`, or `app` in their own `turbo.json`; the root `boundaries`
block denies `lib` → `service`/`app` and `service` → `app` imports, transitively. `bun run
boundaries` also flags imports of packages missing from the importer's `package.json`. It walks the
filesystem, ignoring `.gitignore` — run it on a clean tree, or stale `dist/`/`build/`/
`styled-system/` output reads as source. CI runs it straight after install, before codegen
populates those directories.

### Package naming

Every importable workspace package lives in a `lib-`-prefixed folder; deployables keep their role
prefixes (`service-`, `app-`, `db-`). A package's name is its folder name minus the `lib-` prefix
(`projects/lib-validation` → `@vers/validation`); deployable folder names carry through unchanged.

## Running things today

- `bun install` — whole workspace (`--frozen-lockfile` in CI; `bun.lock` is committed).
- `bun run typecheck` — `turbo run typecheck` (per-project `tsc --noEmit`); one project via
  `--filter=@vers/<name>`.
- `bun run test` — `turbo run test` (per-project `vitest run`); one project via `--filter`.
  Postgres-backed suites need `bun run pg:test-container:start` first.
- `bun run lint` — `tsx scripts/lint.ts`, shells out to `eslint` over `projects/` and `scripts/`
  (`--fix` supported). Run through `bun run` so `node_modules/.bin` is on `PATH`. Not a turbo task —
  eslint's flat config covers the tree in one invocation.
- `bun run format` / `bun run format --check` — `tsx scripts/format.ts`, shells out to `prettier`.
- `bun run build` — `turbo run build`; one project via `--filter`.
- `bun run e2e` — `turbo run e2e` (Playwright, `app-web-e2e`).
- `bun run boundaries` — `turbo boundaries`.

## Docker

Each deployable (`app-web`, `db-postgres`, the 6 services) has a multi-stage Dockerfile around
`turbo prune <pkg> --docker`:

1. **pruner** — a standalone `turbo` binary prunes to the target's dependency graph: `out/json`
   (manifests only, for layer caching), `out/full` (source), a pruned `out/bun.lock`.
2. **installer** — full `bun install` against `out/json` for build-time tooling.
3. **builder** — copies `out/full` plus `scripts/build-esbuild.ts` and `tsconfig.base.json` (outside
   any package, so prune doesn't carry them), then runs the project's `build` script.
4. **prod-deps** — `bun install --production --linker=hoisted`. Hoisting is load-bearing: a bundle
   inlines source from several packages, and its external imports (`pino`, …) must resolve from the
   bundle's own location — only a flat `node_modules` serves them all.
5. **runtime** — `node:alpine` with the prod-deps `node_modules` and built output only.

app-web's builder runs its `codegen`/`typegen`/`build` scripts directly instead of `turbo run
build`, which would pull in `//#codegen:graphql` — that task reads service-api's schema, outside
app-web's pruned graph. `app/gql/**` is committed so builds without service-api's source use it
as-is.

## Tooling migration in progress

See #160 for the full phase plan (turborepo + bun, spike-gated; shared configs and AGENTS.md from
`zgeoff/tools`). This repo is mid-migration — several claims in `agents/shared.md` above describe
the _target_ state, not this repo yet:

- **oxlint/oxfmt** — not adopted. Linting and formatting still run through eslint (`eslint.config.js`
  family) and prettier, invoked via `scripts/lint.ts` / `scripts/format.ts`. Lands in #188.
- **lefthook** — not adopted. Git hooks are still husky + lint-staged (`.husky/`), minimally
  adapted to invoke bun. Lands in #189.
- **`bun test`** — not adopted. bun is the package manager and script runner only; all
  unit/integration tests run under vitest on node. Deferred past #160 to the rebuild (#163) —
  vitest stays until services move to the bun runtime.

Don't "fix" these to match the shared partial mid-migration — follow the phase plan in #160 instead.
