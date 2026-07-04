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
`turbo.json` at the root declares `build`/`typecheck`/`test`/`codegen`/`typegen`/`e2e` pipelines
(cross-package ordering comes from each project's own `workspace:*` dependencies — turbo infers it,
nothing is hand-listed), plus a root-scoped `//#codegen:graphql` task for the one codegen step that
reads across two unrelated packages (service-api's schema, app-web's documents). Each project also
carries a one-line `turbo.json` (`{"extends": ["//"], "tags": [...]}`) whose only job is declaring
its `boundaries` tag — see below. `turbo run --affected` drives CI's changed-project detection. See
`docs/000-overview.md` for the project list and what each one is.

## Boundaries

Every project is tagged `lib`, `service`, or `app` in its own `turbo.json`. The root `turbo.json`'s
`boundaries` block denies `lib` → `service`/`app` and `service` → `app` imports, transitively —
`turbo boundaries` (`bun run boundaries`) walks the real import graph, not just direct deps, so a
lib gaining a transitive path to a service fails too. It also flags any import of a package that
isn't declared in the importing project's own `package.json`, which is a stricter, unrelated check
bundled into the same command. Run it on a clean tree: it walks the filesystem directly rather than
respecting `.gitignore`, so leftover `dist/`, `build/`, or `styled-system/` output from a prior
local build reads as real (and, for generated-but-committed files like `app/gql/**`, deleting them
locally makes their real imports look broken). CI runs it right after install, before any
codegen/build step populates those directories.

## Running things today

- `bun install` — installs the whole workspace (`--frozen-lockfile` in CI; `bun.lock` is
  committed).
- `bun run typecheck` — `turbo run typecheck` (per-project `tsc --noEmit`, codegen/typegen deps
  resolved automatically); a single project via `turbo run typecheck --filter=@vers/<name>`.
- `bun run test` — `turbo run test` (per-project `vitest run`, each project's own `vitest.config.ts`);
  a single project via `turbo run test --filter=@vers/<name>`. Postgres-backed suites need
  `bun run pg:test-container:start` first.
- `bun run lint` — `tsx scripts/lint.ts`, a wrapper that shells out to `eslint` over `projects/`
  and `scripts/` (`--fix` via `bun run lint --fix`). Run through `bun run` (not raw `tsx`) so
  `node_modules/.bin` is on `PATH`. Not part of the turbo pipeline — eslint's own flat config
  already covers the whole tree in one invocation, so there's nothing to fan out per-package.
- `bun run format` / `bun run format --check` — `tsx scripts/format.ts`, a wrapper that shells out
  to `prettier`.
- `bun run build` — `turbo run build`; a single project via `turbo run build --filter=@vers/<name>`.
- `bun run e2e` — `turbo run e2e` (Playwright, `app-web-e2e`).
- `bun run boundaries` — `turbo boundaries` (see above).

## Docker

Each deployable (`app-web`, `db-postgres`, the 6 `service-*` projects) has its own multi-stage
Dockerfile built around `turbo prune <pkg> --docker`, not a shared whole-repo base image:

1. **pruner** — a standalone `turbo` binary (installed globally, no workspace install needed) prunes
   the workspace down to the target's own dependency graph, producing `out/json` (manifests, for
   Docker layer caching), `out/full` (real source), and a pruned `out/bun.lock`.
2. **installer** — a full `bun install` (with devDependencies) against `out/json`, so the build step
   below has esbuild, panda, vite, react-router-dev, etc.
3. **builder** — copies in `out/full`, plus the shared `scripts/build-esbuild.ts` driver and
   `tsconfig.base.json` (both live outside any workspace package, so `turbo prune` doesn't carry
   them — they're copied straight from the build context instead), then runs the project's own
   `build` script.
4. **prod-deps** — a _second_, separate `bun install --production --linker=hoisted` against the same
   `out/json`. This is the one load-bearing deviation from the repo's normal isolated linker: a
   service's esbuild bundle inlines source from several workspace packages into one file, and that
   file's external imports (`pino`, etc.) resolve relative to _its own_ location — under the
   isolated linker those externals only exist in whichever sibling package originally declared them,
   which the bundle's location can't see. Hoisting flattens everything into one `node_modules` any
   bundle can resolve regardless of which package used to own the import.
5. **runtime** — a plain `node:alpine` image with only the prod-deps `node_modules` + the built
   output (`dist/main.js` for services, `build/` + `server.mjs` for app-web).

`scripts/write-standalone-manifest.ts` (which used to hand-compute this same aggregated external
dependency list for a flat `npm install` after the build) is gone — `turbo prune`'s pruned lockfile
plus the hoisted production install cover it, correctly and for every transitive workspace
dependency, without hand-rolled resolution logic.

app-web's Dockerfile is the one exception to step 3 above: it runs the project's `codegen`/`typegen`/
`build` scripts directly rather than through `turbo run build`, because that would pull in the
`//#codegen:graphql` root task — which reads `service-api`'s schema, a package outside app-web's own
pruned dependency graph entirely. `app/gql/**` is committed rather than build-time generated for
this reason: the Docker build (and any environment without service-api's source) uses what's already
there instead of regenerating it.

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
