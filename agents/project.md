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
