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
